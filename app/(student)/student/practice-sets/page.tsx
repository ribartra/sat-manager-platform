import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { formatDate, scorePercent } from "@/lib/utils";
import { refreshAssignmentStates } from "@/lib/assignments";

export default async function StudentPracticeSetsPage() {
  const session = await auth();
  await refreshAssignmentStates();

  const assignments = await prisma.assignment.findMany({
    where: { studentId: session!.user.id },
    include: {
      practiceSet: {
        include: {
          topic: { include: { domain: { include: { section: true } } } },
          questions: { select: { questionId: true } },
        },
      },
      attempts: {
        include: { answers: true },
        orderBy: { startedAt: "desc" },
      },
    },
    orderBy: [{ status: "asc" }, { dueDate: "asc" }, { createdAt: "desc" }],
  });

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Practice Sets</h1>
          <p className="mt-1 text-sm text-gray-500">Assigned skill practice, separate from Exams.</p>
        </div>
        <Link href="/student/content-map" className="rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
          Content Map
        </Link>
      </div>

      <div className="space-y-3">
        {assignments.map((assignment) => {
          const inProgressAttempt = assignment.attempts.find((item) => item.status === "IN_PROGRESS");
          const submittedAttempt = assignment.attempts.find((item) => item.status === "SUBMITTED");
          const correct = submittedAttempt?.answers.filter((answer) => answer.isCorrect).length ?? 0;
          const total = assignment.practiceSet.questions.length;
          const pct = submittedAttempt ? scorePercent(correct, submittedAttempt.answers.length || total) : null;
          const inProgressAnswered = inProgressAttempt
            ? inProgressAttempt.answers.filter((answer) => Boolean((answer.answer ?? "").trim())).length
            : 0;
          const inProgressPct = inProgressAttempt ? scorePercent(inProgressAnswered, total) : null;
          const locked =
            assignment.locked ||
            (assignment.unlockAt !== null && assignment.unlockAt > new Date());

          return (
            <Card key={assignment.id} className="flex items-center justify-between gap-4 px-4 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-gray-900">{assignment.practiceSet.name}</p>
                <p className="mt-0.5 text-xs text-gray-500">
                  {assignment.practiceSet.topic.domain.section.label} / {assignment.practiceSet.topic.domain.name} / {assignment.practiceSet.topic.name}
                  {assignment.dueDate ? <span className="ml-2 text-amber-600">Due {formatDate(assignment.dueDate)}</span> : null}
                </p>
                {inProgressAttempt && (
                  <p className="mt-1 text-xs text-gray-600">
                    Progress {inProgressPct}% ({inProgressAnswered}/{total}) · Question{" "}
                    {Math.min(inProgressAttempt.currentQuestion + 1, Math.max(total, 1))} of {total}
                  </p>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Badge variant={assignment.practiceSet.difficulty === "EASY" ? "easy" : assignment.practiceSet.difficulty === "MEDIUM" ? "medium" : "hard"}>
                  {assignment.practiceSet.difficulty}
                </Badge>
                <Badge variant={assignment.status === "COMPLETED" ? "success" : assignment.status === "OVERDUE" ? "danger" : "warning"}>
                  {assignment.status}
                </Badge>
                {pct !== null && <span className="text-sm font-medium text-gray-800">{pct}%</span>}
                {locked ? (
                  <span className="rounded-md border border-gray-200 px-3 py-1.5 text-sm text-gray-400">Locked</span>
                ) : inProgressAttempt ? (
                  <Link href={`/student/practice/assignment/${assignment.id}`} className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700">
                    Resume
                  </Link>
                ) : submittedAttempt ? (
                  <Link href={`/student/results/${submittedAttempt.id}`} className="text-sm font-medium text-blue-600 hover:underline">Review</Link>
                ) : (
                  <Link href={`/student/practice/assignment/${assignment.id}`} className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700">
                    Start
                  </Link>
                )}
              </div>
            </Card>
          );
        })}
        {assignments.length === 0 && (
          <Card padding="lg" className="text-center text-sm text-gray-400">
            No Practice Sets assigned yet.
          </Card>
        )}
      </div>
    </div>
  );
}
