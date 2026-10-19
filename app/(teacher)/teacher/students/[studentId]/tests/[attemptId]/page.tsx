import Link from "next/link";
import { cn } from "@/lib/utils";
import { SECTION_TEXT } from "@/components/sat/test-ui";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { AttemptStatusBadge, InvalidatedNotice, PageShell, SectionHeader, TestAttemptsTable, TestResultSentence } from "@/components/sat";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Breadcrumbs } from "@/components/sat/breadcrumbs";
import { ReviewQuestionCard } from "@/components/sat/review-question-card";
import { AnswerGrid, AnswerGridLegend, ModuleResultLegend, ModuleResultRows, ScoreBlocks } from "@/components/sat/test-ui";
import { getFeatureSetting } from "@/lib/app-settings";
import { buildTestAttemptView } from "@/lib/test-view";
import prisma from "@/lib/prisma";
import { fullTestModulesForAttempt } from "@/lib/full-test-snapshot";
import { overtimeByModule } from "@/lib/full-test-progress";
import { auth } from "@/lib/auth";
import { teacherProgramEnrollmentScope } from "@/lib/program-scope";
import { formatDate, formatDuration, formatTime } from "@/lib/utils";
import { InfoHint } from "@/components/hint";
import { isAnswerCorrect } from "@/lib/answer-grading";
import { resolveQuestionType } from "@/lib/question-type";
import { parseEliminatedOptions } from "@/lib/answer-review-meta";
import { buildProgressHref, progressFiltersFromParams } from "@/lib/progress-filters";
import { AttemptActions } from "../../attempts/[attemptId]/attempt-actions-client";
import { SendExamReportButton } from "./send-exam-report-button";

interface PageProps {
  params: Promise<{ studentId: string; attemptId: string }>;
  searchParams: Promise<{ area?: string; topic?: string; difficulty?: string; from?: string; to?: string }>;
}

/**
 * One Test attempt for the teacher (same layout as the student results), with reopen/invalidate.
 * An open attempt shows only the modules the student already submitted.
 */
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
      assignment: { select: { dueDate: true } },
    },
  });
  if (!attempt) notFound();
  // The exam as this attempt saw it (RNF-17 snapshot), not the live, possibly edited exam.
  const modules = await fullTestModulesForAttempt(attempt);

  const excludePretest = await getFeatureSetting("FPT_PRETEST_EXCLUSION");
  const view = buildTestAttemptView({
    modules,
    status: attempt.status,
    moduleTimerState: attempt.moduleTimerState,
    answers: attempt.answers,
    rwScore: attempt.rwScore,
    mathScore: attempt.mathScore,
    totalScore: attempt.totalScore,
    excludePretest,
  });
  const siblings = await prisma.fullPracticeTestAttempt.findMany({
    where: { studentId, testId: attempt.testId },
    orderBy: { startedAt: "asc" },
    select: { id: true, status: true, startedAt: true, submittedAt: true, rwScore: true, mathScore: true, totalScore: true },
  });
  const tryNumber = siblings.findIndex((s) => s.id === attempt.id) + 1;

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
    let answered = 0;
    let marked = 0;
    let time = 0;
    for (const item of module.questions) {
      const answer = answersByQuestion.get(item.questionId);
      if (answer?.answer) answered += 1;
      if (answer?.markedForReview) marked += 1;
      time += answer?.timeSpent ?? 0;
    }
    return { id: module.id, view: view.modules[index], total: module.questions.length, answered, marked, time, overtime: overtime[index] ?? 0 };
  });
  const pauseSeconds = attempt.pauses.reduce((sum, pause) => sum + (pause.durationSeconds ?? 0), 0);
  const studentHref = buildProgressHref(`/teacher/students/${studentId}`, filters, { area: "tests" });
  const inProgress = attempt.status === "IN_PROGRESS";
  const doneModules = view.modules.filter((m) => m.state === "done");

  return (
    <PageShell maxWidth={1180}>
      <Breadcrumbs
        items={[
          { label: "Home", href: "/teacher" },
          { label: "Students", href: "/teacher/students" },
          { label: attempt.student.name, href: studentHref },
          { label: `${attempt.test.name} · Try ${tryNumber}` },
        ]}
      />
      <div className="mb-4 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-[26px] font-bold tracking-[-0.3px] text-gray-900">{attempt.test.name} · {attempt.student.name}&apos;s results</h1>
            <Badge variant="test">Test</Badge>
            <Badge>Try {tryNumber} of {siblings.length}</Badge>
            <AttemptStatusBadge status={attempt.status} />
          </div>
          <p className="mt-1 text-sm text-gray-500">
            Started {formatDate(attempt.startedAt)} · {attempt.submittedAt ? `Completed ${formatDate(attempt.submittedAt)}` : "Not finished"}
            {attempt.assignment?.dueDate ? ` · Due ${formatDate(attempt.assignment.dueDate)}` : ""}
            {attempt.pauses.length > 0 ? ` · Paused ${attempt.pauses.length} ${attempt.pauses.length === 1 ? "time" : "times"} (${formatDuration(pauseSeconds)})` : ""}
            {attempt.timeExpiredEvents > 0 ? ` · Ran out of time ${attempt.timeExpiredEvents} ${attempt.timeExpiredEvents === 1 ? "time" : "times"}` : ""}
            {attempt.extraTimeUsed > 0 ? ` · Extra time ${formatTime(attempt.extraTimeUsed)}` : ""}
          </p>
        </div>
        <Link href={studentHref} className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-blue-600">
          <ChevronLeft size={14} /> Back to {attempt.student.name.split(" ")[0]}
        </Link>
      </div>

      {attempt.status === "INVALIDATED" ? <InvalidatedNotice audience="teacher" /> : null}

      <TestResultSentence view={view} status={attempt.status} who={attempt.student.name.split(" ")[0]} />

      <ScoreBlocks view={view} />

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <Card padding="md" className="min-w-0">
          <h2 className="text-sm font-semibold text-gray-900">Results by module</h2>
          <p className="mt-0.5 text-xs text-gray-500">Blank answers count as incorrect. Click a module to jump to its questions.</p>
          <ModuleResultLegend />
          <ModuleResultRows modules={view.modules} />
          <div className="mt-2 overflow-x-auto border-t border-gray-100 pt-2">
            <table className="w-full min-w-[28rem] text-xs">
              <thead className="text-left text-gray-500">
                <tr>
                  <th className="py-1 font-medium">Module</th>
                  <th className="py-1 text-right font-medium">Answered</th>
                  <th className="py-1 text-right font-medium">Marked</th>
                  <th className="py-1 text-right font-medium">Time</th>
                  <th className="py-1 text-right font-medium">
                    <span className="inline-flex items-center gap-1">Extra time <InfoHint label="Time used after the module timer ended" /></span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {moduleRows.map((row) => (
                  <tr key={row.id} className="border-t border-gray-50">
                    <td className="py-1 text-gray-800">{row.view.short} · {row.view.tier}</td>
                    <td className="py-1 text-right tabular-nums text-gray-700">{row.answered}/{row.total}</td>
                    <td className="py-1 text-right tabular-nums text-gray-700">{row.marked}</td>
                    <td className="py-1 text-right tabular-nums text-gray-700">{formatTime(row.time)}</td>
                    <td className={`py-1 text-right tabular-nums ${row.overtime > 0 ? "font-medium text-red-600" : "text-gray-400"}`}>
                      {row.overtime > 0 ? `+${formatTime(row.overtime)}` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
        <Card padding="md" className="space-y-3">
          <h2 className="text-sm font-semibold text-gray-900">Teacher actions</h2>
          <p className="text-xs text-gray-500">{siblings.length} attempt{siblings.length === 1 ? "" : "s"} recorded. Every try is kept, even when you let the student start again.</p>
          <AttemptActions attemptId={attempt.id} kind="fpt" status={attempt.status} />
          {attempt.status === "SUBMITTED" ? (
            <SendExamReportButton
              studentId={studentId}
              studentName={attempt.student.name}
              attemptId={attempt.id}
              attemptLabel={`${attempt.test.name} · ${attempt.submittedAt ? formatDate(attempt.submittedAt) : ""} · ${attempt.totalScore ?? "—"}`}
              parents={parentOptions}
            />
          ) : null}
        </Card>
      </div>

      {doneModules.length > 0 ? (
        <Card padding="md" className="mt-4">
          <h2 className="text-sm font-semibold text-gray-900">Answers at a glance</h2>
          <div className="mt-2 space-y-3">
            {view.modules.map((m, index) => (
              <div key={m.key}>
                <p className={cn("mb-1 text-xs font-semibold", SECTION_TEXT[m.section])}>{m.name}{m.state !== "done" ? " · not taken yet" : ""}</p>
                <AnswerGrid
                  idPrefix={`${m.key}-`}
                  items={modules[index].questions.map((item) => {
                    if (m.state !== "done") return { state: "na" as const };
                    const a = answersByQuestion.get(item.questionId);
                    const correct = isCorrectFor(a, item.question);
                    return { state: !a?.answer ? ("blank" as const) : correct ? ("ok" as const) : ("bad" as const) };
                  })}
                />
              </div>
            ))}
          </div>
          <AnswerGridLegend withNotTaken={doneModules.length < view.modules.length} />
        </Card>
      ) : null}

      {siblings.length > 1 ? (
        <section className="mt-4">
          <SectionHeader title={`All attempts for ${attempt.test.name}`} description="Every try is kept. Click one to see it." />
          <TestAttemptsTable
            rows={siblings.map((s, i) => ({ ...s, tryNumber: i + 1, view: s.id === attempt.id && inProgress ? view : null }))}
            viewingId={attempt.id}
            hrefFor={(id) => buildProgressHref(`/teacher/students/${studentId}/tests/${id}`, filters)}
          />
        </section>
      ) : null}

      <div className="mt-6 space-y-6">
        {modules.map((module, index) => {
          const m = view.modules[index];
          return (
            <section key={module.id} id={`mod-${m.key}`} className="scroll-mt-6">
              <div className="mb-2 flex items-baseline justify-between gap-2">
                <h2 className="text-base font-semibold text-gray-900">{module.name} <span className="font-normal text-gray-500">· {m.tier}</span></h2>
                {m.state === "done" ? <span className="text-sm text-gray-600">{m.right} of {m.questionCount} correct</span> : null}
              </div>
              {m.state !== "done" ? (
                <Card padding="md" className="border-dashed text-sm text-gray-600">
                  <b>{attempt.student.name.split(" ")[0]} hasn&apos;t {inProgress && m.state === "progress" ? "submitted" : "taken"} this module yet.</b>
                  <p className="text-xs text-gray-500">Answers will appear here when it&apos;s completed.</p>
                </Card>
              ) : (
                <div className="space-y-3">
                  {module.questions.map((item, qIndex) => {
                    const answer = answersByQuestion.get(item.questionId);
                    const eliminated = parseEliminatedOptions(answer?.eliminatedOptions);
                    return (
                      <ReviewQuestionCard
                        key={item.questionId}
                        id={`${m.key}-${qIndex + 1}`}
                        number={qIndex + 1}
                        question={item.question}
                        answer={answer?.answer ?? null}
                        isCorrect={isCorrectFor(answer, item.question)}
                        timeSpent={answer?.timeSpent}
                        tags={
                          <>
                            {item.isPretest ? <Badge>Unscored (pretest)</Badge> : null}
                            {answer?.markedForReview ? <Badge variant="warning">Marked</Badge> : null}
                          </>
                        }
                      >
                        {eliminated.length > 0 ? <p className="text-xs text-gray-600">Crossed out by the student: {eliminated.join(", ")}</p> : null}
                        {answer?.note ? <p className="mt-1 whitespace-pre-wrap text-xs text-gray-600">Student note: {answer.note}</p> : null}
                      </ReviewQuestionCard>
                    );
                  })}
                </div>
              )}
            </section>
          );
        })}
      </div>
    </PageShell>
  );
}

function isCorrectFor(
  answer: { answer: string | null; isCorrect: boolean | null } | undefined,
  question: { correctAnswer: string; type: string; options: { label: string; text: string; imageUrl?: string | null }[] },
) {
  if (!answer?.answer) return false;
  if (answer.isCorrect !== null && answer.isCorrect !== undefined) return answer.isCorrect;
  return isAnswerCorrect(answer.answer, question.correctAnswer, resolveQuestionType(question.type, question.options));
}
