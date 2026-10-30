import { RevokeInviteButton } from "./revoke-invite-button";
import Link from "next/link";
import { ChevronRight, UserPlus } from "lucide-react";
import { DateCell, EmptyState, ListFilters, PageHeader, PageShell, StudentCell } from "@/components/sat";
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

/** Students roster: search, a status filter, last activity, latest Test scores and pending Tests. */
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
        <Card>
          <ul className="divide-y divide-gray-100">
            {rows.map((s) => {
              const inactive = isInactive(s.lastActiveAt, now);
              const parents = parentNames.get(s.id);
              return (
                <li key={s.id}>
                  <Link href={`/teacher/students/${s.id}`} className="grid gap-2 px-4 py-3 hover:bg-gray-50 sm:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1fr)_7rem_1rem] sm:items-center">
                    <div className="min-w-0">
                      <StudentCell name={s.name} email={`${s.email} · ${parents ? `Parent: ${parents}` : "No parent linked"}`} avatarUrl={s.avatarUrl} />
                    </div>
                    <div>
                      <DateCell date={s.lastActiveAt} now={now} inactive={inactive} />
                    </div>
                    <div className="text-sm">
                      <span className="block text-xs text-gray-500">Latest test</span>
                      {s.tests.latest ? <><span className="text-[var(--sat-area-reading)]">R&amp;W</span> <b>{s.tests.latest.rw ?? "—"}</b> · <span className="text-[var(--sat-area-math)]">Math</span> <b>{s.tests.latest.math ?? "—"}</b></> : <span className="text-gray-400">—</span>}
                    </div>
                    <div className="text-sm">
                      <span className="block text-xs text-gray-500">Pending tests</span>
                      {s.tests.pending.length ? (
                        <Badge variant={s.tests.pending.some((p) => p.overdue) ? "danger" : "warning"}>{s.tests.pending.length}</Badge>
                      ) : (
                        <span className="text-gray-400">0</span>
                      )}
                    </div>
                    <ChevronRight size={16} className="hidden text-gray-300 sm:block" aria-hidden />
                  </Link>
                </li>
              );
            })}
          </ul>
        </Card>
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
