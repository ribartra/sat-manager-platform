import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { notFound } from "next/navigation";
import { FullTestPlayer } from "./player-client";
import { getFullTestProgressState } from "@/lib/full-test-progress";
import { getPublicCalculatorConfig } from "@/lib/calculator-config";
import { getFeatureSetting } from "@/lib/app-settings";
import { extractQuestionGraphArtifacts } from "@/lib/question-graph";
import { writeAudit } from "@/lib/audit";

interface PageProps { params: Promise<{ assignmentId: string }> }

export default async function FullTestPlayerPage({ params }: PageProps) {
  const { assignmentId } = await params;
  const session = await auth();
  const assignment = await prisma.fullPracticeTestAssignment.findFirst({
    where: { id: assignmentId, studentId: session!.user.id },
    include: {
      test: {
        include: {
          modules: {
            include: {
              questions: {
                include: { question: { include: { options: { orderBy: { label: "asc" } } } } },
                orderBy: { order: "asc" },
              },
            },
            orderBy: { order: "asc" },
          },
        },
      },
      attempts: { where: { status: "IN_PROGRESS" }, include: { answers: true }, take: 1 },
    },
  });
  if (!assignment) notFound();

  let attempt = assignment.attempts[0];
  if (!attempt) {
    const created = await prisma.fullPracticeTestAttempt.create({
      data: { testId: assignment.testId, assignmentId: assignment.id, studentId: session!.user.id },
    });
    attempt = await prisma.fullPracticeTestAttempt.findUniqueOrThrow({
      where: { id: created.id },
      include: { answers: true },
    });
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
  const savedProgressState = await getFullTestProgressState(attempt.id, assignment.test.modules.length);
  const showCalculator = await getFeatureSetting("CALCULATOR_FULL_TESTS");

  return (
    <FullTestPlayer
      attemptId={attempt.id}
      assignmentId={assignment.id}
      testName={assignment.test.name}
      breakMinutes={assignment.test.breakMinutes}
      modules={assignment.test.modules.map((module) => ({
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
      savedModule={attempt.currentModule}
      savedQuestion={attempt.currentQuestion}
      savedExpiredEvents={attempt.timeExpiredEvents}
      savedExtraTimeUsed={attempt.extraTimeUsed}
      savedProgressState={savedProgressState}
      calculatorConfig={getPublicCalculatorConfig()}
      showCalculator={showCalculator}
    />
  );
}
