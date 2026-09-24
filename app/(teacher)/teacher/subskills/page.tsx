import { redirect } from "next/navigation";

export default async function SubskillsPage() {
  redirect("/teacher/practice-sets?area=math");
}
