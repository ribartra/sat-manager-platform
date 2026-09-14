import { PageShell } from "@/components/sat";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { redirect } from "next/navigation";
import { AdminProgramsClient } from "./programs-client";

export const dynamic = "force-dynamic";

export default async function AdminProgramsPage() {
  const session = await auth();
  if (!session) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/teacher");

  const [teachers, programs] = await Promise.all([
    prisma.user.findMany({
      where: { role: "TEACHER", active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, email: true },
    }),
    prisma.program.findMany({
      include: {
        teachers: {
          include: { teacher: { select: { id: true, name: true, email: true } } },
          orderBy: { startDate: "asc" },
        },
        enrollments: {
          include: { student: { select: { id: true, name: true } } },
          orderBy: { enrolledAt: "desc" },
        },
      },
      orderBy: { name: "asc" },
    }),
  ]);

  // Serialize Dates for client components
  const serialized = programs.map((p) => ({
    id: p.id,
    name: p.name,
    startDate: p.startDate.toISOString(),
    endDate: p.endDate?.toISOString() ?? null,
    active: p.active,
    deletedAt: p.deletedAt?.toISOString() ?? null,
    teachers: p.teachers.map((t) => ({
      programId: t.programId,
      teacherId: t.teacherId,
      startDate: t.startDate.toISOString(),
      endDate: t.endDate?.toISOString() ?? null,
      teacher: t.teacher,
    })),
    enrollments: p.enrollments.map((e) => ({
      studentId: e.studentId,
      status: e.status,
      active: e.active,
      enrolledAt: e.enrolledAt.toISOString(),
      student: e.student,
    })),
  }));

  return (
    <PageShell>
      <h1 className="mb-1 text-xl font-semibold text-gray-900">Programs Master</h1>
      <p className="mb-6 text-sm text-gray-500">
        Manage programs, teachers, and enrollment requests. Leave end date blank for indefinite programs.
      </p>
      <AdminProgramsClient programs={serialized} teachers={teachers} />
    </PageShell>
  );
}
