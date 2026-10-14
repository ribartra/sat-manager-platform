import { redirect } from "next/navigation";
import { withQuery } from "@/lib/legacy-redirect";

interface PageProps { params: Promise<{ attemptId: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }

/** Legacy URL → /student/tests/results/[attemptId]. */
export default async function LegacyFullTestResultsPage({ params, searchParams }: PageProps) {
  const { attemptId } = await params;
  redirect(withQuery(`/student/tests/results/${attemptId}`, await searchParams));
}
