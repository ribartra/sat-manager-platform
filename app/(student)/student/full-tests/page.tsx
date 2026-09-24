import { redirect } from "next/navigation";

export default async function StudentFullTestsPage() {
  redirect("/student/content-map?area=mocks");
}
