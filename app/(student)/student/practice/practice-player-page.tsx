import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { notFound, redirect } from "next/navigation";
import { PracticeSetPlayer } from "./player-client";
import {
  buildPracticeSetSnapshot,
  buildQuestionSnapshot,
  stringifySnapshot,
} from "@/lib/attempt-snapshots";
import { getPublicCalculatorConfig } from "@/lib/calculator-config";
import { getFeatureSetting } from "@/lib/app-settings";
import { extractQuestionGraphArtifacts } from "@/lib/question-graph";
import { writeAudit } from "@/lib/audit";
import { withSqliteRetry } from "@/lib/sqlite-retry";

interface PracticePlayerInput {
  setId: string;
  assignmentId?: string;
  feedbackMode?: "IMMEDIATE" | "AFTER_SET";
  previewMode?: boolean;
  exitHref?: string;
  resultQuery?: string;
}

export async function renderPracticePlayer({
  setId,
  assignmentId,
  feedbackMode = "AFTER_SET",
  previewMode = false,
  exitHref,
  resultQuery,
}: PracticePlayerInput) {
  const session = await auth();
  if (!session) redirect("/login");
  const userId = session.user.id;

  const practiceSet = await withSqliteRetry(() => prisma.practiceSet.findUnique({
    where: { id: setId },
    include: {
      topic: { include: { domain: { include: { section: true } } } },
      questions: {
        include: {
          question: {
            include: {
              options: { orderBy: { label: "asc" } },
              topic: { include: { domain: { include: { section: true } } } },
            },
          },
        },
        orderBy: { order: "asc" },
      },
    },
  }));

  if (!practiceSet) notFound();
  // Teacher preview may open drafts; students only get published sets.
  if (!previewMode && practiceSet.status !== "PUBLISHED") notFound();

  if (!previewMode && session.user.role === "STUDENT") {
    if (!assignmentId) redirect("/student");
    const assignment = await withSqliteRetry(() => prisma.assignment.findFirst({
      where: { id: assignmentId, studentId: userId, practiceSetId: setId, locked: false },
    }));
    if (!assignment || (assignment.unlockAt && assignment.unlockAt > new Date())) redirect("/student");
  }

  const questions = practiceSet.questions.map((item) => ({
    id: item.question.id,
    stem: item.question.stem,
    stimulus: item.question.stimulus,
    imageUrl: item.question.imageUrl,
    type: item.question.type,
    difficulty: item.question.difficulty,
    options: item.question.options,
    graphArtifacts: item.question.supportsGraph ? extractQuestionGraphArtifacts(item.question) : [],
    ...(feedbackMode === "IMMEDIATE" || previewMode
      ? {
          correctAnswer: item.question.correctAnswer,
          explanation: item.question.explanation,
        }
      : {}),
  }));

  const calculatorEnabled =
    practiceSet.topic.domain.section.name === "MATH" &&
    (await getFeatureSetting("CALCULATOR_PRACTICE_SETS"));

  if (previewMode) {
    return (
      <PracticeSetPlayer
        practiceSetId={setId}
        assignmentId={null}
        attemptId="preview"
        questions={questions}
        savedAnswers={{}}
        savedMarked={[]}
        savedNotes={{}}
        savedEliminated={{}}
        savedQuestion={0}
        savedTime={0}
        savedTimeSpent={{}}
        setName={practiceSet.name}
        showCalculator={calculatorEnabled}
        calculatorConfig={getPublicCalculatorConfig()}
        feedbackMode={feedbackMode}
        previewMode
        exitHref={exitHref ?? `/teacher/practice-sets/${setId}/edit`}
      />
    );
  }

  const practiceSetSnapshot = stringifySnapshot(
    buildPracticeSetSnapshot({
      ...practiceSet,
      questions: practiceSet.questions.map((item) => ({
        questionId: item.questionId,
        order: item.order,
      })),
    })
  );
  const questionSnapshots = practiceSet.questions.map((item) => ({
    questionId: item.questionId,
    questionSnapshot: stringifySnapshot(buildQuestionSnapshot(item)),
  }));

  let attempt = await withSqliteRetry(() => prisma.attempt.findFirst({
    where: { studentId: userId, practiceSetId: setId, assignmentId: assignmentId ?? null, status: "IN_PROGRESS" },
    include: { answers: true },
    orderBy: { startedAt: "desc" },
  }));

  if (!attempt) {
    const prevAttempts = await withSqliteRetry(() => prisma.attempt.count({
      where: { studentId: userId, practiceSetId: setId },
    }));
    attempt = await withSqliteRetry(() => prisma.attempt.create({
      data: {
        studentId: userId,
        practiceSetId: setId,
        practiceSetSnapshot,
        assignmentId: assignmentId ?? null,
        attemptNumber: prevAttempts + 1,
        status: "IN_PROGRESS",
        currentQuestion: 0,
      },
      include: { answers: true },
    }));
    const createdAttemptId = attempt.id;
    await Promise.all(
      questionSnapshots.map((snapshot) =>
      withSqliteRetry(() => prisma.attemptAnswer.upsert({
          where: { attemptId_questionId: { attemptId: createdAttemptId, questionId: snapshot.questionId } },
          update: { questionSnapshot: snapshot.questionSnapshot },
          create: {
            attemptId: createdAttemptId,
            questionId: snapshot.questionId,
            questionSnapshot: snapshot.questionSnapshot,
          },
      }))
      )
    );
    if (assignmentId) {
      await withSqliteRetry(() => prisma.assignment.update({
        where: { id: assignmentId },
        data: { status: "IN_PROGRESS" },
      }));
    }
    attempt = await withSqliteRetry(() => prisma.attempt.findUniqueOrThrow({
      where: { id: createdAttemptId },
      include: { answers: true },
    }));
    await writeAudit({
      userId,
      action: "ATTEMPT_STARTED",
      targetType: "Attempt",
      targetId: attempt.id,
      outcome: "success",
      metadata: { practiceSetId: setId, assignmentId: assignmentId ?? null, attemptNumber: attempt.attemptNumber },
    });
  } else {
    await writeAudit({
      userId,
      action: "ATTEMPT_RESUMED",
      targetType: "Attempt",
      targetId: attempt.id,
      outcome: "info",
      metadata: { practiceSetId: setId, assignmentId: assignmentId ?? null },
    });
  }

  if (!attempt) throw new Error("Practice attempt could not be initialized.");

  if (!attempt.practiceSetSnapshot) {
    const activeAttemptId = attempt.id;
    await withSqliteRetry(() => prisma.attempt.update({
      where: { id: activeAttemptId },
      data: { practiceSetSnapshot },
    }));
    await Promise.all(
      questionSnapshots.map((snapshot) =>
        withSqliteRetry(() => prisma.attemptAnswer.upsert({
          where: { attemptId_questionId: { attemptId: activeAttemptId, questionId: snapshot.questionId } },
          update: { questionSnapshot: snapshot.questionSnapshot },
          create: {
            attemptId: activeAttemptId,
            questionId: snapshot.questionId,
            questionSnapshot: snapshot.questionSnapshot,
          },
        }))
      )
    );
    attempt = await withSqliteRetry(() => prisma.attempt.findUniqueOrThrow({
      where: { id: activeAttemptId },
      include: { answers: true },
    }));
  }

  const savedAnswers: Record<string, string> = {};
  const savedTimeSpent: Record<string, number> = {};
  const savedMarked: string[] = [];
  const savedNotes: Record<string, string> = {};
  const savedEliminated: Record<string, string[]> = {};
  attempt.answers.forEach((answer) => {
    if (answer.answer) savedAnswers[answer.questionId] = answer.answer;
    if (answer.timeSpent) savedTimeSpent[answer.questionId] = answer.timeSpent;
    if (answer.markedForReview) savedMarked.push(answer.questionId);
    if (answer.note) savedNotes[answer.questionId] = answer.note;
    if (answer.eliminatedOptions) {
      try {
        savedEliminated[answer.questionId] = JSON.parse(answer.eliminatedOptions) as string[];
      } catch {
        savedEliminated[answer.questionId] = [];
      }
    }
  });

  return (
    <PracticeSetPlayer
      practiceSetId={setId}
      assignmentId={assignmentId ?? null}
      attemptId={attempt.id}
      questions={questions}
      savedAnswers={savedAnswers}
      savedMarked={savedMarked}
      savedNotes={savedNotes}
      savedEliminated={savedEliminated}
      savedQuestion={attempt.currentQuestion}
      savedTime={attempt.totalTime ?? 0}
      savedTimeSpent={savedTimeSpent}
      setName={practiceSet.name}
      showCalculator={calculatorEnabled}
      calculatorConfig={getPublicCalculatorConfig()}
      feedbackMode={feedbackMode}
      exitHref={exitHref ?? "/student/content-map"}
      resultHref={`/student/results/${attempt.id}${resultQuery ? `?${resultQuery}` : ""}`}
    />
  );
}
