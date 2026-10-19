import { Breadcrumbs } from "@/components/sat/breadcrumbs";
import { PageShell } from "@/components/sat";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { getFeatureSetting } from "@/lib/app-settings";
import { redirect } from "next/navigation";
import { TeacherProgramsClient } from "./programs-client";

export const dynamic = "force-dynamic";

export default async function TeacherProgramsPage() {
  const session = await auth();
  if (!session) redirect("/login");
  if (session.user.role === "ADMIN") redirect("/admin/programs");
  if (session.user.role !== "TEACHER") redirect("/student");
  const enabled = await getFeatureSetting("TEACHER_PROGRAM_MANAGEMENT");
  if (!enabled) redirect("/teacher");

  const programs = await prisma.program.findMany({
    where: { deletedAt: null, teachers: { some: { teacherId: session.user.id, endDate: null } } },
    include: {
      enrollments: {
        include: { student: { select: { id: true, name: true } } },
        orderBy: { enrolledAt: "desc" },
      },
    },
    orderBy: { name: "asc" },
  });

  const serialized = programs.map((p) => ({
    id: p.id,
    name: p.name,
    startDate: p.startDate.toISOString(),
    endDate: p.endDate?.toISOString() ?? null,
    active: p.active,
    enrollments: p.enrollments.map((e) => ({
      studentId: e.studentId,
      status: e.status,
      active: e.active,
      enrolledAt: e.enrolledAt.toISOString(),
      parentApprovalStatus: e.parentApprovalStatus ?? null,
      parentApprovedAt: e.parentApprovedAt?.toISOString() ?? null,
      student: e.student,
    })),
  }));

  return (
    <PageShell>
      <Breadcrumbs items={[{ label: "Home", href: "/teacher" }, { label: "Programs" }]} />
      <h1 className="mb-1 text-xl font-semibold text-gray-900">Programs</h1>
      <p className="mb-6 text-sm text-gray-500">
        Programs you teach. Leave end date blank for indefinite programs.
      </p>
      <TeacherProgramsClient programs={serialized} />
    </PageShell>
  );
}
