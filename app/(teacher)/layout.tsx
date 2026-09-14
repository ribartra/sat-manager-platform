import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { NavTeacher } from "@/components/nav-teacher";
import prisma from "@/lib/prisma";
import { getFeatureFlagValues } from "@/lib/feature-flags";

export const dynamic = "force-dynamic";

export default async function TeacherLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session) redirect("/login");
  if (!["TEACHER", "ADMIN"].includes(session.user.role)) redirect("/student");
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { active: true, validationStatus: true, avatarUrl: true },
  });
  if (!user?.active) redirect("/login");
  if (user.validationStatus !== "APPROVED") redirect("/auth/pending-validation");

  const flags = await getFeatureFlagValues({ role: session.user.role, userId: session.user.id });

  return (
    <div className="min-h-screen flex flex-col">
      <NavTeacher
        userName={session.user.name}
        avatarUrl={user.avatarUrl}
        role={session.user.role}
        flags={flags}
      />
      <main className="flex-1 bg-gray-50">{children}</main>
    </div>
  );
}
