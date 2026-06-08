import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function RootPage() {
  const session = await auth();
  if (!session) redirect("/login");
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { active: true, validationStatus: true },
  });
  if (!user?.active) redirect("/login");
  if (user.validationStatus !== "APPROVED") redirect("/auth/pending-validation");

  const role = session.user.role;
  if (role === "TEACHER" || role === "ADMIN") redirect("/teacher");
  if (role === "PARENT") redirect("/parent");
  redirect("/student");
}
