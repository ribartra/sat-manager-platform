import { parseEliminatedOptions } from "@/lib/answer-review-meta";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { notFound, redirect } from "next/navigation";
import { FullTestPlayer } from "./player-client";
import { getFullTestProgressState } from "@/lib/full-test-progress";
import { getPublicCalculatorConfig } from "@/lib/calculator-config";
import { getFeatureSetting } from "@/lib/app-settings";
import { extractQuestionGraphArtifacts } from "@/lib/question-graph";
import { writeAudit } from "@/lib/audit";
import { buildFullTestSnapshot, fullTestModulesForAttempt, fullTestModulesInclude } from "@/lib/full-test-snapshot";

interface PageProps { params: Promise<{ assignmentId: string }>; searchParams: Promise<{ area?: string; from?: string; to?: string }> }

export default async function FullTestPlayerPage({ params, searchParams }: PageProps) {
  const { assignmentId } = await params;
  const query = await searchParams;
  const returnParams = new URLSearchParams({ area: "mocks" });
  for (const key of ["from", "to"] as const) {
    if (query[key]) returnParams.set(key, query[key]!);
  }
  const session = await auth();
  const assignment = await prisma.fullPracticeTestAssignment.findFirst({
    where: { id: assignmentId, studentId: session!.user.id },
    include: {
      test: {
        include: {
          modules: { include: fullTestModulesInclude, orderBy: { order: "asc" } },
        },
      },
      attempts: { where: { status: "IN_PROGRESS" }, include: { answers: true }, take: 1 },
    },
  });
  if (!assignment) notFound();

  let attempt = assignment.attempts[0];
  if (!attempt && assignment.status === "COMPLETED") {
    // A finished exam is not restarted by opening its URL again; a teacher reopens it explicitly.
    const last = await prisma.fullPracticeTestAttempt.findFirst({
      where: { assignmentId: assignment.id, status: "SUBMITTED" },
      orderBy: { submittedAt: "desc" },
      select: { id: true },
    });
    redirect(last ? `/student/full-tests/results/${last.id}?${returnParams.toString()}` : `/student/content-map?${returnParams.toString()}`);
  }
  if (!attempt) {
    const created = await prisma.fullPracticeTestAttempt.create({
      data: {
        testId: assignment.testId,
        assignmentId: assignment.id,
        studentId: session!.user.id,
        // RNF-17: freeze the exam as it is now; later edits never change this attempt.
        testSnapshot: buildFullTestSnapshot(assignment.testId, assignment.test.modules),
      },
    });
    attempt = await prisma.fullPracticeTestAttempt.findUniqueOrThrow({
      where: { id: created.id },
      include: { answers: true },
    });
    if (assignment.status === "PENDING") {
      await prisma.fullPracticeTestAssignment.update({ where: { id: assignment.id }, data: { status: "IN_PROGRESS" } });
    }
    await writeAudit({
      userId: session!.user.id,
      action: "FPT_ATTEMPT_STARTED",
      targetType: "FullPracticeTestAttempt",
      targetId: attempt.id,
      outcome: "success",
      metadata: { testId: assignment.testId, assignmentId: assignment.id },
    });
  } else {
    await writeAudit({
      userId: session!.user.id,
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
      exitHref={`/student/content-map?${returnParams.toString()}`}
      resultQuery={returnParams.toString()}
    />
  );
}
