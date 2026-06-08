import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { notFound, redirect } from "next/navigation";
import { PracticeSetPlayer } from "./player-client";

interface PageProps {
  params: Promise<{ setId: string }>;
  searchParams: Promise<{ assignmentId?: string }>;
}

export default async function PracticePlayerPage({ params, searchParams }: PageProps) {
  const { setId } = await params;
  const { assignmentId } = await searchParams;
  const session = await auth();
  const userId = session!.user.id;

  const practiceSet = await prisma.practiceSet.findUnique({
    where: { id: setId },
    include: {
      topic: { include: { domain: { include: { section: true } } } },
      questions: {
        include: {
          question: {
            include: { options: { orderBy: { label: "asc" } } },
          },
        },
        orderBy: { order: "asc" },
      },
    },
  });

  if (!practiceSet || practiceSet.status !== "PUBLISHED") notFound();

  // Check student has access (assignment exists and is not locked)
  if (session!.user.role === "STUDENT" && assignmentId) {
    const assignment = await prisma.assignment.findFirst({
      where: { id: assignmentId, studentId: userId, locked: false },
    });
    if (!assignment || (assignment.unlockAt && assignment.unlockAt > new Date())) redirect("/student");
  }

  // Find or create an in-progress attempt
  let attempt = await prisma.attempt.findFirst({
    where: { studentId: userId, practiceSetId: setId, status: "IN_PROGRESS" },
    include: { answers: true },
    orderBy: { startedAt: "desc" },
  });

  if (!attempt) {
    // Get attempt number
    const prevAttempts = await prisma.attempt.count({
      where: { studentId: userId, practiceSetId: setId },
    });
    attempt = await prisma.attempt.create({
      data: {
        studentId: userId,
        practiceSetId: setId,
        assignmentId: assignmentId ?? null,
        attemptNumber: prevAttempts + 1,
        status: "IN_PROGRESS",
        currentQuestion: 0,
      },
      include: { answers: true },
    });
  }

  const savedAnswers: Record<string, string> = {};
  const savedTimeSpent: Record<string, number> = {};
  const savedMarked: string[] = [];
  const savedNotes: Record<string, string> = {};
  const savedEliminated: Record<string, string[]> = {};
  attempt.answers.forEach((a) => {
    if (a.answer) savedAnswers[a.questionId] = a.answer;
    if (a.timeSpent) savedTimeSpent[a.questionId] = a.timeSpent;
    if (a.markedForReview) savedMarked.push(a.questionId);
    if (a.note) savedNotes[a.questionId] = a.note;
    if (a.eliminatedOptions) {
      try {
        savedEliminated[a.questionId] = JSON.parse(a.eliminatedOptions) as string[];
      } catch {
        savedEliminated[a.questionId] = [];
      }
    }
  });

  const questions = practiceSet.questions.map((item) => ({
    id: item.question.id,
    stem: item.question.stem,
    stimulus: item.question.stimulus,
    type: item.question.type,
    difficulty: item.question.difficulty,
    options: item.question.options,
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
    />
  );
}
