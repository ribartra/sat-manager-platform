import { redirect } from "next/navigation";

/** Compare repeated the former Home area tabs; Home is one view now, old links land there. */
export default function TeacherCompareRedirect() {
  redirect("/teacher");
}
