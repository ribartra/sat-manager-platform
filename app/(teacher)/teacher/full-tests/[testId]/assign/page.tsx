import { redirect } from "next/navigation";
import { withQuery } from "@/lib/legacy-redirect";

interface PageProps { params: Promise<{ testId: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }

/** Legacy URL → /teacher/tests/[testId]/assign. */
export default async function LegacyTeacherTestAssignPage({ params, searchParams }: PageProps) {
  const { testId } = await params;
  redirect(withQuery(`/teacher/tests/${testId}/assign`, await searchParams));
}
