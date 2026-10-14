import { redirect } from "next/navigation";

export default async function StudentPracticeSetsPage() {
  redirect("/student/practice?area=math");
}
