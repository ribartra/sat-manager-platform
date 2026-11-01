import { redirect } from "next/navigation";

/** Legacy URL: Tests now live at /student/tests. */
export default function LegacyFullTestsPage() {
  redirect("/student/tests");
}
