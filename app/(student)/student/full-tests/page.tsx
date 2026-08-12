import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { formatDate } from "@/lib/utils";
import { fullTestAttemptProgress } from "@/lib/attempt-progress";
import { parseFullTestProgressState } from "@/lib/full-test-progress";

export default async function StudentFullTestsPage() {
  const session = await auth();
  const assignments = await prisma.fullPracticeTestAssignment.findMany({
    where: { studentId: session!.user.id },
    include: {
      test: {
        include: {
          modules: {
            include: { questions: { select: { questionId: true } } },
            orderBy: { order: "asc" },
          },
        },
      },
      attempts: {
        orderBy: { startedAt: "desc" },
        take: 1,
        include: { answers: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-900">Exams</h1>
        <p className="mt-1 text-sm text-gray-500">Full Practice Tests with SAT-style modules and scoring.</p>
      </div>
      <div className="space-y-3">
        {assignments.map((assignment) => {
          const attempt = assignment.attempts[0];
          const progress =
            attempt && attempt.status === "IN_PROGRESS"
              ? fullTestAttemptProgress({
                  modules: assignment.test.modules.map((module) => ({
                    name: module.name,
                    section: module.section,
                    questionIds: module.questions.map((item) => item.questionId),
                  })),
                  answers: attempt.answers,
                  currentModule: attempt.currentModule,
                  currentQuestion: attempt.currentQuestion,
                  status: attempt.status,
                  phase: parseFullTestProgressState(attempt.moduleTimerState, assignment.test.modules.length)?.phase,
                })
              : null;

          return (
            <Card key={assignment.id} className="px-4 py-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900">{assignment.test.name}</p>
                  <p className="text-xs text-gray-500">
                    {assignment.dueDate ? `Due ${formatDate(assignment.dueDate)}` : "No due date"} · break{" "}
                    {assignment.test.breakMinutes} min
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {assignment.test.modules.map((module) => (
                      <span
                        key={module.id}
                        className="rounded border border-gray-200 px-1.5 py-0.5 text-[10px] text-gray-600"
                      >
                        {module.name.replace("Reading & Writing ", "RW ").replace("Module ", "M")} ·{" "}
                        {module.questions.length}Q · {Math.round(module.timeLimit / 60)}m
                      </span>
                    ))}
                  </div>
                  {progress && (
                    <div className="mt-2 space-y-1">
                      <p className="text-xs text-gray-700">
                        Progreso {progress.percent}% ({progress.answered}/{progress.total}) · {progress.positionLabel}
                      </p>
                      <div className="grid gap-1 sm:grid-cols-2">
                        {progress.modules.map((module) => (
                          <p key={module.moduleIndex} className="text-[11px] text-gray-500">
                            {module.name}: {module.answered}/{module.total} ({module.percent}%)
                          </p>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <Badge variant={assignment.status === "COMPLETED" ? "success" : "warning"}>
                    {assignment.status}
                  </Badge>
                  {attempt?.status === "SUBMITTED" ? (
                    <Link
                      href={`/student/full-tests/results/${attempt.id}`}
                      className="text-sm text-blue-600 hover:underline"
                    >
                      Review
                    </Link>
                  ) : (
                    <Link
                      href={`/student/full-tests/${assignment.id}`}
                      className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
                    >
                      {attempt ? "Continue" : "Start"}
                    </Link>
                  )}
                </div>
              </div>
            </Card>
          );
        })}
        {assignments.length === 0 && (
          <Card padding="lg" className="text-center text-sm text-gray-400">
            No Exams assigned.
          </Card>
        )}
      </div>
    </div>
  );
}
