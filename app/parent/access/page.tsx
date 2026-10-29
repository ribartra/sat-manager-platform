import Link from "next/link";
import prisma from "@/lib/prisma";
import { formatDate } from "@/lib/utils";
import { summarizeAllQuestionAnswers } from "@/lib/weighted-score";
import { Card } from "@/components/ui/card";
import {
  accessWindow,
  areasLabel,
  parseAreas,
  practiceSetMatchesArea,
} from "@/lib/parent-access";
import { hashPublicToken } from "@/lib/token-security";
import { writeAudit } from "@/lib/audit";
import { InlineError } from "@/components/sat/alert";
import { PracticeSetAttemptsAccordion, SkillResults } from "@/components/sat";
import { loadPracticeReport } from "@/lib/student-report";
import type { PracticeAreaCode } from "@/lib/practice-area";
import { practiceSetGroups, practiceSetTitle, type GroupableSet } from "@/lib/attempt-groups";

interface PageProps {
  searchParams: Promise<{ token?: string }>;
}

type AccessFailReason = "missing" | "unknown" | "expired" | "revoked";

function failMessage(reason: AccessFailReason): string {
  switch (reason) {
    case "missing":
      return "This link is incomplete. Please use the full link from the email.";
    case "unknown":
      return "This link doesn't work.";
    case "revoked":
      return "This link is no longer active. Ask the teacher for a new one.";
    case "expired":
      return "This link has expired. Ask the teacher for a new one.";
  }
}

async function AccessDenied({ reason, tokenPrefix }: { reason: AccessFailReason; tokenPrefix?: string }) {
  await writeAudit({
    action: "PARENT_REPORT_OPEN_FAILED",
    targetType: "ParentAccessToken",
    targetId: tokenPrefix ?? reason,
    outcome: "failure",
    metadata: { reason, tokenPrefix },
  });

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-4 py-8 text-center">
      <h1 className="text-lg font-semibold text-gray-900">We couldn&apos;t open this report</h1>
      <InlineError className="mt-2">{failMessage(reason)}</InlineError>
      <p className="mt-3 text-sm text-gray-500">If you still need the report, ask the teacher to send you a new link.</p>
      <Link href="/login" className="mt-6 text-sm text-blue-600 hover:underline">
        Go to sign in
      </Link>
    </div>
  );
}

export default async function ParentTemporaryAccessPage({ searchParams }: PageProps) {
  const { token } = await searchParams;
  if (!token) return <AccessDenied reason="missing" />;

  const access = await prisma.parentAccessToken.findUnique({
    where: { tokenHash: hashPublicToken(token) },
    include: {
      student: {
        include: {
          attempts: {
            where: { status: "SUBMITTED" },
            include: {
              answers: true,
              assignment: { include: { practiceSet: { include: { topic: { include: { domain: { include: { section: true } } } } } } } },
            },
            orderBy: { submittedAt: "desc" },
          },
        },
      },
    },
  });

  if (!access) return <AccessDenied reason="unknown" tokenPrefix={token.slice(0, 8)} />;

  if (access.revokedAt) {
    return <AccessDenied reason="revoked" tokenPrefix={access.id} />;
  }

  const wasActivated = Boolean(access.usedAt);
  const state = accessWindow(access);
  if (!state.active) {
    return <AccessDenied reason="expired" tokenPrefix={access.id} />;
  }

  // First open activates the link and starts the 7-day access window.
  if (!wasActivated) {
    await prisma.parentAccessToken.update({ where: { id: access.id }, data: { usedAt: new Date() } });
  }

  await writeAudit({
    userId: access.parentId ?? access.createdById,
    action: "PARENT_REPORT_OPENED",
    targetType: "ParentAccessToken",
    targetId: access.id,
    outcome: "success",
    metadata: {
      studentId: access.studentId,
      firstOpen: !wasActivated,
      areas: access.areas,
      effectiveExpiresAt: state.effectiveExpiresAt.toISOString(),
    },
  });

  const areas = parseAreas(access.areas);
  const allAreas = areas.length === 3;

  const attempts = access.student.attempts.filter((attempt) => {
      const taxonomy = attempt.assignment?.practiceSet.topic.domain;
      const section = taxonomy?.section;
      if (!taxonomy || !section) return allAreas;
      return areas.some((area) => practiceSetMatchesArea({ practiceArea: taxonomy.practiceArea, sectionName: section.name }, area));
    });

  // Attempt level only (same accordion as teacher and student): one row per practice set with its
  // LAST attempt, opening to its last 3 tries. No average across sets.
  const sets = new Map<string, GroupableSet>();
  for (const attempt of attempts) {
    const practiceSet = attempt.assignment?.practiceSet;
    const key = attempt.assignmentId ?? attempt.id;
    const set = sets.get(key) ?? sets.set(key, { key, title: practiceSet ? practiceSetTitle(practiceSet.name, practiceSet.difficulty) : "Practice set", tries: [] }).get(key)!;
    const attemptScore = summarizeAllQuestionAnswers(attempt.answers);
    set.tries.push({
      id: attempt.id,
      tryNumber: attempt.attemptNumber,
      submittedAt: attempt.submittedAt,
      correct: attemptScore.correct,
      total: attemptScore.total,
      pct: attemptScore.percent,
      time: attempt.totalTime,
      status: attempt.status,
    });
  }
  const groups = practiceSetGroups([...sets.values()]);
  // Results by skill (same SkillResults as teacher and student), only for the areas this link covers.
  const AREA_CODE: Record<string, PracticeAreaCode> = { mathematics: "MATH", reading: "READING", writing: "WRITING" };
  const reports = (await Promise.all(areas.map((area) => loadPracticeReport(access.studentId, AREA_CODE[area], {})))).filter(
    (report) => report.skillResults.length > 0,
  );

  return (
    <div className="mx-auto max-w-[var(--sat-page-wide)] px-4 py-8">
      <div className="mb-6">
        <p className="text-xs font-medium uppercase text-gray-400">Progress report · {areasLabel(areas)}</p>
        <h1 className="mt-1 text-[26px] font-bold tracking-[-0.3px] text-gray-900">{access.student.name}</h1>
        <p className="mt-1 text-sm text-gray-500">You can open this report until {formatDate(state.effectiveExpiresAt)}.</p>
      </div>

      <p className="mb-3 text-sm text-gray-600">
        {groups.length} practice set{groups.length === 1 ? "" : "s"} finished · each row shows the last attempt; open it to see the latest tries.
      </p>
      {groups.length === 0 ? (
        <Card><p className="p-8 text-center text-sm text-gray-400">No practice sets finished in these subjects yet.</p></Card>
      ) : (
        <div className="space-y-5">
          {reports.map((report) => (
            <SkillResults key={report.practiceArea} report={report} id={`skills-${report.practiceArea}`} />
          ))}
          <PracticeSetAttemptsAccordion sets={groups} />
        </div>
      )}

      <Link href="/login" className="mt-6 inline-block text-sm text-blue-600 hover:underline">Go to sign in</Link>
    </div>
  );
}
