import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { NavTeacher } from "@/components/nav-teacher";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function TeacherLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session) redirect("/login");
  if (!["TEACHER", "ADMIN"].includes(session.user.role)) redirect("/student");
  if (session.user.role === "TEACHER") {
    const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { active: true } });
    if (!user?.active) redirect("/login");
  }

  return (
    <div className="min-h-screen flex flex-col">
      <NavTeacher userName={session.user.name} role={session.user.role} />
      <main className="flex-1 bg-gray-50">{children}</main>
    </div>
  );
}
