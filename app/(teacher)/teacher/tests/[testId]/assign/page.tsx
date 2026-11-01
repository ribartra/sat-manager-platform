import { redirect } from "next/navigation";
import { assignHref } from "@/lib/assign-params";

interface PageProps {
  params: Promise<{ testId: string }>;
}

/** Older URL: assigning a Test is the one Assign view with that Test preselected (student chosen there). */
export default async function AssignFullTestPage({ params }: PageProps) {
  const { testId } = await params;
  redirect(assignHref({ area: "tests", test: testId }));
}
