import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function RootPage() {
  const session = await auth();
  if (!session) redirect("/login");
  const role = session.user.role;
  if (role === "TEACHER" || role === "ADMIN") redirect("/teacher");
  if (role === "PARENT") redirect("/parent");
  redirect("/student");
}
