import { redirect } from "next/navigation";

/** Legacy URL → /teacher/tests/scoring. */
export default function LegacyTeacherTestsScoringPage() {
  redirect("/teacher/tests/scoring");
}
