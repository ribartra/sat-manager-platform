import { notFound } from "next/navigation";
import { requireTeacherOrAdmin } from "@/lib/rbac";
import prisma from "@/lib/prisma";
import { contentScopeFor } from "@/lib/program-scope";
import { renderPracticePlayer } from "@/app/(student)/student/practice/practice-player-page";

interface PageProps {
  params: Promise<{ practiceSetId: string }>;
}

export default async function PracticeSetPreviewPage({ params }: PageProps) {
  const session = await requireTeacherOrAdmin();
  if (!session) notFound();
  const { practiceSetId } = await params;
  // Only sets of a program the teacher teaches (shared bank).
  const allowed = await prisma.practiceSet.findFirst({ where: { id: practiceSetId, ...contentScopeFor(session.user) }, select: { id: true } });
  if (!allowed) notFound();

  return renderPracticePlayer({
    setId: practiceSetId,
    feedbackMode: "AFTER_SET",
    previewMode: true,
    exitHref: `/teacher/practice-sets/${practiceSetId}`,
  });
}
