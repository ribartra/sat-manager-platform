import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";
import { formatDate, formatTime, scorePercent } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { MathContent } from "@/components/math-content";
import { CheckCircle, XCircle, MinusCircle, ChevronLeft, RotateCcw } from "lucide-react";

interface PageProps {
  params: Promise<{ attemptId: string }>;
}

export default async function ResultsPage({ params }: PageProps) {
  const { attemptId } = await params;
  const session = await auth();
  const userId = session!.user.id;

  const attempt = await prisma.attempt.findFirst({
    where: { id: attemptId, studentId: userId, status: "SUBMITTED" },
    include: {
      answers: {
        include: {
          question: {
            include: {
              options: { orderBy: { label: "asc" } },
              topic: { include: { domain: true } },
            },
          },
        },
      },
      assignment: {
        include: {
          practiceSet: { include: { topic: true } },
        },
      },
    },
  });

  if (!attempt) notFound();

  const practiceSet = attempt.assignment?.practiceSet;
  const psQuestions = await prisma.practiceSetQuestion.findMany({
    where: { practiceSetId: attempt.practiceSetId },
    orderBy: { order: "asc" },
  });

  const totalQuestions = psQuestions.length;
  const correct = attempt.answers.filter((a) => a.isCorrect).length;
  const incorrect = attempt.answers.filter((a) => !a.isCorrect && a.answer !== null).length;
  const unanswered = totalQuestions - correct - incorrect;
  const pct = scorePercent(correct, totalQuestions);

  // Check if explanations are visible
  const psDetail = await prisma.practiceSet.findUnique({ where: { id: attempt.practiceSetId } });
  const showExplanations = psDetail?.explanationVisibility !== "HIDDEN";

  const answersMap: Record<string, typeof attempt.answers[0]> = {};
  attempt.answers.forEach((a) => { answersMap[a.questionId] = a; });

  const orderedAnswers = psQuestions.map((psq) => answersMap[psq.questionId]).filter(Boolean);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      {/* Back */}
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-6">
        <Link href="/student/history" className="hover:text-blue-600 flex items-center gap-1">
          <ChevronLeft size={14} /> History
        </Link>
      </div>

      {/* Score header */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 mb-6">
        <h1 className="text-lg font-semibold text-gray-900 mb-1">
          {practiceSet?.name ?? "Practice Set"}
        </h1>
        <p className="text-xs text-gray-400 mb-4">
          Attempt #{attempt.attemptNumber} · {attempt.submittedAt ? formatDate(attempt.submittedAt) : ""}
        </p>

        <div className="grid grid-cols-4 gap-4">
          <div className="text-center">
            <p className="text-3xl font-bold text-gray-900">{correct}/{totalQuestions}</p>
            <p className="text-xs text-gray-500 mt-0.5">Score</p>
          </div>
          <div className="text-center">
            <p className={`text-3xl font-bold ${pct >= 80 ? "text-green-600" : pct >= 60 ? "text-yellow-600" : "text-red-600"}`}>
              {pct}%
            </p>
            <p className="text-xs text-gray-500 mt-0.5">Percent</p>
          </div>
          <div className="text-center">
            <p className="text-3xl font-bold text-gray-900">{attempt.totalTime ? formatTime(attempt.totalTime) : "—"}</p>
            <p className="text-xs text-gray-500 mt-0.5">Time</p>
          </div>
          <div className="text-center">
            <div className="flex justify-center gap-2 text-sm">
              <span className="text-green-600">✓ {correct}</span>
              <span className="text-red-500">✗ {incorrect}</span>
              <span className="text-gray-400">– {unanswered}</span>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">Breakdown</p>
          </div>
        </div>

        <div className="mt-5 flex items-center gap-3">
          <Link
            href={`/student/practice/${attempt.practiceSetId}${attempt.assignmentId ? `?assignmentId=${attempt.assignmentId}` : ""}`}
            className="flex items-center gap-1.5 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            <RotateCcw size={14} /> Try Again
          </Link>
          <Link
            href="/student"
            className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            ← Dashboard
          </Link>
        </div>
      </div>

      {attempt.teacherComment && (
        <div className="mb-6 rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
          <p className="mb-1 font-medium">Teacher comment</p>
          <p>{attempt.teacherComment}</p>
        </div>
      )}

      {/* Per-question review */}
      {showExplanations && (
        <div>
          <h2 className="text-base font-semibold text-gray-900 mb-3">Question Review</h2>
          <div className="space-y-4">
            {orderedAnswers.map((ans, i) => {
              if (!ans) return null;
              const { question } = ans;
              const isUnanswered = !ans.answer;
              const isCorrect = ans.isCorrect;

              return (
                <div key={ans.id} className={`rounded-lg border p-4 ${isCorrect ? "border-green-200 bg-green-50" : isUnanswered ? "border-gray-200 bg-gray-50" : "border-red-200 bg-red-50"}`}>
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-500">Q{i + 1}</span>
                      {isUnanswered ? (
                        <MinusCircle size={16} className="text-gray-400" />
                      ) : isCorrect ? (
                        <CheckCircle size={16} className="text-green-600" />
                      ) : (
                        <XCircle size={16} className="text-red-500" />
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={question.difficulty === "EASY" ? "easy" : question.difficulty === "MEDIUM" ? "medium" : "hard"}>
                        {question.difficulty}
                      </Badge>
                      {ans.timeSpent !== null && (
                        <span className="text-xs text-gray-500">{formatTime(ans.timeSpent)}</span>
                      )}
                      <span className="text-xs text-gray-500">{question.topic.name}</span>
                    </div>
                  </div>

                  <MathContent content={question.stem} className="text-sm text-gray-800 mb-3" />

                  {question.type === "MC" && (
                    <div className="space-y-1 mb-3">
                      {question.options.map((opt) => {
                        const studentPick = ans.answer === opt.label;
                        const isRight = question.correctAnswer === opt.label;
                        return (
                          <div key={opt.label} className={`flex items-center gap-2 text-sm px-2 py-1 rounded ${isRight ? "bg-green-100 text-green-800" : studentPick && !isRight ? "bg-red-100 text-red-700 line-through" : "text-gray-600"}`}>
                            <span className="font-medium w-4">{opt.label})</span>
                            <MathContent content={opt.text} />
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {isUnanswered && (
                    <p className="text-xs text-gray-400 italic">Unanswered — no explanation shown</p>
                  )}

                  {(ans.markedForReview || ans.note || ans.eliminatedOptions) && (
                    <div className="mt-2 rounded border border-gray-200 bg-white p-2 text-xs text-gray-600">
                      {ans.markedForReview && <p className="font-medium text-amber-700">Marked for review</p>}
                      {ans.note && <p className="mt-1">Note: {ans.note}</p>}
                      {ans.eliminatedOptions && (
                        <p className="mt-1">Eliminated: {JSON.parse(ans.eliminatedOptions).join(", ")}</p>
                      )}
                    </div>
                  )}

                  {!isUnanswered && question.explanation && (
                    <div className="mt-2 pt-2 border-t border-gray-200">
                      <p className="text-xs font-medium text-gray-500 mb-1">Explanation</p>
                      <MathContent content={question.explanation} className="text-sm text-gray-700" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
