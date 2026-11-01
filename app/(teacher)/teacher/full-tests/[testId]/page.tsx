import { redirect } from "next/navigation";
import { withQuery } from "@/lib/legacy-redirect";

interface PageProps { params: Promise<{ testId: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }

/** Legacy URL → /teacher/tests/[testId]. */
export default async function LegacyTeacherTestPage({ params, searchParams }: PageProps) {
  const { testId } = await params;
  redirect(withQuery(`/teacher/tests/${testId}`, await searchParams));
}
