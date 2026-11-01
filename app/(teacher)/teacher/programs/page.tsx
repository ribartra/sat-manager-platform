import { Breadcrumbs } from "@/components/sat/breadcrumbs";
import { ListFilters, PageHeader, PageShell, matchesQuery } from "@/components/sat";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { getFeatureSetting } from "@/lib/app-settings";
import { redirect } from "next/navigation";
import { TeacherProgramsClient } from "./programs-client";
import { suggestionValues } from "@/lib/search-suggestions";

export const dynamic = "force-dynamic";

export default async function TeacherProgramsPage({ searchParams }: { searchParams: Promise<{ q?: string; status?: string }> }) {
  const query = await searchParams;
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
        // Only the students this teacher owns (invited) — other teachers of the program have theirs.
        where: { teacherId: session.user.id },
        include: { student: { select: { id: true, name: true } } },
        orderBy: { enrolledAt: "desc" },
      },
    },
    orderBy: { name: "asc" },
  });

  // Search + filters (URL): program or student name; running / upcoming / ended / inactive.
  const now = new Date();
  const programState = (p: (typeof programs)[number]) =>
    !p.active ? "inactive" : p.startDate > now ? "upcoming" : p.endDate && p.endDate < now ? "ended" : "running";
  const status = ["running", "upcoming", "ended", "inactive"].includes(query.status ?? "") ? query.status : undefined;
  const shown = programs.filter(
    (p) => matchesQuery(query.q, p.name, ...p.enrollments.map((e) => e.student.name)) && (!status || programState(p) === status),
  );
  const serialized = shown.map((p) => ({
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
      parentApprovedAt: e.parentApprovedAt?.toISOString() ?? null,
      student: e.student,
    })),
  }));

  return (
    <PageShell>
      <Breadcrumbs items={[{ label: "Home", href: "/teacher" }, { label: "Programs" }]} />
      <PageHeader title="Programs" description="Programs you teach. Leave end date blank for indefinite programs." />
      <ListFilters
        action="/teacher/programs"
        q={query.q}
        placeholder="Program or student name"
        suggestions={suggestionValues(programs.flatMap((p) => [p.name, ...p.enrollments.map((e) => e.student.name)]))}
        filters={[
          {
            name: "status",
            label: "Status",
            value: status,
            allLabel: "All programs",
            options: [
              { value: "running", label: "Running" },
              { value: "upcoming", label: "Upcoming" },
              { value: "ended", label: "Ended" },
              { value: "inactive", label: "Inactive" },
            ],
          },
        ]}
      />
      <TeacherProgramsClient programs={serialized} />
    </PageShell>
  );
}
