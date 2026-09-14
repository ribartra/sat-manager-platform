import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { NavStudent } from "@/components/nav-student";
import prisma from "@/lib/prisma";
import { getFeatureFlagValues } from "@/lib/feature-flags";

export const dynamic = "force-dynamic";

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { active: true, validationStatus: true, avatarUrl: true },
  });
  if (!user?.active) redirect("/login");
  if (user.validationStatus !== "APPROVED") redirect("/auth/pending-validation");

  const isImpersonated = session.user.role !== "STUDENT";

  const hasActiveEnrollment =
    isImpersonated ||
    !!(await prisma.programEnrollment.findFirst({
      where: {
        studentId: session.user.id,
        status: "APPROVED",
        active: true,
        program: {
          active: true,
          startDate: { lte: new Date() },
          OR: [{ endDate: null }, { endDate: { gt: new Date() } }],
        },
      },
    }));
  const flags = await getFeatureFlagValues({ role: session.user.role, userId: session.user.id });

  return (
    <div className="flex min-h-screen flex-col">
      <NavStudent
        userName={session.user.name}
        avatarUrl={user.avatarUrl}
        isImpersonated={isImpersonated}
        hasActiveEnrollment={hasActiveEnrollment}
        flags={flags}
      />
      <main className="flex min-h-0 flex-1 flex-col">{children}</main>
    </div>
  );
}
