import { PageShell } from "@/components/sat";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import Link from "next/link";
import { notFound } from "next/navigation";
import { formatDate } from "@/lib/utils";
import { summarizeAllQuestionAnswers } from "@/lib/weighted-score";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Lock, ChevronLeft } from "lucide-react";
import { refreshAssignmentStates } from "@/lib/assignments";
import { practiceAreaLabel, resolvePracticeArea } from "@/lib/practice-area";

interface PageProps {
  params: Promise<{ topicId: string; difficulty: string }>;
  searchParams: Promise<{ area?: string }>;
}

export default async function TopicPracticeSetsPage({ params, searchParams }: PageProps) {
  const { topicId, difficulty } = await params;
  const query = await searchParams;
  const area = query.area === "reading" || query.area === "writing" || query.area === "mocks" ? query.area : "math";
  const session = await auth();
  const userId = session!.user.id;
  const diffUpper = difficulty.toUpperCase() as "EASY" | "MEDIUM" | "HARD";
  await refreshAssignmentStates();

  const topic = await prisma.topic.findUnique({
    where: { id: topicId },
    include: { domain: { include: { section: true } } },
  });
  if (!topic) notFound();

  const practiceSets = await prisma.practiceSet.findMany({
    where: { topicId, difficulty: diffUpper, status: "PUBLISHED" },
    include: {
      questions: true,
      assignments: {
        where: { studentId: userId },
        include: {
          unlockRequests: { where: { status: "PENDING" }, select: { id: true } },
          attempts: {
            orderBy: { startedAt: "desc" },
            include: { answers: true },
          },
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  const diffColor = { EASY: "easy", MEDIUM: "medium", HARD: "hard" } as const;

  return (
    <PageShell width="narrow">
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-6">
        <Link href={`/student/content-map?area=${area}`} className="hover:text-blue-600 flex items-center gap-1">
          <ChevronLeft size={14} /> Content Map
        </Link>
        <span>/</span>
        <span>{practiceAreaLabel(resolvePracticeArea({
          practiceArea: topic.domain.practiceArea,
          sectionName: topic.domain.section.name,
          sectionLabel: topic.domain.section.label,
          domainName: topic.domain.name,
        }))}</span>
        <span>/</span>
        <span>{topic.domain.name}</span>
        <span>/</span>
        <span className="font-medium text-gray-900">{topic.name}</span>
      </div>

      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold text-gray-900">
          {topic.name} — {diffUpper.charAt(0) + diffUpper.slice(1).toLowerCase()}
        </h1>
        <Badge variant={diffColor[diffUpper]}>{diffUpper}</Badge>
      </div>

      {practiceSets.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <p>No practice sets available for this topic and difficulty.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {practiceSets.map((ps) => {
            const assignment = ps.assignments[0];
            const scheduledLocked = assignment?.unlockAt ? assignment.unlockAt > new Date() : false;
            const locked = !assignment || assignment.locked || scheduledLocked;
            const inProgressAttempt = assignment?.attempts.find((attempt) => attempt.status === "IN_PROGRESS");
            const lastAttempt = assignment?.attempts.find((attempt) => attempt.status === "SUBMITTED");
            // Invalidated attempts no longer count, not even in the attempt number shown.
            const attemptCount = assignment?.attempts.filter((attempt) => attempt.status !== "INVALIDATED").length ?? 0;

            const lastScore = lastAttempt ? summarizeAllQuestionAnswers(lastAttempt.answers) : null;
            const correct = lastScore?.correct ?? 0;
            const answered = lastScore?.total ?? 0;
            const total = ps.questions.length;
            const pct = lastScore?.percent ?? null;

            return (
              <Card
                key={ps.id}
                className="px-5 py-4"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{ps.name}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      {total} questions
                      {attemptCount > 0 && (
                        <span className="ml-2">· Attempts: {attemptCount}</span>
                      )}
                      {pct !== null && (
                        <span className="ml-2">
                          · Last: {correct}/{answered} answered ({pct}%)
                        </span>
                      )}
                      {lastAttempt?.submittedAt && (
                        <span className="ml-2 text-gray-400">
                          · {formatDate(lastAttempt.submittedAt)}
                        </span>
                      )}
                    </p>
                  </div>

                  {locked ? (
                    <div className="flex flex-col items-end gap-1 text-xs text-gray-400">
                      <div className="flex items-center gap-2">
                        <Lock size={14} />
                        <span>{scheduledLocked && assignment?.unlockAt ? `Unlocks ${formatDate(assignment.unlockAt)}` : "Locked"}</span>
                      </div>
                      {assignment?.unlockRequests.length ? <span>Pending teacher review</span> : null}
                    </div>
                  ) : inProgressAttempt ? (
                    <Link
                      href={`/student/practice/assignment/${assignment.id}?area=${area}`}
                      className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
                    >
                      Resume
                    </Link>
                  ) : lastAttempt ? (
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/student/results/${lastAttempt.id}?area=${area}`}
                        className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                      >
                        Review
                      </Link>
                      <Link
                        href={`/student/practice/assignment/${assignment.id}?area=${area}`}
                        className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
                      >
                        Start
                      </Link>
                    </div>
                  ) : (
                    <Link
                      href={`/student/practice/assignment/${assignment!.id}?area=${area}`}
                      className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
                    >
                      Start
                    </Link>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </PageShell>
  );
}
