import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { EmptyState, PageShell, RoleBadge, StudentCell } from "@/components/sat";
import { Breadcrumbs } from "@/components/sat/breadcrumbs";
import { HEADER_ACTION_CLASS, HeaderActions } from "@/components/sat/header-actions";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { TeacherToggle } from "@/app/admin/teachers/teacher-toggle-client";
import prisma from "@/lib/prisma";
import { requireTeacherManager } from "@/lib/rbac";
import { formatDate, relativeDay } from "@/lib/utils";

export const dynamic = "force-dynamic";

/**
 * One teacher, for the master teacher: the account and WHICH students the teacher has (name, email,
 * avatar). Deliberately no links and no student data (results, tries, profile): only that
 * teacher sees and manages their own students.
 */
export default async function TeacherDetailPage({ params }: { params: Promise<{ teacherId: string }> }) {
  const session = await requireTeacherManager();
  if (!session) redirect("/teacher");
  const { teacherId } = await params;

  const teacher = await prisma.user.findFirst({
    where: { id: teacherId, role: "TEACHER" },
    select: {
      id: true,
      name: true,
      email: true,
      avatarUrl: true,
      active: true,
      canManageTeachers: true,
      createdAt: true,
      lastActiveAt: true,
      programTeachingAssignments: { where: { endDate: null, program: { deletedAt: null } }, select: { program: { select: { id: true, name: true } } } },
    },
  });
  if (!teacher) notFound();

  // The students this teacher owns (invited), also when the teacher is deactivated: only who they
  // are, nothing else. Other teachers of the same program have their own students.
  const students = await prisma.user.findMany({
    where: {
      role: "STUDENT",
      programEnrollments: { some: { teacherId: teacher.id, status: "APPROVED", active: true, program: { deletedAt: null } } },
    },
    select: { id: true, name: true, email: true, avatarUrl: true },
    orderBy: { name: "asc" },
  });

  return (
    <PageShell>
      <Breadcrumbs items={[{ label: "Home", href: "/teacher" }, { label: "Teachers", href: "/teacher/teachers" }, { label: teacher.name }]} />
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <StudentCell name={teacher.name} email={teacher.email} avatarUrl={teacher.avatarUrl} />
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <RoleBadge role="TEACHER" master={teacher.canManageTeachers} />
            <Badge variant={teacher.active ? "success" : "danger"}>{teacher.active ? "Active" : "Deactivated"}</Badge>
          </div>
          <p className="mt-1.5 text-xs text-gray-500">
            Teacher since {formatDate(teacher.createdAt)} · Last active: {teacher.lastActiveAt ? `${formatDate(teacher.lastActiveAt)} (${relativeDay(teacher.lastActiveAt)})` : "never"}
            {" · "}Programs: {teacher.programTeachingAssignments.map((a) => a.program.name).join(", ") || "—"}
          </p>
        </div>
        <HeaderActions>
          <Link href="/teacher/teachers" className={HEADER_ACTION_CLASS}><ChevronLeft size={14} aria-hidden /> Back to Teachers</Link>
          {teacher.id !== session.user.id ? (
            <TeacherToggle teacherId={teacher.id} teacherName={teacher.name} active={teacher.active} endpoint={`/api/teachers/${teacher.id}/toggle-active`} labels={{ disable: "Deactivate", enable: "Reactivate" }} />
          ) : null}
        </HeaderActions>
      </div>

      <section>
        <h2 className="text-base font-semibold text-gray-900">Students · {students.length}</h2>
        <p className="mb-2 text-xs text-gray-500">Who this teacher teaches. Only {teacher.name.split(" ")[0]} can see and manage these students&apos; work.</p>
        {students.length === 0 ? (
          <EmptyState title="No students yet." description="Students appear here once they accept this teacher's invitation." />
        ) : (
          <Card>
            <ul className="divide-y divide-gray-100">
              {students.map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-2 px-4 py-2.5">
                  <StudentCell name={s.name} email={s.email} avatarUrl={s.avatarUrl} />
                  <RoleBadge role="STUDENT" />
                </li>
              ))}
            </ul>
          </Card>
        )}
      </section>
    </PageShell>
  );
}
