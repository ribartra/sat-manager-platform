import { redirect } from "next/navigation";
import { activeAreaTab } from "@/lib/practice-area";

interface PageProps {
  searchParams: Promise<{ area?: string }>;
}

/** Compare repeated the Home area tabs (% correct, weakest skill per student); old links land there. */
export default async function TeacherCompareRedirect({ searchParams }: PageProps) {
  const tab = activeAreaTab((await searchParams).area, "math");
  redirect(`/teacher?area=${tab === "tests" ? "tests" : tab}`);
}
