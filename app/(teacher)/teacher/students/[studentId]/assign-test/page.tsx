import { redirect } from "next/navigation";
import { assignHref, parseAssignParams } from "@/lib/assign-params";

interface PageProps {
  params: Promise<{ studentId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/** Older URL: Assign test is the Tests area of the one Assign view (`test=` kept). */
export default async function AssignTestPage({ params, searchParams }: PageProps) {
  const [{ studentId }, query] = await Promise.all([params, searchParams]);
  redirect(assignHref({ ...parseAssignParams(query), area: "tests", studentId }));
}
