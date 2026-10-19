import { redirect } from "next/navigation";

interface PageProps {
  params: Promise<{ topicId: string }>;
}

/** A skill's sets now live in Practice → Manage sets, filtered by that skill (its area is resolved there). */
export default async function TeacherContentTopicRedirect({ params }: PageProps) {
  const { topicId } = await params;
  redirect(`/teacher/practice-sets?view=manage&topic=${encodeURIComponent(topicId)}`);
}
