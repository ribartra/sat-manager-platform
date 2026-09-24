import { redirect } from "next/navigation";

export default async function StudentPracticeSetsPage() {
  redirect("/student/content-map?area=math");
}
