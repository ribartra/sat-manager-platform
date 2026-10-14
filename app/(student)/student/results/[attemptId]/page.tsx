import { InvalidatedNotice, PageShell, VoidableValue } from "@/components/sat";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { formatDate, formatDuration, formatTime } from "@/lib/utils";
import { shortSetName } from "@/lib/student-report";
import { scoreBandTextClass } from "@/lib/score-band";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { MathContent } from "@/components/math-content";
import { OptionContent } from "@/components/option-content";
import { QuestionMedia } from "@/components/question-media";
import { CheckCircle, XCircle, MinusCircle, ChevronLeft, RotateCcw } from "lucide-react";
import { parseSnapshot, PracticeSetSnapshot, QuestionSnapshot } from "@/lib/attempt-snapshots";
import { formatCorrectAnswer } from "@/lib/answer-grading";
import { resolveQuestionType, isAnswerOption } from "@/lib/question-type";
import { difficultyBadgeVariant, difficultyLabel } from "@/lib/domain-meta";
import { isAnsweredAnswer, summarizeAllQuestionAnswers } from "@/lib/weighted-score";
import { Alert } from "@/components/sat/alert";

interface PageProps {
  params: Promise<{ attemptId: string }>;
  searchParams: Promise<{ area?: string; topic?: string; difficulty?: string; from?: string; to?: string }>;
}

export default async function ResultsPage({ params, searchParams }: PageProps) {
  const { attemptId } = await params;
  const session = await auth();
  if (!session) redirect("/login");
  const userId = session.user.id;
  const query = await searchParams;
  const returnQuery = new URLSearchParams();
  for (const key of ["area", "topic", "difficulty", "from", "to"] as const) {
    if (query[key]) returnQuery.set(key, query[key]!);
  }
  const historyHref = returnQuery.toString() ? `/student/history?${returnQuery.toString()}` : "/student/history";

  const attempt = await prisma.attempt.findFirst({
    where: { id: attemptId, studentId: userId, status: { in: ["SUBMITTED", "INVALIDATED"] } },
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
          practiceSet: { include: { topic: { include: { domain: { include: { section: true } } } } } },
        },
      },
      pauses: true,
    },
  });

  if (!attempt) notFound();

  const practiceSet = attempt.assignment?.practiceSet;
  const practiceSetSnapshot = parseSnapshot<PracticeSetSnapshot>(attempt.practiceSetSnapshot);
  const psQuestions = await prisma.practiceSetQuestion.findMany({
    where: { practiceSetId: attempt.practiceSetId },
    orderBy: { order: "asc" },
  });

  const snapshotQuestionOrder = practiceSetSnapshot?.questions?.map((question) => question.id) ?? [];
  const totalQuestions = snapshotQuestionOrder.length || psQuestions.length;
  const scoreRows = attempt.answers.length >= totalQuestions
    ? attempt.answers
    : [...attempt.answers, ...Array.from({ length: totalQuestions - attempt.answers.length }, () => ({ answer: null, isCorrect: false }))];
  const score = summarizeAllQuestionAnswers(scoreRows);
  const correct = score.correct;
  const answeredTotal = attempt.answers.filter(isAnsweredAnswer).length;
  const incorrect = attempt.answers.filter((a) => a.answer?.trim() && !a.isCorrect).length;
  const unanswered = Math.max(0, totalQuestions - answeredTotal);
  const pct = score.percent ?? 0;
  const completedPauses = attempt.pauses.filter((pause) => pause.durationSeconds !== null);
  const pauseSeconds = completedPauses.reduce((sum, pause) => sum + (pause.durationSeconds ?? 0), 0);

  const explanationVisibility =
    practiceSetSnapshot?.explanationVisibility ?? practiceSet?.explanationVisibility ?? "HIDDEN";
  const canRevealSolutions =
    explanationVisibility === "IMMEDIATE" ||
    (explanationVisibility === "AFTER_FINISH" && attempt.status === "SUBMITTED");

  const answersMap: Record<string, typeof attempt.answers[0]> = {};
  attempt.answers.forEach((a) => { answersMap[a.questionId] = a; });

  const orderedQuestionIds = snapshotQuestionOrder.length
    ? snapshotQuestionOrder
    : psQuestions.map((psq) => psq.questionId);
  const orderedAnswers = orderedQuestionIds.map((questionId) => answersMap[questionId]).filter(Boolean);

  const displayPct = pct;

  return (
    <PageShell width="narrow">
      {/* Back */}
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-6">
        <Link href={historyHref} className="hover:text-blue-600 flex items-center gap-1">
          <ChevronLeft size={14} /> History
        </Link>
      </div>

      {attempt.status === "INVALIDATED" ? <InvalidatedNotice audience="student" /> : null}
      {/* Score header */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 mb-6">
        <h1 className="text-lg font-semibold text-gray-900 mb-1">
          {shortSetName(practiceSetSnapshot?.name ?? practiceSet?.name ?? "Practice set")}
        </h1>
        <p className="text-xs text-gray-400 mb-4">
          Try {attempt.attemptNumber}{attempt.submittedAt ? ` · ${formatDate(attempt.submittedAt)}` : ""}
        </p>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="text-center">
            <p className="text-3xl font-bold text-gray-900"><VoidableValue status={attempt.status}>{correct}/{totalQuestions}</VoidableValue></p>
            <p className="text-xs text-gray-500 mt-0.5">Correct answers</p>
          </div>
          <div className="text-center">
            <p className={`text-3xl font-bold ${scoreBandTextClass(displayPct)}`}>
              <VoidableValue status={attempt.status}>{displayPct}%</VoidableValue>
            </p>
            <p className="text-xs text-gray-500 mt-0.5">Score</p>
          </div>
          <div className="text-center">
            <p className="text-3xl font-bold text-gray-900">{attempt.totalTime ? formatDuration(attempt.totalTime) : "—"}</p>
            <p className="text-xs text-gray-500 mt-0.5">Time</p>
          </div>
          <div className="text-center">
            <p className="text-sm">
              <span className="text-green-600">{correct} right</span>
              {" · "}
              <span className="text-red-500">{incorrect} wrong</span>
              {" · "}
              <span className="text-gray-500">{unanswered} blank</span>
            </p>
            <p className="text-xs text-gray-500 mt-0.5">Your answers</p>
          </div>
        </div>

        {attempt.pauses.length > 0 && (
          <Alert tone="note" className="mt-4 text-xs">
            Paused {attempt.pauses.length} time{attempt.pauses.length === 1 ? "" : "s"}
            {pauseSeconds > 0 ? ` (${formatDuration(pauseSeconds)})` : ""}
          </Alert>
        )}

        <div className="mt-5 flex items-center gap-3">
          <Link
            href={attempt.assignmentId ? `/student/practice/assignment/${attempt.assignmentId}${returnQuery.toString() ? `?${returnQuery.toString()}` : ""}` : "/student/practice-sets"}
            className="flex items-center gap-1.5 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            <RotateCcw size={14} /> Try Again
          </Link>
          <Link
            href={returnQuery.toString() ? `/student?${returnQuery.toString()}` : "/student"}
            className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            ← Home
          </Link>
        </div>
      </div>

      {attempt.teacherComment && (
        <Card variant="info" padding="md" className="mb-6 text-sm text-blue-900">
          <p className="mb-1 font-medium">Note from your teacher</p>
          <p>{attempt.teacherComment}</p>
        </Card>
      )}

      {/* Per-question review */}
      <div>
        <h2 className="text-base font-semibold text-gray-900 mb-3">Your answers, question by question</h2>
        {!canRevealSolutions && (
          <p className="mb-3 rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-500">
            Your teacher has hidden the answers for this set.
          </p>
        )}
        <div className="space-y-4">
          {orderedAnswers.map((ans, i) => {
            if (!ans) return null;
            const snapshot = parseSnapshot<QuestionSnapshot>(ans.questionSnapshot);
            const question = snapshot ?? ans.question;
            const options = snapshot?.options?.length ? snapshot.options : ans.question.options;
            const responseType = resolveQuestionType(question.type, options);
            const topicName = snapshot?.topic?.name ?? ans.question.topic.name;
            const isUnanswered = !ans.answer;
            const isCorrect = ans.isCorrect;
            const statusClass = !canRevealSolutions
              ? isUnanswered
                ? "border-gray-200 bg-gray-50"
                : "border-blue-100 bg-blue-50"
              : isCorrect
              ? "border-green-200 bg-green-50"
              : isUnanswered
              ? "border-gray-200 bg-gray-50"
              : "border-red-200 bg-red-50";

            return (
              <Card key={ans.id} padding="md" className={statusClass}>
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-500">Question {i + 1}</span>
                      {isUnanswered ? (
                        <MinusCircle size={16} className="text-gray-400" />
                      ) : canRevealSolutions && isCorrect ? (
                        <CheckCircle size={16} className="text-green-600" />
                      ) : canRevealSolutions ? (
                        <XCircle size={16} className="text-red-500" />
                      ) : (
                        <span className="h-4 w-4 rounded-full border border-blue-300 bg-white" />
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={difficultyBadgeVariant(question.difficulty)}>
                        {difficultyLabel(question.difficulty)}
                      </Badge>
                      {ans.timeSpent !== null && (
                        <span className="text-xs text-gray-500">{formatTime(ans.timeSpent)}</span>
                      )}
                      <span className="text-xs text-gray-500">{topicName}</span>
                    </div>
                  </div>

                  <MathContent content={question.stem} className="text-sm text-gray-800 mb-3" />
                  <QuestionMedia imageUrl={question.imageUrl} alt={`Question ${i + 1} image`} className="mb-3" />

                  {responseType === "MC" && (
                    <div className="space-y-1 mb-3">
                      {options.filter(isAnswerOption).map((opt) => {
                        const studentPick = ans.answer === opt.label;
                        const isRight = canRevealSolutions && question.correctAnswer === opt.label;
                        const optionClass = isRight
                          ? "bg-green-100 text-green-800"
                          : studentPick && canRevealSolutions
                          ? "bg-red-100 text-red-700 line-through"
                          : studentPick
                          ? "bg-blue-100 text-blue-800"
                          : "text-gray-600";
                        return (
                          <div key={opt.label} className={`flex items-start gap-2 text-sm px-2 py-1 rounded ${optionClass}`}>
                            <span className="font-medium w-4">{opt.label})</span>
                            <span className="min-w-0 flex-1">
                              <OptionContent text={opt.text} imageUrl={opt.imageUrl} label={opt.label} />
                            </span>
                          </div>
            );
          })}
                    </div>
                  )}

                  {responseType === "NUMERIC" && (
                    <div className="mb-3 flex flex-wrap gap-4 text-sm">
                      <span className="text-gray-600">Your answer: <span className="font-medium text-gray-900">{ans.answer || "—"}</span></span>
                      {canRevealSolutions && (
                        <span className={isCorrect ? "text-green-700" : "text-red-700"}>
                          Correct answer: <span className="font-medium">{formatCorrectAnswer(question.correctAnswer)}</span>
                        </span>
                      )}
                    </div>
                  )}

                  {isUnanswered && (
                    <p className="text-xs text-gray-400 italic">You left this blank.</p>
                  )}

                  {(ans.markedForReview || ans.note || ans.eliminatedOptions) && (
                    <div className="mt-2 rounded border border-gray-200 bg-white p-2 text-xs text-gray-600">
                      {ans.markedForReview && <p className="font-medium text-amber-700">Marked for review</p>}
                      {ans.note && <p className="mt-1">Your note: {ans.note}</p>}
                      {ans.eliminatedOptions && (
                        <p className="mt-1">Crossed out: {JSON.parse(ans.eliminatedOptions).join(", ")}</p>
                      )}
                    </div>
                  )}

                  {canRevealSolutions && !isUnanswered && question.explanation && (
                    <div className="mt-2 pt-2 border-t border-gray-200">
                      <p className="text-xs font-medium text-gray-500 mb-1">Explanation</p>
                      <MathContent content={question.explanation} className="text-sm text-gray-700" />
                    </div>
                  )}
              </Card>
              );
          })}
        </div>
      </div>
    </PageShell>
  );
}
