import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { withSqliteRetry } from "@/lib/sqlite-retry";
import { notFound, redirect } from "next/navigation";
import { renderPracticePlayer } from "../../practice-player-page";

interface PageProps {
  params: Promise<{ assignmentId: string }>;
  searchParams: Promise<{ area?: string; topic?: string; difficulty?: string; from?: string; to?: string }>;
}

export default async function PracticeAssignmentPlayerPage({ params, searchParams }: PageProps) {
  const { assignmentId } = await params;
  const query = await searchParams;
  const area = query.area === "reading" || query.area === "writing" ? query.area : "math";
  const returnParams = new URLSearchParams({ area });
  for (const key of ["topic", "difficulty", "from", "to"] as const) {
    if (query[key]) returnParams.set(key, query[key]!);
  }
  const session = await auth();
  if (!session) redirect("/login");

  const assignment = await withSqliteRetry(() => prisma.assignment.findFirst({
    where: {
      id: assignmentId,
      ...(session.user.role === "STUDENT" ? { studentId: session.user.id } : {}),
    },
    select: { id: true, practiceSetId: true, feedbackMode: true },
  }));

  if (!assignment) notFound();

  return renderPracticePlayer({
    setId: assignment.practiceSetId,
    assignmentId: assignment.id,
    feedbackMode: assignment.feedbackMode === "IMMEDIATE" ? "IMMEDIATE" : "AFTER_SET",
    exitHref: `/student/content-map?${returnParams.toString()}`,
    resultQuery: returnParams.toString(),
  });
}
