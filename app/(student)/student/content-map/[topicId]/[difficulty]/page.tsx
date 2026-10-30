import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import { resolvePracticeArea, tabFromPracticeArea } from "@/lib/practice-area";

interface PageProps {
  params: Promise<{ topicId: string; difficulty: string }>;
}

/** A skill's sets are on Practice (its area), so this old page only forwards there. */
export default async function TopicPracticeSetsRedirect({ params }: PageProps) {
  const { topicId } = await params;
  const topic = await prisma.topic.findUnique({ where: { id: topicId }, select: { domain: { select: { practiceArea: true } } } });
  const tab = tabFromPracticeArea(resolvePracticeArea(topic?.domain ?? {})) ?? "math";
  redirect(`/student/practice?area=${tab}`);
}
