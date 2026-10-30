import { AttentionRow, EmptyState, PageHeader, PageShell, SectionHeader } from "@/components/sat";
import { HEADER_SHORTCUT_CLASS } from "@/components/sat/header-actions";
import { Breadcrumbs } from "@/components/sat/breadcrumbs";
import { CardGrid } from "@/components/sat/area-summary-card";
import { StudentOverviewTable } from "@/components/sat/student-overview-table";
import { ViewSummaryCard } from "@/components/sat/view-summary-card";
import { Pct } from "@/components/sat/work-status";
import prisma from "@/lib/prisma";
import Link from "next/link";
import { formatDate, relativeDay } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { BookOpen, ClipboardList, Clock, GraduationCap, Hourglass, KeyRound, Users } from "lucide-react";
import { auth } from "@/lib/auth";
import { getFeatureSetting } from "@/lib/app-settings";
import { refreshAssignmentStates } from "@/lib/assignments";
import { loadAttemptHistory } from "@/lib/attempt-history";
import { currentContentScope } from "@/lib/content-scope";
import { loadPending } from "@/lib/pending";
import { assignHref } from "@/lib/assign-params";
import { studentAccessWhereFor, teacherProgramIds } from "@/lib/program-scope";
import { resolvePracticeArea, tabFromPracticeArea } from "@/lib/practice-area";
import { isInactive, loadStudentOverviews, type StudentOverview } from "@/lib/teacher-overview";

/** Students shown on Home; the rest are on Students ("All N students →"). */
const HOME_STUDENTS = 5;
const DAY = 86_400_000;

/**
 * Teacher Home (one view, no section tabs — SAT-036/037): a summary, not a place to manage students.
 * Who needs attention (inactive 5+ days, unlock requests), one box per view (Students, Pending, Tests,
 * Practice, History, Teachers for the master teacher) with its main numbers and the way in, and the
 * students active most recently. Search, Invite and the full table live on Students.
 */
export default async function TeacherDashboard() {
  const session = await auth();
  const now = new Date();
  await refreshAssignmentStates(now);
  const firstName = (session?.user.name ?? "teacher").split(" ")[0];
  const studentScope = session ? studentAccessWhereFor(session.user, now) : { role: "STUDENT", active: true, validationStatus: "APPROVED" };
  const unlockRequestsEnabled = await getFeatureSetting("STUDENT_UNLOCK_REQUESTS");
  const master = session?.user.role === "TEACHER"
    ? Boolean((await prisma.user.findUnique({ where: { id: session.user.id }, select: { canManageTeachers: true } }))?.canManageTeachers)
    : false;
  const contentScope = await currentContentScope();
  const inviteWhere = { role: "STUDENT", usedAt: null, revokedAt: null, expiresAt: { gt: now }, ...(session?.user.role === "TEACHER" ? { invitedById: session.user.id } : {}) };

  const [students, unlockRequests, invitations, testCount, sets, testAssignments] = await Promise.all([
    prisma.user.findMany({ where: studentScope, select: { id: true }, orderBy: { name: "asc" } }),
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
    prisma.inviteToken.count({ where: inviteWhere }).catch(() => 0),
    prisma.fullPracticeTest.count({ where: { ...contentScope, status: "PUBLISHED" } }),
    prisma.practiceSet.findMany({ where: { ...contentScope, status: "PUBLISHED" }, select: { topic: { select: { domain: { select: { practiceArea: true } } } } } }),
    // Test assignments of the teacher's students (same counting rule as the Tests page).
    prisma.fullPracticeTestAssignment.findMany({ where: { student: studentScope }, select: { status: true, dueDate: true } }),
  ]);
  const studentIds = students.map((s) => s.id);
  const [overviews, pending, history, teachers] = await Promise.all([
    loadStudentOverviews(studentIds, now),
    loadPending(studentIds),
    // Tries finished in the last 7 days (counted tries only, as History by default).
    loadAttemptHistory(studentIds, { status: "completed", from: new Date(now.getTime() - 7 * DAY) }),
    master && session
      ? Promise.all([
          prisma.user.count({ where: { role: "TEACHER" } }),
          teacherProgramIds(session.user).then((programIds) =>
            prisma.inviteToken.count({ where: { role: "TEACHER", usedAt: null, revokedAt: null, expiresAt: { gt: now }, OR: [{ invitedById: session.user.id }, { programId: { in: programIds } }] } }),
          ),
        ])
      : Promise.resolve(null),
  ]);
  const rows = students.map((s) => overviews.get(s.id)).filter((o): o is StudentOverview => Boolean(o));

  const inactive = rows.filter((s) => isInactive(s.lastActiveAt, now));
  const activeThisWeek = rows.filter((s) => !isInactive(s.lastActiveAt, now, 7)).length;
  // Most recently active first; never active last.
  const recent = [...rows].sort((a, b) => (b.lastActiveAt?.getTime() ?? 0) - (a.lastActiveAt?.getTime() ?? 0)).slice(0, HOME_STUDENTS);
  const pendingBy = (status: string) => pending.filter((p) => p.status === status).length;
  const testsCompleted = testAssignments.filter((a) => a.status === "COMPLETED").length;
  const testsOverdue = testAssignments.filter((a) => a.status === "OVERDUE" || (a.status !== "COMPLETED" && a.dueDate && a.dueDate < now)).length;
  const setsIn = (area: string) => sets.filter((s) => resolvePracticeArea(s.topic.domain) === area).length;
  const latestTest = rows
    .flatMap((s) => (s.tests.latest?.submittedAt ? [{ ...s.tests.latest, student: s.name, submittedAt: s.tests.latest.submittedAt }] : []))
    .sort((a, b) => b.submittedAt.getTime() - a.submittedAt.getTime())[0];
  const practiceTries = history.filter((h) => h.kind === "practice").length;
  const latestTry = [...history].sort((a, b) => b.at.getTime() - a.at.getTime())[0];
  const plural = (n: number, word: string) => `${word}${n === 1 ? "" : "s"}`;

  return (
    <PageShell className="space-y-4">
      {/* The breadcrumb row keeps the title at the same height as on every other page. */}
      <div>
        <Breadcrumbs items={[{ label: "Home" }]} />
        <PageHeader
          title={`Hello, ${firstName}!`}
          description={
            <>
              {rows.length} {plural(rows.length, "student")} · Today is {now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}.
            </>
          }
        />
      </div>

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

      {/* One box per view: its main numbers and the way in. */}
      <CardGrid>
        <ViewSummaryCard
          title="Students"
          icon={<Users size={16} />}
          href="/teacher/students"
          value={rows.length}
          valueLabel={plural(rows.length, "student")}
          chips={[
            { label: "Active this week", value: activeThisWeek, tone: activeThisWeek ? "success" : "default" },
            { label: "Inactive 5+ days", value: inactive.length, tone: inactive.length ? "warning" : "default" },
            { label: "Invitations", value: invitations, tone: invitations ? "info" : "default" },
          ]}
          secondary={{ label: "Assign →", href: assignHref({}) }}
          action="Open Students →"
        />
        <ViewSummaryCard
          title="Pending"
          icon={<Hourglass size={16} />}
          href="/teacher/pending"
          value={pending.length}
          valueLabel="assigned, not finished"
          chips={[
            { label: "Not started", value: pendingBy("PENDING"), tone: pendingBy("PENDING") ? "info" : "default" },
            { label: "In progress", value: pendingBy("IN_PROGRESS"), tone: pendingBy("IN_PROGRESS") ? "warning" : "default" },
            { label: "Overdue", value: pendingBy("OVERDUE"), tone: pendingBy("OVERDUE") ? "danger" : "default" },
          ]}
          action="See all pending →"
        />
        <ViewSummaryCard
          title="Tests"
          icon={<ClipboardList size={16} />}
          href="/teacher/tests"
          accent="tests"
          value={testCount}
          valueLabel={`${plural(testCount, "test")} published`}
          chips={[
            { label: "Assigned", value: testAssignments.length, tone: testAssignments.length ? "info" : "default" },
            { label: "Completed", value: testsCompleted, tone: testsCompleted ? "success" : "default" },
            { label: "Overdue", value: testsOverdue, tone: testsOverdue ? "danger" : "default" },
          ]}
          line={
            latestTest ? (
              <>
                Latest: {latestTest.student} · {latestTest.label} · <Scores rw={latestTest.rw} math={latestTest.math} /> · {formatDate(latestTest.submittedAt)}
              </>
            ) : (
              "No test finished yet"
            )
          }
          action="Open Tests →"
        />
        <ViewSummaryCard
          title="Practice"
          icon={<BookOpen size={16} />}
          href="/teacher/practice-sets"
          value={sets.length}
          valueLabel={`practice ${plural(sets.length, "set")} published`}
          chips={[
            { label: "Math", value: setsIn("MATH"), color: "var(--sat-area-math)" },
            { label: "Reading", value: setsIn("READING"), color: "var(--sat-area-reading)" },
            { label: "Writing", value: setsIn("WRITING"), color: "var(--sat-area-writing)" },
          ]}
          line={`${practiceTries} practice ${(practiceTries === 1 ? "try" : "tries")} in the last 7 days`}
          action="Open Practice →"
        />
        <ViewSummaryCard
          title="History"
          icon={<Clock size={16} />}
          href="/teacher/history"
          value={history.length}
          valueLabel={`${(history.length === 1 ? "try" : "tries")} finished in the last 7 days`}
          line={
            latestTry
              ? (
                <>
                  Latest: {latestTry.studentName} · {latestTry.title} · {latestTry.kind === "test" ? <Scores rw={latestTry.rw} math={latestTry.math} /> : <Pct value={latestTry.pct} />} · {relativeDay(latestTry.at, now)}
                </>
              )
              : "No tries in the last 7 days"
          }
          action="Open History →"
        />
        {teachers ? (
          <ViewSummaryCard
            title="Teachers"
            icon={<GraduationCap size={16} />}
            href="/teacher/teachers"
            value={teachers[0]}
            valueLabel={plural(teachers[0], "teacher")}
            chips={[{ label: "Invitations", value: teachers[1], tone: teachers[1] ? "info" : "default" }]}
            action="Open Teachers →"
          />
        ) : null}
      </CardGrid>

      <section>
        <SectionHeader
          title="Students"
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

/** Test section scores in the area colours (R&W orange, Math blue), as in the students table. */
function Scores({ rw, math }: { rw: number | null; math: number | null }) {
  return (
    <>
      <span className="text-[var(--sat-area-reading)]">R&amp;W</span> <b>{rw ?? "—"}</b> · <span className="text-[var(--sat-area-math)]">Math</span> <b>{math ?? "—"}</b>
    </>
  );
}
