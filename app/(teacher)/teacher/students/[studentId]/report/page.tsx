import { redirect } from "next/navigation";
import { buildProgressHref, progressFiltersFromParams } from "@/lib/progress-filters";

// The Individual Report was merged into the student page; the printable version is its
// "Download PDF" action. Old links land on the performance section with the same filters.
interface PageProps {
  params: Promise<{ studentId: string }>;
  searchParams: Promise<{ area?: string; topic?: string; difficulty?: string; from?: string; to?: string }>;
}

export default async function StudentReportRedirect({ params, searchParams }: PageProps) {
  const [{ studentId }, query] = await Promise.all([params, searchParams]);
  const href = buildProgressHref(`/teacher/students/${studentId}`, progressFiltersFromParams(query));
  redirect(`${href}#performance`);
}
