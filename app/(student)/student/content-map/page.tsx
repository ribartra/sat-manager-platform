import { redirect } from "next/navigation";
import { withQuery } from "@/lib/legacy-redirect";

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/** Legacy URL: the content map is now Practice (/student/practice); Tests live at /student/tests. */
export default async function LegacyContentMapPage({ searchParams }: PageProps) {
  const query = await searchParams;
  if (query.area === "tests" || query.area === "mocks") redirect("/student/tests");
  redirect(withQuery("/student/practice", query));
}
