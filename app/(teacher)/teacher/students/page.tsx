import Link from "next/link";
import { ChevronRight, UserPlus } from "lucide-react";
import { EmptyState, PageShell } from "@/components/sat";
import { Breadcrumbs } from "@/components/sat/breadcrumbs";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { studentAccessWhereFor } from "@/lib/program-scope";
import { isInactive, loadStudentOverviews, type StudentOverview } from "@/lib/teacher-overview";
import { cn, formatDate, relativeDay } from "@/lib/utils";

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
  const invited = await prisma.inviteToken
    .findMany({
      where: { role: "STUDENT", usedAt: null, expiresAt: { gt: now }, ...(session?.user.role === "TEACHER" ? { invitedById: session.user.id } : {}) },
      select: { id: true, email: true, expiresAt: true },
      orderBy: { expiresAt: "desc" },
      take: 20,
    })
    .catch(() => [] as { id: string; email: string; expiresAt: Date }[]);

  return (
    <PageShell width="wide">
      <Breadcrumbs items={[{ label: "Home", href: "/teacher" }, { label: "Students" }]} />
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Students</h1>
          <p className="mt-0.5 text-sm text-gray-500">
            {all.length} student{all.length === 1 ? "" : "s"} · {invited.length} pending invitation{invited.length === 1 ? "" : "s"}
          </p>
        </div>
        <Link href="/teacher/students/invite" className="inline-flex items-center gap-1.5 self-start rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
          <UserPlus size={14} /> Invite student
        </Link>
      </div>

      <Card as="form" padding="sm" className="mb-4 flex flex-wrap items-end gap-3">
        <label className="min-w-[12rem] flex-1 text-xs font-medium text-gray-600">
          Search
          <input name="q" defaultValue={search} placeholder="Name or email" className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm text-gray-900" />
        </label>
        <label className="min-w-[10rem] text-xs font-medium text-gray-600">
          Show
          <select name="show" defaultValue={show} className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm text-gray-900">
            {(Object.keys(SHOW) as Show[]).map((key) => (
              <option key={key} value={key}>{SHOW[key]}</option>
            ))}
          </select>
        </label>
        <button type="submit" className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700">Apply</button>
        <Link href="/teacher/students" className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50">Clear</Link>
      </Card>

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
                      <p className="truncate font-medium text-gray-900">{s.name}</p>
                      <p className="truncate text-xs text-gray-500">{s.email} · {parents ? `Parent: ${parents}` : "No parent linked"}</p>
                    </div>
                    <div className={cn("text-sm", !s.lastActiveAt ? "text-red-600" : inactive ? "text-amber-700" : "text-gray-700")}>
                      {s.lastActiveAt ? (
                        <>
                          <b className="font-medium">{formatDate(s.lastActiveAt)}</b>
                          <span className="block text-xs">{relativeDay(s.lastActiveAt, now)}{inactive ? " · ⚠ inactive" : ""}</span>
                        </>
                      ) : (
                        "Never active"
                      )}
                    </div>
                    <div className="text-sm">
                      <span className="block text-xs text-gray-500">Latest test</span>
                      {s.tests.latest ? <>R&amp;W <b>{s.tests.latest.rw ?? "—"}</b> · Math <b>{s.tests.latest.math ?? "—"}</b></> : <span className="text-gray-400">—</span>}
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
          <h2 className="mb-2 text-sm font-semibold text-gray-900">Pending invitations</h2>
          <Card>
            <ul className="divide-y divide-gray-100">
              {invited.map((i) => (
                <li key={i.id} className="flex items-center justify-between px-4 py-2 text-sm text-gray-500">
                  <span>{i.email}</span>
                  <Badge>Invitation valid until {formatDate(i.expiresAt)}</Badge>
                </li>
              ))}
            </ul>
          </Card>
        </section>
      ) : null}
    </PageShell>
  );
}
