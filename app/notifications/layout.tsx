import { redirect } from "next/navigation";
import Link from "next/link";
import { NavStudent } from "@/components/nav-student";
import { NavTeacher } from "@/components/nav-teacher";
import { auth } from "@/lib/auth";
import { getFeatureSetting } from "@/lib/app-settings";
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
    const showTeacherPrograms =
      session.user.role === "ADMIN" || (await getFeatureSetting("TEACHER_PROGRAM_MANAGEMENT"));
    const showTeacherGroups =
      session.user.role === "ADMIN" || (await getFeatureSetting("TEACHER_GROUP_MANAGEMENT"));

    return (
      <div className="min-h-screen flex flex-col">
        <NavTeacher
          userName={session.user.name}
          avatarUrl={user.avatarUrl}
          role={session.user.role}
          showTeacherPrograms={showTeacherPrograms}
          showTeacherGroups={showTeacherGroups}
        />
        <main className="flex-1 bg-gray-50">{children}</main>
      </div>
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

    return (
      <div className="min-h-screen flex flex-col">
        <NavStudent
          userName={session.user.name}
          avatarUrl={user.avatarUrl}
          hasActiveEnrollment={hasActiveEnrollment}
        />
        <main className="flex-1">{children}</main>
      </div>
    );
  }

  if (session.user.role === "PARENT") {
    return (
      <div className="min-h-screen bg-gray-50">
        <nav className="border-b border-gray-200 bg-white px-4 py-3">
          <div className="mx-auto flex max-w-5xl items-center justify-between">
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
