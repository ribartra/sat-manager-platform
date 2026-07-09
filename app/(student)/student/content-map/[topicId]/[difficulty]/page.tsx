import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import Link from "next/link";
import { notFound } from "next/navigation";
import { formatDate, scorePercent } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Lock, ChevronLeft } from "lucide-react";
import { UnlockRequestButton } from "./unlock-request-client";
import { refreshAssignmentStates } from "@/lib/assignments";

interface PageProps {
  params: Promise<{ topicId: string; difficulty: string }>;
}

export default async function TopicPracticeSetsPage({ params }: PageProps) {
  const { topicId, difficulty } = await params;
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
            where: { status: "SUBMITTED" },
            orderBy: { submittedAt: "desc" },
            include: { answers: true },
          },
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  const diffColor = { EASY: "easy", MEDIUM: "medium", HARD: "hard" } as const;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-6">
        <Link href="/student/content-map" className="hover:text-blue-600 flex items-center gap-1">
          <ChevronLeft size={14} /> Content Map
        </Link>
        <span>/</span>
        <span>{topic.domain.section.label}</span>
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
            const lastAttempt = assignment?.attempts[0];
            const attemptCount = assignment?.attempts.length ?? 0;

            const correct = lastAttempt?.answers.filter((a) => a.isCorrect).length ?? 0;
            const total = ps.questions.length;
            const pct = lastAttempt ? scorePercent(correct, total) : null;

            return (
              <div
                key={ps.id}
                className="rounded-lg border border-gray-200 bg-white px-5 py-4"
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
                          · Last: {correct}/{total} ({pct}%)
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
                      {assignment && (
                        <UnlockRequestButton assignmentId={assignment.id} requested={assignment.unlockRequests.length > 0} />
                      )}
                    </div>
                  ) : lastAttempt ? (
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/student/results/${lastAttempt.id}`}
                        className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                      >
                        Review
                      </Link>
                      <Link
                        href={`/student/practice/assignment/${assignment.id}`}
                        className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
                      >
                        Try Again
                      </Link>
                    </div>
                  ) : (
                    <Link
                      href={`/student/practice/assignment/${assignment!.id}`}
                      className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
                    >
                      Start →
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
