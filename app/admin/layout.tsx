import { redirect } from "next/navigation";
import { TeacherShell } from "@/components/nav-teacher";
import { auth } from "@/lib/auth";
import { getFeatureFlagValues } from "@/lib/feature-flags";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function AdminSectionLayout({ children }: { children: React.ReactNode }) {
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
    <TeacherShell userName={session.user.name} avatarUrl={user.avatarUrl} role={session.user.role} flags={flags}>
      {children}
    </TeacherShell>
  );
}
