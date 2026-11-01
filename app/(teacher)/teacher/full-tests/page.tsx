import { redirect } from "next/navigation";

/** Legacy URL: Tests now live at /teacher/tests. */
export default function LegacyTeacherFullTestsPage() {
  redirect("/teacher/tests");
}
