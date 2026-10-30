import { Breadcrumbs } from "@/components/sat/breadcrumbs";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { redirect } from "next/navigation";
import { ListFilters, PageContent, PageHeader, PageShell } from "@/components/sat";
import { AdminTeachersTable, type AdminTeacherRow } from "./teachers-table-client";
import { personSuggestions, suggestionValues } from "@/lib/search-suggestions";

interface PageProps {
  searchParams: Promise<{ q?: string; access?: string; programs?: string }>;
}

export default async function AdminTeachersPage({ searchParams }: PageProps) {
  const session = await auth();
  if (!session) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/teacher");
  const params = await searchParams;
  const q = params.q?.trim() ?? "";
  const access = params.access === "enabled" || params.access === "disabled" ? params.access : undefined;
  const programs = params.programs === "with" || params.programs === "without" ? params.programs : undefined;

  const teachers = await prisma.user.findMany({
    where: {
      role: "TEACHER",
      ...(access ? { active: access === "enabled" } : {}),
      ...(programs === "with" ? { programTeachingAssignments: { some: { endDate: null } } } : programs === "without" ? { programTeachingAssignments: { none: { endDate: null } } } : {}),
      ...(q
        ? {
            OR: [
              { name: { contains: q } },
              { email: { contains: q } },
              { programTeachingAssignments: { some: { program: { name: { contains: q } } } } },
            ],
          }
        : {}),
    },
    orderBy: { name: "asc" },
    include: {
      programTeachingAssignments: {
        include: {
          program: {
            include: {
              enrollments: { where: { active: true, status: "APPROVED" }, select: { studentId: true } },
            },
          },
        },
        where: { endDate: null },
      },
    },
  });

  const rows: AdminTeacherRow[] = teachers.map((teacher) => ({
    id: teacher.id,
    name: teacher.name,
    email: teacher.email,
    active: teacher.active,
    programsLabel:
      teacher.programTeachingAssignments.length > 0
        ? teacher.programTeachingAssignments
            .map((assignment) => `${assignment.program.name} (${assignment.program.enrollments.length})`)
            .join(", ")
        : "No programs",
  }));

  return (
    <PageShell width="default">
      <Breadcrumbs items={[{ label: "Home", href: "/teacher" }, { label: "Admin" }, { label: "Teachers" }]} />
      <PageHeader
        title="Teachers"
        description="Enable or disable teacher access and review assigned programs."
      />
      <PageContent>
        <ListFilters
          action="/admin/teachers"
          q={q}
          placeholder="Teacher, email or program"
          suggestions={suggestionValues([...(await personSuggestions({ role: "TEACHER" })), ...(await prisma.program.findMany({ select: { name: true } })).map((p) => p.name)])}
          filters={[
            { name: "access", label: "Access", value: access, allLabel: "Any access", options: [{ value: "enabled", label: "Enabled" }, { value: "disabled", label: "Disabled" }] },
            { name: "programs", label: "Programs", value: programs, allLabel: "With or without programs", options: [{ value: "with", label: "With programs" }, { value: "without", label: "Without programs" }] },
          ]}
        />
        <AdminTeachersTable rows={rows} />
      </PageContent>
    </PageShell>
  );
}
