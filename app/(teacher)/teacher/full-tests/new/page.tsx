import { redirect } from "next/navigation";

/** Legacy URL → /teacher/tests/new. */
export default function LegacyTeacherTestsNewPage() {
  redirect("/teacher/tests/new");
}
