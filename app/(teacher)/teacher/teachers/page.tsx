import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronRight, UserPlus } from "lucide-react";
import { EmptyState, ListFilters, PageHeader, PageShell, RoleBadge, StudentCell } from "@/components/sat";
import { HeaderActions } from "@/components/sat/header-actions";
import { Breadcrumbs } from "@/components/sat/breadcrumbs";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { TeacherToggle } from "@/app/admin/teachers/teacher-toggle-client";
import prisma from "@/lib/prisma";
import { requireTeacherManager } from "@/lib/rbac";
import { teacherProgramIds } from "@/lib/program-scope";
import { RevokeInviteButton } from "../students/revoke-invite-button";
import { formatDate, relativeDay } from "@/lib/utils";
import { personSuggestions } from "@/lib/search-suggestions";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ q?: string; access?: string }>;
}

/**
 * Teachers (master teacher only — User.canManageTeachers, re-checked on the server): every teacher
 * with their account type, status and how many students they have; invite and deactivate teachers.
 * A teacher's students are listed by name only on the teacher's page; only that teacher manages them.
 */
export default async function TeachersPage({ searchParams }: PageProps) {
  const session = await requireTeacherManager();
  if (!session) redirect("/teacher");
  const query = await searchParams;
  const q = (query.q ?? "").trim();
  const access = query.access === "enabled" || query.access === "disabled" ? query.access : undefined;
  const now = new Date();

  const [teachers, invites] = await Promise.all([
    prisma.user.findMany({
      where: {
        role: "TEACHER",
        ...(access ? { active: access === "enabled" } : {}),
        ...(q ? { OR: [{ name: { contains: q } }, { email: { contains: q } }] } : {}),
      },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        email: true,
        avatarUrl: true,
        active: true,
        canManageTeachers: true,
        lastActiveAt: true,
        // Students the teacher owns (invited) — not every student of a shared program.
        _count: { select: { ownedEnrollments: { where: { status: "APPROVED", active: true, program: { deletedAt: null } } } } },
      },
    }),
    prisma.inviteToken.findMany({
      where: { role: "TEACHER", usedAt: null, revokedAt: null, expiresAt: { gt: now }, OR: [{ invitedById: session.user.id }, { programId: { in: await teacherProgramIds(session.user) } }] },
      select: { id: true, name: true, email: true, expiresAt: true },
      orderBy: { expiresAt: "desc" },
    }),
  ]);
  const studentCount = (t: (typeof teachers)[number]) => t._count.ownedEnrollments;

  return (
    <PageShell>
      <Breadcrumbs items={[{ label: "Home", href: "/teacher" }, { label: "Teachers" }]} />
      <PageHeader
        title="Teachers"
        description={
          <>
            {teachers.length} teacher{teachers.length === 1 ? "" : "s"} · {invites.length} pending invitation{invites.length === 1 ? "" : "s"} · each teacher sees and manages only their own students
          </>
        }
        actions={
          <HeaderActions>
            <Link href="/teacher/teachers/invite" className="inline-flex items-center gap-1.5 self-start shrink-0 whitespace-nowrap rounded-lg bg-[var(--sat-primary)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--sat-primary-dark)]">
              <UserPlus size={14} /> Invite teacher
            </Link>
          </HeaderActions>
        }
      />

      <ListFilters
        action="/teacher/teachers"
        q={q}
        placeholder="Name or email"
        suggestions={await personSuggestions({ role: "TEACHER" })}
        filters={[{ name: "access", label: "Status", value: access, allLabel: "All teachers", options: [{ value: "enabled", label: "Active" }, { value: "disabled", label: "Deactivated" }] }]}
      />

      {teachers.length === 0 ? (
        <EmptyState title="No teachers match." />
      ) : (
        <Card>
          <ul className="divide-y divide-gray-100">
            {teachers.map((t) => {
              const count = studentCount(t);
              return (
                <li key={t.id} className="grid gap-2 px-4 py-3 sm:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_8rem_auto_1rem] sm:items-center">
                  <Link href={`/teacher/teachers/${t.id}`} className="min-w-0 hover:underline">
                    <StudentCell name={t.name} email={t.email} avatarUrl={t.avatarUrl} />
                  </Link>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <RoleBadge role="TEACHER" master={t.canManageTeachers} />
                    <Badge variant={t.active ? "success" : "danger"}>{t.active ? "Active" : "Deactivated"}</Badge>
                  </div>
                  <div className="text-sm">
                    <span className="block text-xs text-gray-500">Students</span>
                    <b>{count}</b>
                  </div>
                  <div>
                    {t.id === session.user.id ? (
                      <span className="text-xs text-gray-400">You</span>
                    ) : (
                      <TeacherToggle teacherId={t.id} teacherName={t.name} active={t.active} endpoint={`/api/teachers/${t.id}/toggle-active`} labels={{ disable: "Deactivate", enable: "Reactivate" }} />
                    )}
                  </div>
                  <Link href={`/teacher/teachers/${t.id}`} aria-label={`Open ${t.name}`} className="hidden text-gray-300 hover:text-gray-500 sm:block">
                    <ChevronRight size={16} aria-hidden />
                  </Link>
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      {invites.length > 0 ? (
        <section className="mt-6">
          <h2 className="mb-2 text-sm font-semibold text-gray-900">Pending invitations</h2>
          <Card>
            <ul className="divide-y divide-gray-100">
              {invites.map((i) => (
                <li key={i.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 text-sm text-gray-500">
                  <StudentCell name={i.name || i.email} email={i.email} />
                  <div className="flex items-center gap-2">
                    <RoleBadge role="TEACHER" />
                    <Badge>Invitation valid until {formatDate(i.expiresAt)} ({relativeDay(i.expiresAt, now)})</Badge>
                    <RevokeInviteButton inviteId={i.id} email={i.email} endpoint={`/api/teachers/invites/${i.id}/revoke`} />
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        </section>
      ) : null}
    </PageShell>
  );
}
