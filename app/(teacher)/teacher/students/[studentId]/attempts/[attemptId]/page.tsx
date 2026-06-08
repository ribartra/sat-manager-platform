import prisma from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { MathContent } from "@/components/math-content";
import { formatDate, formatTime, scorePercent } from "@/lib/utils";
import { ChevronLeft } from "lucide-react";
import { AttemptActions } from "./attempt-actions-client";

interface PageProps {
  params: Promise<{ studentId: string; attemptId: string }>;
}

export default async function TeacherAttemptDetailPage({ params }: PageProps) {
  const { studentId, attemptId } = await params;
  const attempt = await prisma.attempt.findFirst({
    where: { id: attemptId, studentId },
    include: {
      student: true,
      answers: { include: { question: { include: { topic: true } } } },
      assignment: { include: { practiceSet: true } },
    },
  });

  if (!attempt) notFound();

  const psQuestions = await prisma.practiceSetQuestion.findMany({
    where: { practiceSetId: attempt.practiceSetId },
    include: { question: { include: { options: { orderBy: { label: "asc" } }, topic: true } } },
    orderBy: { order: "asc" },
  });
  const answersByQuestion = new Map(attempt.answers.map((a) => [a.questionId, a]));
  const correct = attempt.answers.filter((a) => a.isCorrect).length;
  const total = psQuestions.length;
  const pct = scorePercent(correct, total);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-6 flex items-center gap-2 text-sm text-gray-500">
        <Link href={`/teacher/students/${studentId}`} className="flex items-center gap-1 hover:text-blue-600">
          <ChevronLeft size={14} /> {attempt.student.name}
        </Link>
        <span>/</span>
        <span className="font-medium text-gray-900">{attempt.assignment?.practiceSet.name ?? "Practice Set"}</span>
      </div>

      <div className="mb-6 flex items-start justify-between rounded-lg border border-gray-200 bg-white p-5">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Attempt #{attempt.attemptNumber}</h1>
          <p className="mt-1 text-sm text-gray-500">
            {attempt.submittedAt ? formatDate(attempt.submittedAt) : "Not submitted"} · {attempt.totalTime ? formatTime(attempt.totalTime) : "No time"}
          </p>
          <div className="mt-3 flex items-center gap-2">
            <Badge variant={attempt.status === "SUBMITTED" ? "success" : attempt.status === "INVALIDATED" ? "danger" : "warning"}>
              {attempt.status}
            </Badge>
            <span className="text-sm font-semibold text-gray-900">
              {correct}/{total} ({pct}%)
            </span>
          </div>
        </div>
        <AttemptActions attemptId={attempt.id} initialComment={attempt.teacherComment} />
      </div>

      {attempt.teacherComment && (
        <div className="mb-6 rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
          <p className="mb-1 font-medium">Teacher comment</p>
          <p>{attempt.teacherComment}</p>
        </div>
      )}

      <div className="rounded-lg border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="px-4 py-3 text-left font-medium text-gray-500">Q</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">Question</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">Answer</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">Correct</th>
              <th className="px-4 py-3 text-right font-medium text-gray-500">Time</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {psQuestions.map((item, index) => {
              const ans = answersByQuestion.get(item.questionId);
              return (
                <tr key={item.questionId}>
                  <td className="px-4 py-3 text-gray-500">{index + 1}</td>
                  <td className="max-w-md px-4 py-3">
                    <MathContent content={item.question.stem} className="text-sm text-gray-800" />
                    <p className="mt-1 text-xs text-gray-400">{item.question.topic.name} · {item.question.difficulty}</p>
                  </td>
                  <td className="px-4 py-3 text-gray-700">{ans?.answer ?? "Blank"}</td>
                  <td className="px-4 py-3">
                    {ans?.answer ? (
                      ans.isCorrect ? <span className="text-green-600">Correct</span> : <span className="text-red-600">Wrong ({item.question.correctAnswer})</span>
                    ) : (
                      <span className="text-gray-400">Unanswered</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-500">{ans?.timeSpent ? formatTime(ans.timeSpent) : "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
