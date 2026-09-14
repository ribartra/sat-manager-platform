import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { withSqliteRetry } from "@/lib/sqlite-retry";
import { notFound, redirect } from "next/navigation";
import { renderPracticePlayer } from "../../practice-player-page";

interface PageProps {
  params: Promise<{ assignmentId: string }>;
}

export default async function PracticeAssignmentPlayerPage({ params }: PageProps) {
  const { assignmentId } = await params;
  const session = await auth();
  if (!session) redirect("/login");

  const assignment = await withSqliteRetry(() => prisma.assignment.findFirst({
    where: {
      id: assignmentId,
      ...(session.user.role === "STUDENT" ? { studentId: session.user.id } : {}),
    },
    select: { id: true, practiceSetId: true },
  }));

  if (!assignment) notFound();

  return renderPracticePlayer({
    setId: assignment.practiceSetId,
    assignmentId: assignment.id,
  });
}
