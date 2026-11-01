import { redirect } from "next/navigation";
import { withQuery } from "@/lib/legacy-redirect";

interface PageProps { params: Promise<{ studentId: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }

/** Legacy URL → /teacher/students/[studentId]/assign-test. */
export default async function LegacyAssignExamPage({ params, searchParams }: PageProps) {
  const { studentId } = await params;
  redirect(withQuery(`/teacher/students/${studentId}/assign-test`, await searchParams));
}
