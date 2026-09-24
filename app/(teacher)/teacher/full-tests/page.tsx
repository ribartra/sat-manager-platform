import { redirect } from "next/navigation";

export default async function FullTestsPage() {
  redirect("/teacher/practice-sets?area=mocks");
}
