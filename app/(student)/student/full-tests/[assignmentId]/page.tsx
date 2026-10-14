import { redirect } from "next/navigation";
import { withQuery } from "@/lib/legacy-redirect";

interface PageProps { params: Promise<{ assignmentId: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }

/** Legacy URL → /student/tests/[assignmentId]. */
export default async function LegacyFullTestPlayerPage({ params, searchParams }: PageProps) {
  const { assignmentId } = await params;
  redirect(withQuery(`/student/tests/${assignmentId}`, await searchParams));
}
