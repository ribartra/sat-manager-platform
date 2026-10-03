import { InvalidatedNotice, PageShell, VoidableValue, isInvalidated } from "@/components/sat";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { notFound, redirect } from "next/navigation";
import { parseEliminatedOptions } from "@/lib/answer-review-meta";
import { formatTime, scorePercent } from "@/lib/utils";
import { MathContent } from "@/components/math-content";
import { QuestionMedia } from "@/components/question-media";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, MinusCircle, XCircle } from "lucide-react";
import { resolveQuestionType } from "@/lib/question-type";
import { formatCorrectAnswer } from "@/lib/answer-grading";
import { difficultyBadgeVariant } from "@/lib/domain-meta";
import { difficultyFromFullTestModuleKey, moduleKeyFromOrder } from "@/lib/full-test-modules";
import Link from "next/link";
import { fullTestModulesForAttempt } from "@/lib/full-test-snapshot";
import { overtimeByModule } from "@/lib/full-test-progress";
import { ChevronLeft } from "lucide-react";

interface PageProps { params: Promise<{ attemptId: string }>; searchParams: Promise<{ from?: string; to?: string }> }

/**
 * Digital SAT adaptive stage → difficulty is defined by MODULE, not by the source PDF
 * (which only labels modules). Convention: Module 1 = baseline, Module 2 = adaptive (harder).
 */
function moduleTierMeta(order: number) {
  const key = difficultyFromFullTestModuleKey(moduleKeyFromOrder(order)); // "EASY" | "HARD"
  return key === "HARD"
    ? { key, short: "Adaptive", bucket: "Adaptive (Module 2)" }
    : { key, short: "Baseline", bucket: "Baseline (Module 1)" };
}

export default async function FullTestResultsPage({ params, searchParams }: PageProps) {
  const { attemptId } = await params;
  const query = await searchParams;
  const historyHref = query.from || query.to
    ? `/student/history?area=mocks${query.from ? `&from=${encodeURIComponent(query.from)}` : ""}${query.to ? `&to=${encodeURIComponent(query.to)}` : ""}`
    : "/student/history?area=mocks";
  const session = await auth();
  const attempt = await prisma.fullPracticeTestAttempt.findFirst({
    where: { id: attemptId, studentId: session!.user.id },
    include: { test: { select: { name: true, reviewEnabled: true } }, answers: true, pauses: true },
  });
  if (!attempt) notFound();
  // Results exist only for a finished attempt; an open one goes back to the exam.
  if (attempt.status === "IN_PROGRESS") {
    redirect(attempt.assignmentId ? `/student/full-tests/${attempt.assignmentId}` : historyHref);
  }
  const invalidated = isInvalidated(attempt.status);
  // The exam as this attempt saw it (RNF-17 snapshot), not the live, possibly edited exam.
  const modules = await fullTestModulesForAttempt(attempt);

  const answersByQuestion = new Map(attempt.answers.map((answer) => [answer.questionId, answer]));
  const moduleStats = modules.map((module) => {
    const tier = moduleTierMeta(module.order);
    let correct = 0;
    let total = 0;
    let time = 0;
    for (const item of module.questions) {
      const answer = answersByQuestion.get(item.questionId);
      total += 1;
      if (answer?.isCorrect) correct += 1;
      time += answer?.timeSpent ?? 0;
    }
    return { id: module.id, name: module.name, hint: tier.short, correct, total, time };
  });
  const overtime = overtimeByModule(attempt.moduleTimerState, modules.length);
  const overtimeModules = modules
    .map((module, index) => ({ name: module.name, seconds: overtime[index] ?? 0 }))
    .filter((item) => item.seconds > 0);
  const pauseSeconds = attempt.pauses.reduce((sum, pause) => sum + (pause.durationSeconds ?? 0), 0);

  return (
    <PageShell width="narrow">
      <Link href={historyHref} className="mb-4 flex items-center gap-1 text-sm text-gray-500 hover:text-blue-600"><ChevronLeft size={14} /> History</Link>
      <h1 className="mb-6 text-xl font-semibold text-gray-900">Results: {attempt.test.name}</h1>
      {invalidated ? <InvalidatedNotice audience="student" /> : null}
      <div className="grid grid-cols-3 gap-4">
        <Card padding="md" className="text-center"><p className="text-3xl font-bold text-[var(--sat-area-mocks)]"><VoidableValue status={attempt.status}>{attempt.rwScore ?? "—"}</VoidableValue></p><p className="text-xs text-gray-500">Reading & Writing</p></Card>
        <Card padding="md" className="text-center"><p className="text-3xl font-bold text-[var(--sat-area-math)]"><VoidableValue status={attempt.status}>{attempt.mathScore ?? "—"}</VoidableValue></p><p className="text-xs text-gray-500">Math</p></Card>
        <Card padding="md" className="text-center"><p className="text-3xl font-bold text-[var(--sat-area-mocks)]"><VoidableValue status={attempt.status}>{attempt.totalScore ?? "—"}</VoidableValue></p><p className="text-xs text-gray-500">Total</p></Card>
      </div>
      <Card padding="md" className="mt-6 text-sm text-gray-600">
        Time ran out: {attempt.timeExpiredEvents === 0 ? "never" : `${attempt.timeExpiredEvents}x`} · Extra time used:{" "}
        {attempt.extraTimeUsed > 0 ? formatTime(attempt.extraTimeUsed) : "none"}
        {overtimeModules.length > 0
          ? ` (${overtimeModules.map((item) => `${item.name} +${formatTime(item.seconds)}`).join(", ")})`
          : ""}
        {attempt.pauses.length > 0 ? ` · Paused ${attempt.pauses.length}x (${formatTime(pauseSeconds)})` : ""}
      </Card>
      <div className="mt-6">
        <StatsPanel
          title="By Module"
          caption="Correct answers ÷ all module questions, including blanks"
          rows={moduleStats.map((stat) => ({ ...stat, label: stat.name }))}
          color="mocks"
        />
      </div>
      {attempt.test.reviewEnabled ? (
        <div className="mt-6 space-y-5">
          {modules.map((module) => {
            const tier = moduleTierMeta(module.order);
            return (
              <Card key={module.id} padding="md">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <h2 className="text-sm font-semibold text-gray-900">{module.name}</h2>
                  <Badge variant={difficultyBadgeVariant(tier.key)}>{tier.short}</Badge>
                </div>
                <div className="space-y-4">
                  {module.questions.map((item, index) => {
                    const answer = answersByQuestion.get(item.questionId);
                    const question = item.question;
                    const options = question.options;
                    const responseType = resolveQuestionType(question.type, options);
                    const isUnanswered = !answer?.answer;
                    const isCorrect = Boolean(answer?.isCorrect);
                    const statusClass = isCorrect
                      ? "border-green-200 bg-green-50"
                      : isUnanswered
                        ? "border-gray-200 bg-gray-50"
                        : "border-red-200 bg-red-50";
                    return (
                      <Card key={item.questionId} padding="md" className={statusClass}>
                        <div className="mb-2 flex items-start justify-between gap-3">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-gray-500">Q{index + 1}</span>
                            {isUnanswered ? (
                              <MinusCircle size={16} className="text-gray-400" />
                            ) : isCorrect ? (
                              <CheckCircle size={16} className="text-green-600" />
                            ) : (
                              <XCircle size={16} className="text-red-500" />
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant={difficultyBadgeVariant(tier.key)}>{tier.short}</Badge>
                            {answer?.timeSpent ? <span className="text-xs text-gray-500">{formatTime(answer.timeSpent)}</span> : null}
                          </div>
                        </div>

                        {question.stimulus?.trim() ? (
                          <MathContent content={question.stimulus} className="mb-3 rounded-md bg-white/70 p-3 text-sm text-gray-700" />
                        ) : null}
                        <MathContent content={question.stem} className="mb-3 text-sm text-gray-800" />
                        <QuestionMedia imageUrl={question.imageUrl} alt={`Question ${index + 1} image`} className="mb-3" />

                        {responseType === "MC" && (
                          <div className="mb-3 space-y-1">
                            {options.filter((opt) => opt.text.trim()).map((opt) => {
                              const studentPick = answer?.answer === opt.label;
                              const isRight = question.correctAnswer === opt.label;
                              const optionClass = isRight
                                ? "bg-green-100 text-green-800"
                                : studentPick
                                  ? "bg-red-100 text-red-700 line-through"
                                  : "text-gray-600";
                              return (
                                <div key={opt.label} className={`flex items-start gap-2 rounded px-2 py-1 text-sm ${optionClass}`}>
                                  <span className="w-4 font-medium">{opt.label})</span>
                                  <span className="min-w-0 flex-1"><MathContent content={opt.text} /></span>
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {responseType === "NUMERIC" && (
                          <div className="mb-3 flex flex-wrap gap-4 text-sm">
                            <span className="text-gray-600">Your answer: <span className="font-medium text-gray-900">{answer?.answer || "—"}</span></span>
                            <span className={isCorrect ? "text-green-700" : "text-red-700"}>
                              Correct answer: <span className="font-medium">{formatCorrectAnswer(question.correctAnswer)}</span>
                            </span>
                          </div>
                        )}

                        {isUnanswered && <p className="mb-1 text-xs italic text-gray-400">Unanswered</p>}
                        <ReviewTools
                          marked={Boolean(answer?.markedForReview)}
                          note={answer?.note ?? null}
                          eliminated={parseEliminatedOptions(answer?.eliminatedOptions)}
                        />

                        {question.explanation && (
                          <div className="mt-2 border-t border-gray-200 pt-2">
                            <p className="mb-1 text-xs font-medium text-gray-500">Explanation</p>
                            <MathContent content={question.explanation} className="text-sm text-gray-700" />
                          </div>
                        )}
                      </Card>
                    );
                  })}
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card padding="md" className="mt-6 text-sm text-gray-500">
          Question-by-question review is disabled for this exam.
        </Card>
      )}
    </PageShell>
  );
}

function ReviewTools({ marked, note, eliminated }: { marked: boolean; note: string | null; eliminated: string[] }) {
  if (!marked && !note && eliminated.length === 0) return null;
  return (
    <div className="mb-2 space-y-1 text-xs text-gray-600">
      {marked ? <p className="font-medium text-amber-700">Marked for review</p> : null}
      {eliminated.length > 0 ? <p>Eliminated: {eliminated.join(", ")}</p> : null}
      {note ? <p className="whitespace-pre-wrap">Note: {note}</p> : null}
    </div>
  );
}

function StatsPanel({
  title,
  caption,
  rows,
  color,
}: {
  title: string;
  caption?: string;
  rows: { label: string; hint?: string; correct: number; total: number; time: number }[];
  color: "mocks";
}) {
  return (
    <Card padding="md">
      <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
      {caption ? <p className="mb-3 mt-0.5 text-xs text-gray-500">{caption}</p> : <div className="mb-3" />}
      <div className="space-y-3">
        {rows.map((row) => {
          const pct = row.total > 0 ? scorePercent(row.correct, row.total) : null;
          return (
            <div key={row.label}>
              <div className="mb-1 flex items-center justify-between gap-3 text-sm">
                <span className="font-medium text-gray-800">
                  {row.label}
                  {row.hint ? <span className="ml-2 text-xs font-normal text-gray-400">{row.hint}</span> : null}
                </span>
                <span className="shrink-0 text-gray-600">{row.total > 0 ? `${pct}% · ${row.correct} correct of ${row.total} questions` : "No questions"}</span>
              </div>
              <div className="h-2 rounded-full bg-gray-100"><div className="h-2 rounded-full" style={{ width: `${pct ?? 0}%`, backgroundColor: `var(--sat-area-${color})` }} /></div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
