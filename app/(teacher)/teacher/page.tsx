import { AttentionRow, EmptyState, PageHeader, PageShell, SectionHeader } from "@/components/sat";
import { HEADER_SHORTCUT_CLASS, HeaderActions } from "@/components/sat/header-actions";
import { Breadcrumbs } from "@/components/sat/breadcrumbs";
import { StudentOverviewTable } from "@/components/sat/student-overview-table";
import prisma from "@/lib/prisma";
import Link from "next/link";
import { relativeDay } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Clock, KeyRound } from "lucide-react";
import { auth } from "@/lib/auth";
import { getFeatureSetting } from "@/lib/app-settings";
import { getFeatureFlagValues } from "@/lib/feature-flags";
import { refreshAssignmentStates } from "@/lib/assignments";
import { isResolvedNavGroup, resolveTeacherNav } from "@/lib/nav-config";
import { studentAccessWhereFor } from "@/lib/program-scope";
import { resolvePracticeArea, tabFromPracticeArea } from "@/lib/practice-area";
import { isInactive, loadStudentOverviews, type StudentOverview } from "@/lib/teacher-overview";

/** Students shown on Home; the rest are on Students ("All N students →"). */
const HOME_STUDENTS = 5;

/**
 * Teacher Home (one view, no section tabs — SAT-036/037): a summary, not a place to manage students.
 * Shortcuts to every other view, who needs attention (inactive 5+ days, unlock requests) and the 5
 * most recently active students with their latest practice per area and latest Test. Search, Invite
 * and the full table live on Students.
 */
export default async function TeacherDashboard() {
  const session = await auth();
  const now = new Date();
  await refreshAssignmentStates(now);
  const firstName = (session?.user.name ?? "teacher").split(" ")[0];
  const studentScope = session ? studentAccessWhereFor(session.user, now) : { role: "STUDENT", active: true, validationStatus: "APPROVED" };
  const unlockRequestsEnabled = await getFeatureSetting("STUDENT_UNLOCK_REQUESTS");
  // One shortcut per other sidebar view (same list as the sidebar: Teachers only for the master teacher).
  const master = session?.user.role === "TEACHER"
    ? Boolean((await prisma.user.findUnique({ where: { id: session.user.id }, select: { canManageTeachers: true } }))?.canManageTeachers)
    : false;
  const shortcuts = resolveTeacherNav({
    role: session?.user.role,
    flags: await getFeatureFlagValues({ role: session?.user.role, userId: session?.user.id }),
    capabilities: master ? ["manageTeachers"] : [],
  }).flatMap((item) => (isResolvedNavGroup(item) || item.href === "/teacher" ? [] : [item]));

  const [students, unlockRequests] = await Promise.all([
    prisma.user.findMany({
      where: studentScope,
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
          {shortcuts.map((item) => (
            <Link key={item.href} href={item.href} className={HEADER_SHORTCUT_CLASS}>{item.label} →</Link>
          ))}
        </HeaderActions>
      }
      />
    </div>
  );

  const inactive = rows.filter((s) => isInactive(s.lastActiveAt, now));
  // Most recently active first; never active last.
  const recent = [...rows].sort((a, b) => (b.lastActiveAt?.getTime() ?? 0) - (a.lastActiveAt?.getTime() ?? 0)).slice(0, HOME_STUDENTS);
  return (
    <PageShell className="space-y-4">
      {head(rows.length)}
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
        <SectionHeader
          title="Students"
          description="The 5 most recently active. Click a row to see everything the student has done, or an area cell to go straight to that area."
          action={rows.length ? <Link href="/teacher/students" className={HEADER_SHORTCUT_CLASS}>All {rows.length} students →</Link> : undefined}
        />
        {rows.length === 0 ? (
          <EmptyState title="No students yet" description="Invite your first student from Students." />
        ) : (
          <StudentOverviewTable rows={recent} now={now} />
        )}
      </section>
    </PageShell>
  );
}
