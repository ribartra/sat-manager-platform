import Link from "next/link";
import { cn } from "@/lib/utils";
import { SECTION_TEXT } from "@/components/sat/test-ui";
import { notFound } from "next/navigation";
import { InvalidatedNotice, PageShell, TestResultSentence, isInvalidated } from "@/components/sat";
import { HEADER_ACTION_CLASS, HeaderActions } from "@/components/sat/header-actions";
import { RetakeTestButton } from "@/components/sat/retake-test-button";
import { Alert } from "@/components/sat/alert";
import { Breadcrumbs } from "@/components/sat/breadcrumbs";
import { ReviewQuestionCard } from "@/components/sat/review-question-card";
import { AnswerGrid, AnswerGridLegend, ModuleResultLegend, ModuleResultRows, ScoreBlocks } from "@/components/sat/test-ui";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { parseEliminatedOptions } from "@/lib/answer-review-meta";
import { isAnswerCorrect } from "@/lib/answer-grading";
import { resolveQuestionType } from "@/lib/question-type";
import { getFeatureSetting } from "@/lib/app-settings";
import { fullTestModulesForAttempt } from "@/lib/full-test-snapshot";
import { moduleIndexFromKey, overtimeByModule } from "@/lib/full-test-progress";
import { buildTestAttemptView, type ModuleView } from "@/lib/test-view";
import { formatDate, formatDuration, formatTime, relativeDay } from "@/lib/utils";

interface PageProps {
  params: Promise<{ attemptId: string }>;
  searchParams: Promise<{ submitted?: string; from?: string; to?: string }>;
}

/**
 * Test results (mockup "test-result.html"). An open attempt shows the modules already submitted;
 * a section score appears only when both of its modules are done and the total when all 4 are.
 */
export default async function FullTestResultsPage({ params, searchParams }: PageProps) {
  const { attemptId } = await params;
  const query = await searchParams;
  const session = await auth();
  const attempt = await prisma.fullPracticeTestAttempt.findFirst({
    where: { id: attemptId, studentId: session!.user.id },
    include: {
      test: { select: { name: true, reviewEnabled: true } },
      assignment: { select: { id: true, dueDate: true, createdAt: true, status: true } },
      answers: true,
      pauses: true,
    },
  });
  if (!attempt) notFound();
  const invalidated = isInvalidated(attempt.status);
  const inProgress = attempt.status === "IN_PROGRESS";
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
    where: { studentId: session!.user.id, testId: attempt.testId, ...(attempt.assignmentId ? { assignmentId: attempt.assignmentId } : {}) },
    orderBy: { startedAt: "asc" },
    select: { id: true, status: true, startedAt: true, submittedAt: true, rwScore: true, mathScore: true, totalScore: true },
  });
  const tryNumber = siblings.findIndex((s) => s.id === attempt.id) + 1;
  const canRetake = attempt.assignment?.status === "COMPLETED" && !siblings.some((s) => s.status === "IN_PROGRESS");
  const timeByModule = modules.map((m) => m.questions.reduce((sum, q) => sum + (attempt.answers.find((a) => a.questionId === q.questionId)?.timeSpent ?? 0), 0));

  const answersByQuestion = new Map(attempt.answers.map((answer) => [answer.questionId, answer]));
  const overtime = overtimeByModule(attempt.moduleTimerState, modules.length);
  const pauseSeconds = attempt.pauses.reduce((sum, pause) => sum + (pause.durationSeconds ?? 0), 0);
  const timeNotes: string[] = [];
  if (attempt.timeExpiredEvents > 0) {
    timeNotes.push(`Ran out of time in ${attempt.timeExpiredEvents} module${attempt.timeExpiredEvents === 1 ? "" : "s"}`);
  }
  if (attempt.extraTimeUsed > 0) {
    const perModule = modules
      .map((m, i) => ({ name: m.name, seconds: overtime[i] ?? 0 }))
      .filter((m) => m.seconds > 0)
      .map((m) => `${m.name}: ${formatTime(m.seconds)}`)
      .join(", ");
    timeNotes.push(`Extra time used: ${formatTime(attempt.extraTimeUsed)}${perModule ? ` (${perModule})` : ""}`);
  }
  if (attempt.pauses.length > 0) {
    timeNotes.push(`Paused ${attempt.pauses.length} time${attempt.pauses.length === 1 ? "" : "s"} (${formatDuration(pauseSeconds)})`);
  }

  const playerBase = attempt.assignmentId ? `/student/tests/${attempt.assignmentId}` : null;
  const moduleHref = (m: ModuleView) => (playerBase ? `${playerBase}?module=${m.key}` : null);
  const startButton = (m: ModuleView | null | undefined) => {
    const href = m ? moduleHref(m) : null;
    if (!m || !href || !inProgress) return null;
    return (
      <Button asChild size="sm" variant="secondary">
        <Link href={href}>{m.state === "progress" ? "Continue" : "Start"} {m.short}</Link>
      </Button>
    );
  };
  const submittedIndex = moduleIndexFromKey(query.submitted);
  const submittedModule = submittedIndex !== null ? view.modules[submittedIndex] : null;
  const doneModules = view.modules.filter((m) => m.state === "done");
  const pendingModules = view.modules.filter((m) => m.state !== "done");

  return (
    <PageShell maxWidth={960}>
      <Breadcrumbs
        items={[
          { label: "Home", href: "/student" },
          { label: "Tests", href: "/student/tests" },
          { label: attempt.test.name, href: attempt.assignmentId ? `/student/tests?view=all#test-${attempt.assignmentId}` : "/student/tests?view=completed" },
          { label: `Try ${tryNumber} results` },
        ]}
      />

      {submittedModule && submittedModule.state === "done" ? (
        <Alert
          tone="success"
          className="mb-4"
          action={view.nextModule && inProgress ? startButton(view.nextModule) : undefined}
        >
          <b>{submittedModule.name}</b> submitted.{" "}
          {view.nextModule && inProgress ? <>Next up: {view.nextModule.name}.</> : <>You finished the whole test!</>}
        </Alert>
      ) : null}

      {/* Header: title on the left, actions top right (same slot and style for every role). */}
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-[26px] font-bold tracking-[-0.3px] text-gray-900">{attempt.test.name} results</h1>
            <Badge>Try {tryNumber} of {siblings.length}</Badge>
            {inProgress ? <Badge variant="warning">In progress</Badge> : invalidated ? null : <Badge variant="success">Completed</Badge>}
          </div>
          <p className="mt-1 text-xs text-gray-500">
            Started <b className="font-medium text-gray-700">{formatDate(attempt.startedAt)}</b>
            {attempt.submittedAt ? (
              <> · Completed <b className="font-medium text-gray-700">{formatDate(attempt.submittedAt)}</b> ({relativeDay(attempt.submittedAt)})</>
            ) : null}
            {attempt.assignment?.dueDate ? <> · Due {formatDate(attempt.assignment.dueDate)}</> : null}
          </p>
        </div>
        <HeaderActions>
          {canRetake && attempt.assignmentId ? <RetakeTestButton assignmentId={attempt.assignmentId} testName={attempt.test.name} /> : null}
          <Link href="/student/tests?view=completed" className={HEADER_ACTION_CLASS}>All tests</Link>
        </HeaderActions>
      </div>

      {invalidated ? <InvalidatedNotice audience="student" /> : null}

      <TestResultSentence view={view} status={attempt.status} who="You" />

      <ScoreBlocks view={view} anchorPrefix={attempt.test.reviewEnabled ? "mod-" : undefined} actionFor={(s) => startButton(view.modules.find((m) => m.section === s.section && m.state !== "done"))} />

      <Card padding="md" className="mt-4">
        <h2 className="text-sm font-semibold text-gray-900">Results by module</h2>
        <p className="mt-0.5 text-xs text-gray-500">Blank answers count as wrong. Click a module to jump to its questions.</p>
        <ModuleResultLegend />
        <ModuleResultRows
          modules={view.modules}
          actionFor={(m) => startButton(m)}
          timeFor={(m) => (m.state === "done" && timeByModule[m.index] ? formatDuration(timeByModule[m.index]) : null)}
        />
        {timeNotes.length > 0 ? (
          <ul className="mt-2 space-y-0.5 border-t border-gray-100 pt-2 text-xs text-gray-500">
            {timeNotes.map((note) => <li key={note}>{note}</li>)}
          </ul>
        ) : null}
      </Card>

      {attempt.test.reviewEnabled && doneModules.length > 0 ? (
        <Card padding="md" className="mt-4">
          <h2 className="text-sm font-semibold text-gray-900">Your answers at a glance</h2>
          <p className="mb-3 mt-0.5 text-xs text-gray-500">Each square is a question. Click one to see your answer and the explanation.</p>
          <div className="space-y-3">
            {view.modules.map((m, index) => (
              <div key={m.key}>
                <p className={cn("mb-1 text-xs font-semibold", SECTION_TEXT[m.section])}>{m.name}{m.state !== "done" ? " · not taken yet" : ""}</p>
                <AnswerGrid
                  idPrefix={`${m.key}-`}
                  items={modules[index].questions.map((item) => {
                    if (m.state !== "done") return { state: "na" as const };
                    const a = answersByQuestion.get(item.questionId);
                    const correct = gradedCorrect(view.modules[index], a, item);
                    return { state: !a?.answer ? ("blank" as const) : correct ? ("ok" as const) : ("bad" as const) };
                  })}
                />
              </div>
            ))}
          </div>
          <AnswerGridLegend withNotTaken={pendingModules.length > 0} />
        </Card>
      ) : null}

      {attempt.test.reviewEnabled ? (
        <div className="mt-6 space-y-6">
          {modules.map((testModule, index) => {
            const m = view.modules[index];
            return (
              <section key={testModule.id} id={`mod-${m.key}`} className="scroll-mt-6">
                <div className="mb-2 flex items-baseline justify-between gap-2">
                  <h2 className={cn("text-[17px] font-bold", SECTION_TEXT[m.section])}>
                    {testModule.name} <span className="font-normal text-gray-500">· {m.tier}</span>
                  </h2>
                  {m.state === "done" ? <span className="text-sm text-gray-600">{m.right} of {m.questionCount} correct</span> : null}
                </div>
                {m.state !== "done" ? (
                  <Card padding="md" className="border-dashed text-sm text-gray-600">
                    <b>You haven&apos;t taken this module yet.</b>
                    <p className="text-xs text-gray-500">Questions, answers and explanations will appear here after you complete it.</p>
                    <div className="mt-2">{startButton(m)}</div>
                  </Card>
                ) : (
                  <div className="space-y-3">
                    {testModule.questions.map((item, qIndex) => {
                      const answer = answersByQuestion.get(item.questionId);
                      return (
                        <ReviewQuestionCard
                          key={item.questionId}
                          id={`${m.key}-${qIndex + 1}`}
                          number={qIndex + 1}
                          question={item.question}
                          answer={answer?.answer ?? null}
                          isCorrect={gradedCorrect(m, answer, item)}
                          timeSpent={answer?.timeSpent}
                          tags={<Badge>{m.tier}</Badge>}
                        >
                          <ReviewTools
                            marked={Boolean(answer?.markedForReview)}
                            note={answer?.note ?? null}
                            eliminated={parseEliminatedOptions(answer?.eliminatedOptions)}
                          />
                        </ReviewQuestionCard>
                      );
                    })}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      ) : (
        <Card padding="md" className="mt-6 text-sm text-gray-500">
          Your teacher hasn&apos;t turned on answer review for this test.
        </Card>
      )}
    </PageShell>
  );
}

/** Stored grade for a submitted attempt; for a module submitted in an open attempt, grade it now. */
function gradedCorrect(
  m: ModuleView,
  answer: { answer: string | null; isCorrect: boolean | null } | undefined,
  item: { question: { correctAnswer: string; type: string; options: { label: string; text: string; imageUrl?: string | null }[] } },
) {
  if (m.state !== "done" || !answer?.answer) return false;
  if (answer.isCorrect !== null && answer.isCorrect !== undefined) return answer.isCorrect;
  return isCorrectNow(answer.answer, item.question);
}

function isCorrectNow(answer: string, question: { correctAnswer: string; type: string; options: { label: string; text: string; imageUrl?: string | null }[] }) {
  return isAnswerCorrect(answer, question.correctAnswer, resolveQuestionType(question.type, question.options));
}

function ReviewTools({ marked, note, eliminated }: { marked: boolean; note: string | null; eliminated: string[] }) {
  if (!marked && !note && eliminated.length === 0) return null;
  return (
    <div className="mb-2 space-y-1 text-xs text-gray-600">
      {marked ? <p className="font-medium text-amber-700">Marked for review</p> : null}
      {eliminated.length > 0 ? <p>Crossed out: {eliminated.join(", ")}</p> : null}
      {note ? <p className="whitespace-pre-wrap">Your note: {note}</p> : null}
    </div>
  );
}
