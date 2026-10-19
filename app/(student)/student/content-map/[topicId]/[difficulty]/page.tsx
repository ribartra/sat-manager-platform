import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import { resolvePracticeArea, tabFromPracticeArea } from "@/lib/practice-area";

interface PageProps {
  params: Promise<{ topicId: string; difficulty: string }>;
}

/**
 * A skill's sets at one level are listed on the Home area tab (same rows, with filters), so this
 * old page only forwards there.
 */
export default async function TopicPracticeSetsRedirect({ params }: PageProps) {
  const { topicId, difficulty } = await params;
  const topic = await prisma.topic.findUnique({ where: { id: topicId }, select: { domain: { select: { practiceArea: true } } } });
  const tab = tabFromPracticeArea(resolvePracticeArea(topic?.domain ?? {})) ?? "math";
  const query = new URLSearchParams({ area: tab, skill: topicId, difficulty: difficulty.toUpperCase() });
  redirect(`/student?${query.toString()}#sets`);
}
