import { parseEliminatedOptions } from "@/lib/answer-review-meta";
import { getStudentViewer } from "@/lib/student-viewer";
import prisma from "@/lib/prisma";
import { notFound, redirect } from "next/navigation";
import { FullTestPlayer } from "./player-client";
import { getFullTestProgressState } from "@/lib/full-test-progress";
import { getPublicCalculatorConfig } from "@/lib/calculator-config";
import { getFeatureSetting } from "@/lib/app-settings";
import { extractQuestionGraphArtifacts } from "@/lib/question-graph";
import { writeAudit } from "@/lib/audit";
import { claimWriteSlot, RESUME_AUDIT_INTERVAL_MS } from "@/lib/write-throttle";
import { isUniqueConstraintError } from "@/lib/db-errors";
import { buildFullTestSnapshot, fullTestModulesForAttempt, fullTestModulesInclude } from "@/lib/full-test-snapshot";
import { formatCorrectAnswer, isAnswerCorrect } from "@/lib/answer-grading";
import { resolveQuestionType } from "@/lib/question-type";
import { completedModulesOf, moduleIndexFromKey, moduleKeyFromIndex } from "@/lib/full-test-progress";
import { TestIntro } from "./test-intro";

interface PageProps {
  params: Promise<{ assignmentId: string }>;
  searchParams: Promise<{ module?: string; start?: string; from?: string; to?: string }>;
}

/**
 * /student/tests/[assignmentId]?module=rw1|rw2|m1|m2 — module intro (directions + the 4 module tiles);
 * `&start=1` opens the player on that module. Students may take the modules in any order.
 */
export default async function FullTestPlayerPage({ params, searchParams }: PageProps) {
  const { assignmentId } = await params;
  const query = await searchParams;
  const returnParams = new URLSearchParams();
  for (const key of ["from", "to"] as const) {
    if (query[key]) returnParams.set(key, query[key]!);
  }
  const requestedModule = moduleIndexFromKey(query.module);
  // The student shown: the signed-in student, or the teacher's Student view (nothing is saved as the student).
  const viewer = await getStudentViewer();
  if (!viewer) redirect("/login");
  const assignment = await prisma.fullPracticeTestAssignment.findFirst({
    where: { id: assignmentId, studentId: viewer.studentId },
    include: {
      test: {
        include: {
          source: { select: { name: true } },
          modules: { include: fullTestModulesInclude, orderBy: { order: "asc" } },
        },
      },
      attempts: { where: { status: "IN_PROGRESS" }, include: { answers: true }, take: 1 },
    },
  });
  if (!assignment) notFound();
  // Open date: the Test can't be started before it (the Tests list shows "Opens …").
  if (assignment.unlockAt && assignment.unlockAt > new Date()) redirect("/student/tests");

  let attempt = assignment.attempts[0];
  if (!attempt && assignment.status === "COMPLETED") {
    // A finished exam is not restarted by opening its URL again; a teacher reopens it explicitly.
    const last = await prisma.fullPracticeTestAttempt.findFirst({
      where: { assignmentId: assignment.id, status: "SUBMITTED" },
      orderBy: { submittedAt: "desc" },
      select: { id: true },
    });
    redirect(last ? `/student/tests/results/${last.id}` : "/student/tests");
  }
  if (query.start !== "1") {
    // Intro: nothing is created until the student presses Start (the attempt starts with the module).
    return <TestIntro assignment={assignment} attempt={attempt ?? null} moduleIndex={requestedModule} />;
  }
  if (viewer.readOnly) {
    // Teacher's Student view: a simulated sitting of this module (the player's preview mode): it starts
    // where the student is (their open attempt, read only) and creates, saves or scores nothing.
    const modules = attempt ? await fullTestModulesForAttempt(attempt) : assignment.test.modules;
    const completedModules = attempt ? completedModulesOf(attempt.moduleTimerState, modules.length) : [];
    if (attempt && requestedModule !== null && completedModules.includes(requestedModule)) {
      redirect(`/student/tests/results/${attempt.id}#mod-${moduleKeyFromIndex(requestedModule)}`);
    }
    const answers = attempt?.answers ?? [];
    return (
      <FullTestPlayer
        attemptId="preview"
        assignmentId={assignment.id}
        testName={assignment.test.name}
        breakMinutes={assignment.test.breakMinutes}
        modules={modules.map((module) => ({
          id: module.id,
          name: module.name,
          section: module.section,
          timeLimit: module.timeLimit,
          questions: module.questions.map((item) => ({
            id: item.question.id,
            stem: item.question.stem,
            stimulus: item.question.stimulus,
            type: item.question.type,
            imageUrl: item.question.imageUrl,
            options: item.question.options,
            graphArtifacts: item.question.supportsGraph ? extractQuestionGraphArtifacts(item.question) : [],
          })),
        }))}
        savedAnswers={Object.fromEntries(answers.map((answer) => [answer.questionId, answer.answer ?? ""]))}
        savedTimeSpent={Object.fromEntries(answers.map((answer) => [answer.questionId, answer.timeSpent ?? 0]))}
        savedModule={requestedModule ?? attempt?.currentModule ?? 0}
        savedQuestion={requestedModule === null || requestedModule === attempt?.currentModule ? attempt?.currentQuestion ?? 0 : 0}
        savedExpiredEvents={0}
        savedExtraTimeUsed={0}
        savedProgressState={null}
        calculatorConfig={getPublicCalculatorConfig()}
        showCalculator={await getFeatureSetting("CALCULATOR_FULL_TESTS")}
        previewMode
        previewNotice={`Student view of ${viewer.studentName}: this try is simulated — nothing is saved or scored.`}
        exitHref={`/student/tests/${assignment.id}${query.module ? `?module=${encodeURIComponent(query.module)}` : ""}`}
        completedModules={completedModules}
        startModule={requestedModule}
      />
    );
  }
  let createdHere = false;
  if (!attempt) {
    try {
      const created = await prisma.fullPracticeTestAttempt.create({
        data: {
          testId: assignment.testId,
          assignmentId: assignment.id,
          studentId: viewer.studentId,
          // RNF-17: freeze the exam as it is now; later edits never change this attempt.
          testSnapshot: buildFullTestSnapshot(assignment.testId, assignment.test.modules),
          // The assignment's "Show explanations in the player" when this attempt starts.
          showExplanations: assignment.showExplanations,
        },
      });
      attempt = await prisma.fullPracticeTestAttempt.findUniqueOrThrow({
        where: { id: created.id },
        include: { answers: true },
      });
      createdHere = true;
    } catch (error) {
      // Another request (second tab, double click) opened it first: the partial unique index allows
      // one IN_PROGRESS attempt per assignment, so reuse that one.
      if (!isUniqueConstraintError(error)) throw error;
      attempt = await prisma.fullPracticeTestAttempt.findFirstOrThrow({
        where: { assignmentId: assignment.id, status: "IN_PROGRESS" },
        include: { answers: true },
      });
    }
  }
  if (createdHere) {
    if (assignment.status === "PENDING") {
      await prisma.fullPracticeTestAssignment.update({ where: { id: assignment.id }, data: { status: "IN_PROGRESS" } });
    }
    await writeAudit({
      userId: viewer.studentId,
      action: "FPT_ATTEMPT_STARTED",
      targetType: "FullPracticeTestAttempt",
      targetId: attempt.id,
      outcome: "success",
      metadata: { testId: assignment.testId, assignmentId: assignment.id },
    });
    claimWriteSlot(`resumed:${attempt.id}`, RESUME_AUDIT_INTERVAL_MS);
  } else if (claimWriteSlot(`resumed:${attempt.id}`, RESUME_AUDIT_INTERVAL_MS)) {
    // Logged once per sitting, not on every page load (module switches and refreshes reload the page).
    await writeAudit({
      userId: viewer.studentId,
      action: "FPT_ATTEMPT_RESUMED",
      targetType: "FullPracticeTestAttempt",
      targetId: attempt.id,
      outcome: "info",
      metadata: { testId: assignment.testId, assignmentId: assignment.id },
    });
  }
  // Render the exam this attempt started with (snapshot), not the possibly-edited live exam.
  const modules = await fullTestModulesForAttempt(attempt);
  const savedProgressState = await getFullTestProgressState(attempt.id, modules.length);
  const completedModules = completedModulesOf(attempt.moduleTimerState, modules.length);
  if (requestedModule !== null && completedModules.includes(requestedModule)) {
    // A submitted module is locked: show its results instead.
    redirect(`/student/tests/results/${attempt.id}#mod-${moduleKeyFromIndex(requestedModule)}`);
  }
  const showCalculator = await getFeatureSetting("CALCULATOR_FULL_TESTS");

  return (
    <FullTestPlayer
      attemptId={attempt.id}
      assignmentId={assignment.id}
      testName={assignment.test.name}
      breakMinutes={assignment.test.breakMinutes}
      modules={modules.map((module) => ({
        id: module.id,
        name: module.name,
        section: module.section,
        timeLimit: module.timeLimit,
        questions: module.questions.map((item) => ({
          id: item.question.id,
          stem: item.question.stem,
          stimulus: item.question.stimulus,
          type: item.question.type,
          imageUrl: item.question.imageUrl,
          options: item.question.options,
          graphArtifacts: item.question.supportsGraph ? extractQuestionGraphArtifacts(item.question) : [],
        })),
      }))}
      savedAnswers={Object.fromEntries(attempt.answers.map((answer) => [answer.questionId, answer.answer ?? ""]))}
      // "When to show answers": Check per question only with answers after each question.
      checkAnswers={assignment.feedbackMode === "IMMEDIATE"}
      savedChecks={Object.fromEntries(
        attempt.answers.flatMap((answer) => {
          if (!answer.checkedAt || !answer.answer) return [];
          const question = modules.flatMap((m) => m.questions).find((q) => q.questionId === answer.questionId)?.question;
          if (!question) return [];
          return [[answer.questionId, {
            isCorrect: isAnswerCorrect(answer.answer, question.correctAnswer, resolveQuestionType(question.type, question.options)),
            answerKey: question.correctAnswer,
            correctAnswer: formatCorrectAnswer(question.correctAnswer),
            // "Show explanations in the player" of this attempt (assignment choice when it started).
            explanation: (attempt.showExplanations ?? assignment.showExplanations) ? question.explanation ?? null : null,
          }]];
        }),
      )}
      savedTimeSpent={Object.fromEntries(attempt.answers.map((answer) => [answer.questionId, answer.timeSpent ?? 0]))}
      savedMarked={attempt.answers.filter((answer) => answer.markedForReview).map((answer) => answer.questionId)}
      savedNotes={Object.fromEntries(attempt.answers.filter((answer) => answer.note).map((answer) => [answer.questionId, answer.note ?? ""]))}
      savedEliminated={Object.fromEntries(
        attempt.answers
          .map((answer) => [answer.questionId, parseEliminatedOptions(answer.eliminatedOptions)] as const)
          .filter(([, labels]) => labels.length > 0),
      )}
      savedModule={attempt.currentModule}
      savedQuestion={attempt.currentQuestion}
      savedExpiredEvents={attempt.timeExpiredEvents}
      savedExtraTimeUsed={attempt.extraTimeUsed}
      savedProgressState={savedProgressState}
      calculatorConfig={getPublicCalculatorConfig()}
      showCalculator={showCalculator}
      exitHref={`/student/tests?view=all#test-${assignment.id}`}
      resultQuery={returnParams.toString()}
      completedModules={completedModules}
      startModule={requestedModule}
    />
  );
}
