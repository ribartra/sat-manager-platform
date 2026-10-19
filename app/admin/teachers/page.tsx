import { Breadcrumbs } from "@/components/sat/breadcrumbs";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { redirect } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { FilterBar, PageContent, PageHeader, PageShell } from "@/components/sat";
import { AdminTeachersTable, type AdminTeacherRow } from "./teachers-table-client";

interface PageProps {
  searchParams: Promise<{ q?: string }>;
}

export default async function AdminTeachersPage({ searchParams }: PageProps) {
  const session = await auth();
  if (!session) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/teacher");
  const params = await searchParams;
  const q = params.q?.trim() ?? "";

  const teachers = await prisma.user.findMany({
    where: {
      role: "TEACHER",
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
        <FilterBar>
          <form className="flex w-full max-w-xl gap-2">
            <Input name="q" defaultValue={q} placeholder="Search teacher or program..." />
            <Button type="submit">Search</Button>
          </form>
        </FilterBar>
        <AdminTeachersTable rows={rows} />
      </PageContent>
    </PageShell>
  );
}
