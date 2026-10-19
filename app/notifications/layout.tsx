import { redirect } from "next/navigation";
import Link from "next/link";
import { StudentShell } from "@/components/nav-student";
import { TeacherShell } from "@/components/nav-teacher";
import { auth } from "@/lib/auth";
import { getFeatureFlagValues } from "@/lib/feature-flags";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function NotificationsLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { active: true, validationStatus: true, avatarUrl: true },
  });
  if (!user?.active) redirect("/login");
  if (user.validationStatus !== "APPROVED") redirect("/auth/pending-validation");

  if (session.user.role === "TEACHER" || session.user.role === "ADMIN") {
    const flags = await getFeatureFlagValues({ role: session.user.role, userId: session.user.id });

    return (
      <TeacherShell userName={session.user.name} avatarUrl={user.avatarUrl} role={session.user.role} flags={flags}>
        {children}
      </TeacherShell>
    );
  }

  if (session.user.role === "STUDENT") {
    const hasActiveEnrollment = !!(await prisma.programEnrollment.findFirst({
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
      <StudentShell userName={session.user.name} avatarUrl={user.avatarUrl} hasActiveEnrollment={hasActiveEnrollment} flags={flags}>
        {children}
      </StudentShell>
    );
  }

  if (session.user.role === "PARENT") {
    return (
      <div className="min-h-screen bg-gray-50">
        <nav className="border-b border-gray-200 bg-white py-3">
          <div className="mx-auto flex max-w-[var(--sat-page-wide)] items-center justify-between px-4">
            <Link href="/parent" className="text-sm font-semibold text-blue-700">
              SAT Parent Portal
            </Link>
            <Link href="/notifications" className="text-sm text-gray-600 hover:text-blue-600">
              Notifications
            </Link>
          </div>
        </nav>
        {children}
      </div>
    );
  }

  redirect("/");
}
