import { redirect } from "next/navigation";
import { assignHref, parseAssignParams } from "@/lib/assign-params";
import { AssignView } from "./assign-view";

interface PageProps {
  /** See lib/assign-params.ts; `student` jumps to that student's Assign view. */
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/** The Assign view before a student is chosen (Assign on a Test or a Practice Set). */
export default async function AssignWithoutStudentPage({ searchParams }: PageProps) {
  const query = await searchParams;
  const student = typeof query.student === "string" ? query.student : "";
  if (student) redirect(assignHref({ ...parseAssignParams(query), studentId: student }));
  return <AssignView studentId={null} query={query} />;
}
