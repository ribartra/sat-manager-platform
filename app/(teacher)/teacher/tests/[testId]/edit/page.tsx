import { redirect } from "next/navigation";

/** Older URL: a Test is edited on its own page (`?edit`). */
export default async function EditFullTestPage({ params }: { params: Promise<{ testId: string }> }) {
  const { testId } = await params;
  redirect(`/teacher/tests/${testId}?edit`);
}
