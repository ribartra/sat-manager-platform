import {
  AttentionRow,
  ChevronCell,
  DateCell,
  EmptyState,
  LinkTr,
  PageHeader,
  PageShell,
  RowAction,
  RowLink,
  SectionHeader,
  SimpleTable,
  StudentCell,
  TD,
} from "@/components/sat";
import { ListFilters } from "@/components/sat";
import { HeaderActions } from "@/components/sat/header-actions";
import { Breadcrumbs } from "@/components/sat/breadcrumbs";
import prisma from "@/lib/prisma";
import Link from "next/link";
import { formatDate, relativeDay } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Clock, KeyRound, UserPlus } from "lucide-react";
import { auth } from "@/lib/auth";
import { getFeatureSetting } from "@/lib/app-settings";
import { refreshAssignmentStates } from "@/lib/assignments";
import { studentAccessWhereFor } from "@/lib/program-scope";
import { practiceAreaLabel, resolvePracticeArea, tabFromPracticeArea, type PracticeAreaCode } from "@/lib/practice-area";
import { Pct } from "@/components/sat/work-status";
import { isInactive, loadStudentOverviews, type StudentOverview } from "@/lib/teacher-overview";
import { personSuggestions } from "@/lib/search-suggestions";

interface PageProps {
  searchParams: Promise<{ q?: string }>;
}

const PRACTICE_AREAS: { code: PracticeAreaCode; tab: "math" | "reading" | "writing" }[] = [
  { code: "MATH", tab: "math" },
  { code: "READING", tab: "reading" },
  { code: "WRITING", tab: "writing" },
];

/**
 * Teacher Home (one view, no section tabs — SAT-036/037): who needs attention (inactive 5+ days,
 * unlock requests) and every student with their latest practice per area and latest Test. Each row /
 * cell opens the student's page, where the per-area detail lives; the catalogue is Practice › By skill.
 */
export default async function TeacherDashboard({ searchParams }: PageProps) {
  const session = await auth();
  const now = new Date();
  await refreshAssignmentStates(now);
  const params = await searchParams;
  const search = params.q?.trim() ?? "";
  const firstName = (session?.user.name ?? "teacher").split(" ")[0];
  const studentScope = session ? studentAccessWhereFor(session.user, now) : { role: "STUDENT", active: true, validationStatus: "APPROVED" };
  const searchWhere = search ? { OR: [{ name: { contains: search } }, { email: { contains: search } }] } : {};
  const unlockRequestsEnabled = await getFeatureSetting("STUDENT_UNLOCK_REQUESTS");

  const [students, unlockRequests] = await Promise.all([
    prisma.user.findMany({
      where: { ...studentScope, ...searchWhere },
      select: { id: true },
      orderBy: { name: "asc" },
    }),
    // Pending unlock requests of the teacher's students (approve / deny on the student's page).
    unlockRequestsEnabled
      ? prisma.unlockRequest.findMany({
          where: { status: "PENDING", assignment: { student: studentScope } },
          include: {
            assignment: {
              select: {
                studentId: true,
                student: { select: { name: true } },
                practiceSet: { select: { name: true, topic: { select: { domain: { select: { practiceArea: true } } } } } },
              },
            },
          },
          orderBy: { createdAt: "desc" },
        })
      : Promise.resolve([]),
  ]);
  const overviews = await loadStudentOverviews(students.map((s) => s.id), now);
  const rows = students.map((s) => overviews.get(s.id)).filter((o): o is StudentOverview => Boolean(o));

  // The breadcrumb row keeps the title at the same height as on every other page.
  const head = (count: number) => (
    <div>
      <Breadcrumbs items={[{ label: "Home" }]} />
      <PageHeader
      title={`Hello, ${firstName}!`}
      description={
        <>
          {count} student{count === 1 ? "" : "s"} · Today is {now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}.
        </>
      }
      actions={
        <HeaderActions>
          <Link
            href="/teacher/students/invite"
            className="flex items-center gap-1.5 shrink-0 whitespace-nowrap rounded-lg bg-[var(--sat-primary)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--sat-primary-dark)]"
          >
            <UserPlus size={14} /> Invite student
          </Link>
        </HeaderActions>
      }
      />
    </div>
  );

  const inactive = rows.filter((s) => isInactive(s.lastActiveAt, now));
  return (
    <PageShell className="space-y-4">
      {head(rows.length)}
      <ListFilters action="/teacher" q={search} placeholder="Name or email" suggestions={await personSuggestions(studentScope)} />
      <Card padding="none" className="flex flex-col gap-2 px-4 py-3">
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
        {unlockRequestsEnabled ? (
          <AttentionRow
            icon={<KeyRound size={14} />}
            label="Unlock requests"
            tone="info"
            people={unlockRequests.map((request) => ({
              id: request.id,
              name: request.assignment.student.name,
              href: `/teacher/students/${request.assignment.studentId}?area=${tabFromPracticeArea(resolvePracticeArea(request.assignment.practiceSet.topic.domain)) ?? "math"}#active-sets`,
              detail: `Requested ${request.assignment.practiceSet.name}`,
            }))}
          />
        ) : null}
      </Card>

      <section>
        <SectionHeader title="Students" description="Click a row to see everything the student has done. Click an area cell to go straight to that area." />
        {rows.length === 0 ? (
          <EmptyState title="No students yet" description="Invite your first student to get started." />
        ) : (
          <SimpleTable head={[
            "Name",
            "Last active",
            ...PRACTICE_AREAS.map((a) => <span key={a.code} style={{ color: `var(--sat-area-${a.tab})` }}>{practiceAreaLabel(a.code)}</span>),
            <span key="tests" className="text-[var(--sat-tests-ink)]">Tests</span>,
            "",
          ]}>
            {rows.map((s) => (
              <LinkTr key={s.id}>
                <td className={TD}>
                  <StudentCell name={s.name} email={s.email} avatarUrl={s.avatarUrl}>
                    <RowLink href={`/teacher/students/${s.id}`} className="block truncate">{s.name}</RowLink>
                  </StudentCell>
                </td>
                <td className={TD}><DateCell date={s.lastActiveAt} now={now} inactive={isInactive(s.lastActiveAt, now)} /></td>
                {PRACTICE_AREAS.map((a) => {
                  const o = s.areas[a.code];
                  return (
                    <td key={a.code} className={TD}>
                      <RowAction>
                        <Link href={`/teacher/students/${s.id}?area=${a.tab}`} className="-mx-2 -my-1 block rounded-md px-2 py-1 hover:bg-gray-100">
                          {o.last ? (
                            <>
                              <b className="text-sm font-medium text-gray-800">{formatDate(o.last.at)}</b>
                              <span className="block text-xs text-gray-500">Practice · <Pct value={o.last.pct} /></span>
                            </>
                          ) : (
                            <span className="text-xs text-gray-400">No activity</span>
                          )}
                        </Link>
                      </RowAction>
                    </td>
                  );
                })}
                <td className={TD}>
                  <RowAction>
                    <Link href={`/teacher/students/${s.id}?area=tests`} className="-mx-2 -my-1 block rounded-md px-2 py-1 hover:bg-gray-100">
                      {s.tests.latest ? (
                        <>
                          <span className="whitespace-nowrap text-sm"><span className="text-[var(--sat-area-reading)]">R&amp;W</span> <b>{s.tests.latest.rw ?? "—"}</b> · <span className="text-[var(--sat-area-math)]">M</span> <b>{s.tests.latest.math ?? "—"}</b></span>
                          <span className="block text-xs text-gray-500">{s.tests.latest.label}{s.tests.latest.submittedAt ? ` · ${formatDate(s.tests.latest.submittedAt)}` : ""}</span>
                        </>
                      ) : (
                        <span className="text-xs text-gray-400">No test finished</span>
                      )}
                      {s.tests.inProgress ? <span className="block text-xs text-amber-700">{s.tests.inProgress} in progress</span> : null}
                    </Link>
                  </RowAction>
                </td>
                <ChevronCell />
              </LinkTr>
            ))}
          </SimpleTable>
        )}
      </section>
    </PageShell>
  );
}
