import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { TeacherShell } from "@/components/nav-teacher";
import prisma from "@/lib/prisma";
import { getFeatureFlagValues } from "@/lib/feature-flags";

export const dynamic = "force-dynamic";

export default async function TeacherLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session) redirect("/login");
  if (!["TEACHER", "ADMIN"].includes(session.user.role)) redirect("/student");
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { active: true, validationStatus: true, avatarUrl: true, canManageTeachers: true },
  });
  if (!user?.active) redirect("/login");
  if (user.validationStatus !== "APPROVED") redirect("/auth/pending-validation");

  const flags = await getFeatureFlagValues({ role: session.user.role, userId: session.user.id });

  return (
    <TeacherShell
      userName={session.user.name}
      avatarUrl={user.avatarUrl}
      role={session.user.role}
      flags={flags}
      // Master teacher (Teachers menu): only TEACHER accounts with the flag (the SAT Teacher account).
      capabilities={session.user.role === "TEACHER" && user.canManageTeachers ? ["manageTeachers"] : []}
    >
      {children}
    </TeacherShell>
  );
}
