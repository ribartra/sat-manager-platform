import { getStudentViewer } from "@/lib/student-viewer";
import prisma from "@/lib/prisma";
import { withSqliteRetry } from "@/lib/sqlite-retry";
import { notFound, redirect } from "next/navigation";
import { renderPracticePlayer } from "../../practice-player-page";
import { PracticeIntro } from "./practice-intro";

interface PageProps {
  params: Promise<{ assignmentId: string }>;
  searchParams: Promise<{ area?: string; topic?: string; difficulty?: string; from?: string; to?: string; start?: string }>;
}

export default async function PracticeAssignmentPlayerPage({ params, searchParams }: PageProps) {
  const { assignmentId } = await params;
  const query = await searchParams;
  const area = query.area === "reading" || query.area === "writing" ? query.area : "math";
  const returnParams = new URLSearchParams({ area });
  for (const key of ["topic", "difficulty", "from", "to"] as const) {
    if (query[key]) returnParams.set(key, query[key]!);
  }
  // The student shown: the signed-in student, or the teacher's Student view (nothing is saved as the student).
  const viewer = await getStudentViewer();
  if (!viewer) redirect("/login");

  const assignment = await withSqliteRetry(() => prisma.assignment.findFirst({
    where: {
      id: assignmentId,
      studentId: viewer.studentId,
    },
    select: { id: true, practiceSetId: true, feedbackMode: true, showExplanations: true },
  }));

  if (!assignment) notFound();
  // Intro first (mockup practice.html): previous tries, dates, Start/Continue. `?start=1` opens the player.
  // In a teacher's Student view, Start / Continue open a simulated try (nothing is saved).
  if (query.start !== "1") {
    return <PracticeIntro studentId={viewer.studentId} assignmentId={assignment.id} />;
  }

  return renderPracticePlayer({
    setId: assignment.practiceSetId,
    assignmentId: assignment.id,
    feedbackMode: assignment.feedbackMode === "IMMEDIATE" ? "IMMEDIATE" : "AFTER_SET",
    showExplanations: assignment.showExplanations,
    exitHref: `/student/practice?${returnParams.toString()}`,
    resultQuery: returnParams.toString(),
  });
}
