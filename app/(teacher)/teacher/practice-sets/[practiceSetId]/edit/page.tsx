import { redirect } from "next/navigation";

/** Older URL: a practice set is edited on its own page (`?edit`). */
export default async function EditPracticeSetPage({ params }: { params: Promise<{ practiceSetId: string }> }) {
  const { practiceSetId } = await params;
  redirect(`/teacher/practice-sets/${practiceSetId}?edit`);
}
