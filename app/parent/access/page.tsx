import Link from "next/link";
import prisma from "@/lib/prisma";
import { formatDate } from "@/lib/utils";
import { summarizeAllQuestionAnswers } from "@/lib/weighted-score";
import { Card } from "@/components/ui/card";
import {
  accessWindow,
  areasLabel,
  classifyPracticeSetArea,
  parseAreas,
  practiceSetAreaLabel,
  practiceSetMatchesArea,
} from "@/lib/parent-access";
import { hashPublicToken } from "@/lib/token-security";
import { writeAudit } from "@/lib/audit";
import { InlineError } from "@/components/sat/alert";
import { shortSetName } from "@/lib/student-report";

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

  const totalAnswers = attempts.flatMap((attempt) => attempt.answers);
  const score = summarizeAllQuestionAnswers(totalAnswers);

  return (
    <div className="mx-auto max-w-[var(--sat-page-wide)] px-4 py-8">
      <div className="mb-6">
        <p className="text-xs font-medium uppercase text-gray-400">Progress report · {areasLabel(areas)}</p>
        <h1 className="mt-1 text-[26px] font-bold tracking-[-0.3px] text-gray-900">{access.student.name}</h1>
        <p className="mt-1 text-sm text-gray-500">You can open this report until {formatDate(state.effectiveExpiresAt)}.</p>
      </div>

      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <Metric label="Practice sets finished" value={attempts.length.toString()} />
        <Metric label="Total questions" value={score.total.toString()} />
        <Metric label="Questions correct" value={score.percent !== null ? `${score.percent}%` : "—"} />
      </div>

      <Card>
        {attempts.map((attempt) => {
          const attemptScore = summarizeAllQuestionAnswers(attempt.answers);
          const attemptCorrect = attemptScore.correct;
          const total = attemptScore.total;
          return (
            <div key={attempt.id} className="border-b border-gray-100 px-4 py-3 last:border-b-0">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-gray-900">{attempt.assignment?.practiceSet.name ? shortSetName(attempt.assignment.practiceSet.name) : "Practice set"}</p>
                  <p className="mt-0.5 text-xs text-gray-500">
                    {practiceSetAreaLabel(classifyPracticeSetArea({
                      practiceArea: attempt.assignment?.practiceSet.topic.domain.practiceArea,
                      sectionName: attempt.assignment?.practiceSet.topic.domain.section.name,
                    })) ?? attempt.assignment?.practiceSet.topic.domain.section.label} · {attempt.assignment?.practiceSet.topic.name}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-gray-900">{attemptCorrect} of {total} correct ({attemptScore.percent ?? 0}%)</p>
                  <p className="text-xs text-gray-400">{attempt.submittedAt ? formatDate(attempt.submittedAt) : ""}</p>
                </div>
              </div>
            </div>
          );
        })}
        {attempts.length === 0 && <p className="p-8 text-center text-sm text-gray-400">No practice sets finished in these subjects yet.</p>}
      </Card>

      <Link href="/login" className="mt-6 inline-block text-sm text-blue-600 hover:underline">Go to sign in</Link>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <Card padding="md">
      <p className="text-xs font-medium uppercase text-gray-400">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-gray-900">{value}</p>
    </Card>
  );
}
