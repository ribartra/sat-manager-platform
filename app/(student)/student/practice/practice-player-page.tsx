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
import { extractQuestionGraphArtifacts } from "@/lib/question-graph";

interface PracticePlayerInput {
  setId: string;
  assignmentId?: string;
}

export async function renderPracticePlayer({ setId, assignmentId }: PracticePlayerInput) {
  const session = await auth();
  if (!session) redirect("/login");
  const userId = session.user.id;

  const practiceSet = await prisma.practiceSet.findUnique({
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
  });

  if (!practiceSet || practiceSet.status !== "PUBLISHED") notFound();

  if (session.user.role === "STUDENT") {
    if (!assignmentId) redirect("/student");
    const assignment = await prisma.assignment.findFirst({
      where: { id: assignmentId, studentId: userId, practiceSetId: setId, locked: false },
    });
    if (!assignment || (assignment.unlockAt && assignment.unlockAt > new Date())) redirect("/student");
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

  let attempt = await prisma.attempt.findFirst({
    where: { studentId: userId, practiceSetId: setId, assignmentId: assignmentId ?? null, status: "IN_PROGRESS" },
    include: { answers: true },
    orderBy: { startedAt: "desc" },
  });

  if (!attempt) {
    const prevAttempts = await prisma.attempt.count({
      where: { studentId: userId, practiceSetId: setId },
    });
    attempt = await prisma.attempt.create({
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
    });
    await Promise.all(
      questionSnapshots.map((snapshot) =>
        prisma.attemptAnswer.upsert({
          where: { attemptId_questionId: { attemptId: attempt!.id, questionId: snapshot.questionId } },
          update: { questionSnapshot: snapshot.questionSnapshot },
          create: {
            attemptId: attempt!.id,
            questionId: snapshot.questionId,
            questionSnapshot: snapshot.questionSnapshot,
          },
        })
      )
    );
    if (assignmentId) {
      await prisma.assignment.update({
        where: { id: assignmentId },
        data: { status: "IN_PROGRESS" },
      });
    }
    attempt = await prisma.attempt.findUniqueOrThrow({
      where: { id: attempt.id },
      include: { answers: true },
    });
  } else if (!attempt.practiceSetSnapshot) {
    await prisma.attempt.update({
      where: { id: attempt.id },
      data: { practiceSetSnapshot },
    });
    await Promise.all(
      questionSnapshots.map((snapshot) =>
        prisma.attemptAnswer.upsert({
          where: { attemptId_questionId: { attemptId: attempt!.id, questionId: snapshot.questionId } },
          update: { questionSnapshot: snapshot.questionSnapshot },
          create: {
            attemptId: attempt!.id,
            questionId: snapshot.questionId,
            questionSnapshot: snapshot.questionSnapshot,
          },
        })
      )
    );
    attempt = await prisma.attempt.findUniqueOrThrow({
      where: { id: attempt.id },
      include: { answers: true },
    });
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

  const questions = practiceSet.questions.map((item) => ({
    id: item.question.id,
    stem: item.question.stem,
    stimulus: item.question.stimulus,
    imageUrl: item.question.imageUrl,
    type: item.question.type,
    difficulty: item.question.difficulty,
    options: item.question.options,
    graphArtifacts: item.question.supportsGraph ? extractQuestionGraphArtifacts(item.question) : [],
  }));

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
      showCalculator={practiceSet.topic.domain.section.name === "MATH"}
      calculatorConfig={getPublicCalculatorConfig()}
    />
  );
}
