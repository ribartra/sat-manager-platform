import { notFound } from "next/navigation";
import { requireTeacherOrAdmin } from "@/lib/rbac";
import { renderPracticePlayer } from "@/app/(student)/student/practice/practice-player-page";

interface PageProps {
  params: Promise<{ setId: string }>;
}

export default async function PracticeSetPreviewPage({ params }: PageProps) {
  const session = await requireTeacherOrAdmin();
  if (!session) notFound();
  const { setId } = await params;

  return renderPracticePlayer({
    setId,
    feedbackMode: "AFTER_SET",
    previewMode: true,
    exitHref: `/teacher/practice-sets/${setId}/edit`,
  });
}
