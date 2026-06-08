import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { notFound } from "next/navigation";
import { FullTestPlayer } from "./player-client";

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
            include: { questions: { include: { question: { include: { options: { orderBy: { label: "asc" } } } } }, orderBy: { order: "asc" } } },
            orderBy: { order: "asc" },
          },
        },
      },
      attempts: { where: { status: "IN_PROGRESS" }, take: 1 },
    },
  });
  if (!assignment) notFound();

  let attempt = assignment.attempts[0];
  if (!attempt) {
    attempt = await prisma.fullPracticeTestAttempt.create({
      data: { testId: assignment.testId, assignmentId: assignment.id, studentId: session!.user.id },
    });
  }

  return (
    <FullTestPlayer
      attemptId={attempt.id}
      assignmentId={assignment.id}
      testName={assignment.test.name}
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
          options: item.question.options,
        })),
      }))}
    />
  );
}
