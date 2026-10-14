import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, CheckCircle, MinusCircle, XCircle } from "lucide-react";
import { AttemptStatusBadge, InvalidatedNotice, PageShell, VoidableValue } from "@/components/sat";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MathContent } from "@/components/math-content";
import { OptionContent } from "@/components/option-content";
import { QuestionMedia } from "@/components/question-media";
import prisma from "@/lib/prisma";
import { fullTestModulesForAttempt } from "@/lib/full-test-snapshot";
import { overtimeByModule } from "@/lib/full-test-progress";
import { auth } from "@/lib/auth";
import { teacherProgramEnrollmentScope } from "@/lib/program-scope";
import { formatDate, formatDuration, formatTime, scorePercent } from "@/lib/utils";
import { InfoHint } from "@/components/hint";
import { formatCorrectAnswer } from "@/lib/answer-grading";
import { resolveQuestionType, isAnswerOption } from "@/lib/question-type";
import { parseEliminatedOptions } from "@/lib/answer-review-meta";
import { difficultyBadgeVariant } from "@/lib/domain-meta";
import { difficultyFromFullTestModuleKey, moduleKeyFromOrder } from "@/lib/full-test-modules";
import { buildProgressHref, progressFiltersFromParams } from "@/lib/progress-filters";
import { AttemptActions } from "../../attempts/[attemptId]/attempt-actions-client";
import { SendExamReportButton } from "./send-exam-report-button";

interface PageProps {
  params: Promise<{ studentId: string; attemptId: string }>;
  searchParams: Promise<{ area?: string; topic?: string; difficulty?: string; from?: string; to?: string }>;
}

/** Full detail of one Full Practice Test attempt for the teacher, with reopen/invalidate. */
export default async function TeacherFullTestAttemptPage({ params, searchParams }: PageProps) {
  const { studentId, attemptId } = await params;
  const filters = progressFiltersFromParams(await searchParams);
  const session = await auth();
  const programScope =
    session?.user.role === "TEACHER" ? teacherProgramEnrollmentScope(session.user.id) : undefined;

  const attempt = await prisma.fullPracticeTestAttempt.findFirst({
    where: {
      id: attemptId,
      studentId,
      ...(programScope ? { student: { programEnrollments: programScope } } : {}),
    },
    include: {
      student: { select: { id: true, name: true } },
      answers: true,
      pauses: true,
      test: { select: { name: true } },
    },
  });
  if (!attempt) notFound();
  // The exam as this attempt saw it (RNF-17 snapshot), not the live, possibly edited exam.
  const modules = await fullTestModulesForAttempt(attempt);

  const parents = await prisma.parentStudent.findMany({
    where: { studentId },
    include: { parent: { select: { id: true, name: true, email: true } } },
  });
  const parentOptions = parents
    .filter((link) => link.parent.email)
    .map((link) => ({ id: link.parent.id, name: link.parent.name, email: link.parent.email }));

  const answersByQuestion = new Map(attempt.answers.map((answer) => [answer.questionId, answer]));
  const overtime = overtimeByModule(attempt.moduleTimerState, modules.length);
  const moduleRows = modules.map((module, index) => {
    let correct = 0;
    let answered = 0;
    let marked = 0;
    let time = 0;
    for (const item of module.questions) {
      const answer = answersByQuestion.get(item.questionId);
      if (answer?.isCorrect) correct += 1;
      if (answer?.answer) answered += 1;
      if (answer?.markedForReview) marked += 1;
      time += answer?.timeSpent ?? 0;
    }
    const tier = difficultyFromFullTestModuleKey(moduleKeyFromOrder(module.order));
    return { id: module.id, name: module.name, tier, total: module.questions.length, correct, answered, marked, time, overtime: overtime[index] ?? 0 };
  });
  const pauseSeconds = attempt.pauses.reduce((sum, pause) => sum + (pause.durationSeconds ?? 0), 0);
  const studentHref = buildProgressHref(`/teacher/students/${studentId}`, filters);

  return (
    <PageShell>
      <div className="mb-6 flex items-center gap-2 text-sm text-gray-500">
        <Link href={studentHref} className="flex items-center gap-1 hover:text-blue-600">
          <ChevronLeft size={14} /> {attempt.student.name}
        </Link>
        <span>/</span>
        <span className="font-medium text-gray-900">{attempt.test.name}</span>
      </div>

      <Card padding="md" className="mb-6 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">{attempt.test.name}</h1>
          <p className="mt-1 text-sm text-gray-500">
            Started {formatDate(attempt.startedAt)} · {attempt.submittedAt ? `Finished ${formatDate(attempt.submittedAt)}` : "Not finished"}
            {attempt.pauses.length > 0 ? ` · Paused ${attempt.pauses.length} ${attempt.pauses.length === 1 ? "time" : "times"} (${formatDuration(pauseSeconds)})` : ""}
            {attempt.timeExpiredEvents > 0 ? ` · Ran out of time ${attempt.timeExpiredEvents} ${attempt.timeExpiredEvents === 1 ? "time" : "times"}` : ""}
            {attempt.extraTimeUsed > 0 ? ` · Extra time ${formatTime(attempt.extraTimeUsed)}` : ""}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-4">
            <AttemptStatusBadge status={attempt.status} />
            <ScoreStat label="Reading & Writing" value={attempt.rwScore} status={attempt.status} />
            <ScoreStat label="Math" value={attempt.mathScore} status={attempt.status} />
            <ScoreStat label="Total" value={attempt.totalScore} status={attempt.status} strong />
          </div>
          {attempt.status === "SUBMITTED" ? (
            <div className="mt-4">
              <SendExamReportButton
                studentId={studentId}
                studentName={attempt.student.name}
                attemptId={attempt.id}
                attemptLabel={`${attempt.test.name} · ${attempt.submittedAt ? formatDate(attempt.submittedAt) : ""} · ${attempt.totalScore ?? "—"}`}
                parents={parentOptions}
              />
            </div>
          ) : null}
        </div>
        <AttemptActions attemptId={attempt.id} kind="fpt" status={attempt.status} />
      </Card>

      {attempt.status === "INVALIDATED" ? <InvalidatedNotice audience="teacher" /> : null}

      <Card padding="none" className="mb-6 overflow-x-auto">
        <table className="w-full min-w-[36rem] text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs text-gray-500">
              <th className="px-4 py-2 font-medium">Module</th>
              <th className="px-4 py-2 font-medium">Level</th>
              <th className="px-4 py-2 text-right font-medium">Correct</th>
              <th className="px-4 py-2 text-right font-medium">Answered</th>
              <th className="px-4 py-2 text-right font-medium">Marked</th>
              <th className="px-4 py-2 text-right font-medium">Time</th>
              <th className="px-4 py-2 text-right font-medium">
                <span className="inline-flex items-center gap-1">
                  Extra time <InfoHint label="Time used after the module timer ended" />
                </span>
              </th>
            </tr>
          </thead>
          <tbody>
            {moduleRows.map((row) => (
              <tr key={row.id} className="border-b border-gray-100 last:border-0">
                <td className="px-4 py-2 font-medium text-gray-900">{row.name}</td>
                <td className="px-4 py-2">
                  <Badge variant={difficultyBadgeVariant(row.tier)}>{row.tier === "HARD" ? "Harder" : "Standard"}</Badge>
                </td>
                <td className="px-4 py-2 text-right tabular-nums">
                  <VoidableValue status={attempt.status}>
                    {row.correct}/{row.total} ({row.total ? scorePercent(row.correct, row.total) : 0}%)
                  </VoidableValue>
                </td>
                <td className="px-4 py-2 text-right tabular-nums text-gray-700">{row.answered}/{row.total}</td>
                <td className="px-4 py-2 text-right tabular-nums text-gray-700">{row.marked}</td>
                <td className="px-4 py-2 text-right tabular-nums text-gray-700">{formatTime(row.time)}</td>
                <td className={`px-4 py-2 text-right tabular-nums ${row.overtime > 0 ? "font-medium text-red-600" : "text-gray-400"}`}>
                  {row.overtime > 0 ? `+${formatTime(row.overtime)}` : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <div className="space-y-5">
        {modules.map((module) => (
          <Card key={module.id} padding="md">
            <h2 className="mb-3 text-sm font-semibold text-gray-900">{module.name}</h2>
            <div className="space-y-3">
              {module.questions.map((item, index) => {
                const answer = answersByQuestion.get(item.questionId);
                const question = item.question;
                const responseType = resolveQuestionType(question.type, question.options);
                const isUnanswered = !answer?.answer;
                const isCorrect = Boolean(answer?.isCorrect);
                const eliminated = parseEliminatedOptions(answer?.eliminatedOptions);
                return (
                  <details key={item.questionId} className="rounded-md border border-gray-200 bg-white open:bg-gray-50/60">
                    <summary className="flex cursor-pointer select-none flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-sm">
                      <span className="w-8 font-medium text-gray-500">Q{index + 1}</span>
                      {isUnanswered ? (
                        <MinusCircle size={16} className="text-gray-400" aria-label="Blank" />
                      ) : isCorrect ? (
                        <CheckCircle size={16} className="text-green-600" aria-label="Correct" />
                      ) : (
                        <XCircle size={16} className="text-red-500" aria-label="Wrong" />
                      )}
                      <span className="text-gray-700">
                        Answer: <span className="font-medium text-gray-900">{answer?.answer || "—"}</span> · Correct:{" "}
                        <span className="font-medium text-gray-900">{formatCorrectAnswer(question.correctAnswer)}</span>
                      </span>
                      {answer?.timeSpent ? <span className="text-xs text-gray-500">{formatTime(answer.timeSpent)}</span> : null}
                      {item.isPretest ? <Badge variant="default">Unscored (pretest)</Badge> : null}
                      {answer?.markedForReview ? <Badge variant="warning">Marked</Badge> : null}
                      {answer?.note ? <Badge variant="info">Note</Badge> : null}
                    </summary>
                    <div className="border-t border-gray-200 px-3 py-3">
                      {question.stimulus?.trim() ? (
                        <MathContent content={question.stimulus} className="mb-3 rounded-md bg-white p-3 text-sm text-gray-700" />
                      ) : null}
                      <MathContent content={question.stem} className="mb-3 text-sm text-gray-800" />
                      <QuestionMedia imageUrl={question.imageUrl} alt={`Question ${index + 1} image`} className="mb-3" />
                      {responseType === "MC" ? (
                        <div className="mb-3 space-y-1">
                          {question.options.filter(isAnswerOption).map((opt) => {
                            const picked = answer?.answer === opt.label;
                            const right = question.correctAnswer === opt.label;
                            return (
                              <div
                                key={opt.label}
                                className={`flex items-start gap-2 rounded px-2 py-1 text-sm ${
                                  right ? "bg-green-100 text-green-800" : picked ? "bg-red-100 text-red-700" : "text-gray-600"
                                } ${eliminated.includes(opt.label) ? "line-through opacity-70" : ""}`}
                              >
                                <span className="w-4 font-medium">{opt.label})</span>
                                <span className="min-w-0 flex-1"><OptionContent text={opt.text} imageUrl={opt.imageUrl} label={opt.label} /></span>
                              </div>
                            );
                          })}
                        </div>
                      ) : null}
                      {eliminated.length > 0 ? <p className="text-xs text-gray-600">Crossed out by the student: {eliminated.join(", ")}</p> : null}
                      {answer?.note ? <p className="mt-1 whitespace-pre-wrap text-xs text-gray-600">Student note: {answer.note}</p> : null}
                    </div>
                  </details>
                );
              })}
            </div>
          </Card>
        ))}
      </div>
    </PageShell>
  );
}

function ScoreStat({ label, value, status, strong }: { label: string; value: number | null; status: string; strong?: boolean }) {
  return (
    <div className="text-sm">
      <span className="text-gray-500">{label} </span>
      <VoidableValue status={status} className={strong ? "font-semibold text-gray-900" : "font-medium text-gray-900"}>
        {value ?? "—"}
      </VoidableValue>
    </div>
  );
}
