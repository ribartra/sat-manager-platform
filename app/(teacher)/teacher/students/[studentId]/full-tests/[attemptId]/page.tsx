import { redirect } from "next/navigation";
import { withQuery } from "@/lib/legacy-redirect";

interface PageProps { params: Promise<{ studentId: string; attemptId: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }

/** Legacy URL → /teacher/students/[studentId]/tests/[attemptId]. */
export default async function LegacyTeacherTestAttemptPage({ params, searchParams }: PageProps) {
  const { studentId, attemptId } = await params;
  redirect(withQuery(`/teacher/students/${studentId}/tests/${attemptId}`, await searchParams));
}
