import { RevokeInviteButton } from "./revoke-invite-button";
import Link from "next/link";
import { Clock, UserPlus } from "lucide-react";
import { AttentionRow, EmptyState, ListFilters, PageHeader, PageShell, StudentCell } from "@/components/sat";
import { StudentOverviewTable } from "@/components/sat/student-overview-table";
import { Breadcrumbs } from "@/components/sat/breadcrumbs";
import { HEADER_SHORTCUT_CLASS, HeaderActions } from "@/components/sat/header-actions";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { auth } from "@/lib/auth";
import { MoreLinks } from "@/components/sat/more-links";
import { getFeatureFlagValues } from "@/lib/feature-flags";
import { TEACHER_MORE_LINKS, resolveLinks } from "@/lib/nav-config";
import prisma from "@/lib/prisma";
import { studentAccessWhereFor } from "@/lib/program-scope";
import { isInactive, loadStudentOverviews, type StudentOverview } from "@/lib/teacher-overview";
import { formatDate, relativeDay } from "@/lib/utils";
import { personSuggestions } from "@/lib/search-suggestions";

interface PageProps {
  searchParams: Promise<{ q?: string; show?: string }>;
}

const SHOW = {
  all: "All students",
  active: "Active this week",
  inactive: "Inactive 5+ days",
  "pending-tests": "With pending tests",
} as const;
type Show = keyof typeof SHOW;

/**
 * Students roster: the Home table (latest practice per area, latest Test, pending Tests) for every
 * student, with search, a status filter, the Inactive notice, an Assign button per student and the Parents shortcut.
 */
export default async function TeacherStudentsPage({ searchParams }: PageProps) {
  const session = await auth();
  const moreLinks = resolveLinks(TEACHER_MORE_LINKS.students, {
    role: session?.user.role,
    flags: await getFeatureFlagValues({ role: session?.user.role, userId: session?.user.id }),
  });
  const now = new Date();
  const query = await searchParams;
  const search = query.q?.trim() ?? "";
  const show: Show = (Object.keys(SHOW) as Show[]).includes(query.show as Show) ? (query.show as Show) : "all";

  const students = await prisma.user.findMany({
    where: {
      ...(session ? studentAccessWhereFor(session.user, now) : { role: "STUDENT", active: true, validationStatus: "APPROVED" }),
      ...(search ? { OR: [{ name: { contains: search } }, { email: { contains: search } }] } : {}),
    },
    select: { id: true, childLinks: { select: { parent: { select: { name: true } } } } },
    orderBy: { name: "asc" },
  });
  const overviews = await loadStudentOverviews(students.map((s) => s.id), now);
  const parentNames = new Map(students.map((s) => [s.id, s.childLinks.map((p) => p.parent.name).join(", ")]));
  const all = students.map((s) => overviews.get(s.id)).filter((o): o is StudentOverview => Boolean(o));
  const inactive = all.filter((s) => isInactive(s.lastActiveAt, now));
  const rows = all.filter((s) => {
    if (show === "active") return !isInactive(s.lastActiveAt, now, 7);
    if (show === "inactive") return isInactive(s.lastActiveAt, now);
    if (show === "pending-tests") return s.tests.pending.length > 0;
    return true;
  });
  const inviteWhere = { role: "STUDENT", usedAt: null, revokedAt: null, expiresAt: { gt: now }, ...(session?.user.role === "TEACHER" ? { invitedById: session.user.id } : {}) };
  // The list shows the latest 20; the count in the header is the real total.
  const [invited, invitedTotal] = await Promise.all([
    prisma.inviteToken
      .findMany({
        where: inviteWhere,
        select: { id: true, email: true, name: true, expiresAt: true },
        orderBy: { expiresAt: "desc" },
        take: 20,
      })
      .catch(() => [] as { id: string; email: string; name: string; expiresAt: Date }[]),
    prisma.inviteToken.count({ where: inviteWhere }).catch(() => 0),
  ]);

  return (
    <PageShell>
      <Breadcrumbs items={[{ label: "Home", href: "/teacher" }, { label: "Students" }]} />
      <PageHeader
        title="Students"
        description={
          <>
            {all.length} student{all.length === 1 ? "" : "s"} · {invitedTotal} pending invitation{invitedTotal === 1 ? "" : "s"}
          </>
        }
        actions={
          <HeaderActions>
            {/* The students' parents (with the way back here). */}
            <Link href="/teacher/parents" className={HEADER_SHORTCUT_CLASS}>Parents →</Link>
            <Link href="/teacher/students/invite" className="inline-flex items-center gap-1.5 self-start shrink-0 whitespace-nowrap rounded-lg bg-[var(--sat-primary)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--sat-primary-dark)]">
            <UserPlus size={14} /> Invite student
            </Link>
          </HeaderActions>
        }
      />

      <MoreLinks links={moreLinks} />

      {/* Same notice as Home: who has not been active for 5+ days. */}
      <Card padding="none" className="mb-4 flex flex-col gap-2 px-4 py-3">
        <AttentionRow
          icon={<Clock size={14} />}
          label="Inactive 5+ days"
          tone="warn"
          viewAllHref="/teacher/students?show=inactive"
          people={inactive.map((s) => ({
            id: s.id,
            name: s.name,
            href: `/teacher/students/${s.id}`,
            detail: s.lastActiveAt ? `Last active ${relativeDay(s.lastActiveAt, now)}` : "Never active",
          }))}
        />
      </Card>

      <ListFilters
        action="/teacher/students"
        q={search}
        placeholder="Name or email"
        suggestions={await personSuggestions(session ? studentAccessWhereFor(session.user, now) : { role: "STUDENT", active: true, validationStatus: "APPROVED" })}
        filters={[{ name: "show", label: "Show", value: show === "all" ? "" : show, allLabel: SHOW.all, options: (Object.keys(SHOW) as Show[]).filter((key) => key !== "all").map((key) => ({ value: key, label: SHOW[key] })) }]}
      />

      {rows.length === 0 ? (
        <EmptyState title="No students match." />
      ) : (
        <StudentOverviewTable rows={rows} now={now} parents={parentNames} assign />
      )}

      {invited.length > 0 ? (
        <section className="mt-6">
          <h2 className="mb-2 text-sm font-semibold text-gray-900">
            Pending invitations{invitedTotal > invited.length ? ` · showing ${invited.length} of ${invitedTotal}` : ""}
          </h2>
          <Card>
            <ul className="divide-y divide-gray-100">
              {invited.map((i) => (
                <li key={i.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 text-sm text-gray-500">
                  <StudentCell name={i.name || i.email} email={i.email} />
                  <div className="flex items-center gap-2">
                    <Badge>Invitation valid until {formatDate(i.expiresAt)} ({relativeDay(i.expiresAt, now)})</Badge>
                    {session?.user.role === "ADMIN" ? <RevokeInviteButton inviteId={i.id} email={i.email} /> : null}
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
