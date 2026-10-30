import { PageHeader, PageShell } from "@/components/sat";
import { Breadcrumbs } from "@/components/sat/breadcrumbs";
import { ViewSummaryCard, type ViewSummaryChip } from "@/components/sat/view-summary-card";
import { Scores } from "@/components/sat/test-scores";
import { Pct } from "@/components/sat/work-status";
import prisma from "@/lib/prisma";
import { cn, formatDate, relativeDay } from "@/lib/utils";
import { BookOpen, ClipboardList, Clock, GraduationCap, Users } from "lucide-react";
import { auth } from "@/lib/auth";
import { refreshAssignmentStates } from "@/lib/assignments";
import { loadAttemptHistory } from "@/lib/attempt-history";
import { historyHref } from "@/lib/history-params";
import { loadPending, pendingHref, type PendingStatus } from "@/lib/pending";
import { currentContentScope } from "@/lib/content-scope";
import { studentAccessWhereFor, teacherProgramIds } from "@/lib/program-scope";
import { resolvePracticeArea } from "@/lib/practice-area";
import { isInactive, loadStudentOverviews, type StudentOverview } from "@/lib/teacher-overview";

const DAY = 86_400_000;
/** Latest items listed in a box (students, Tests, tries). */
const LIST_SIZE = 4;

/**
 * Teacher Home (one view, no section tabs — SAT-036/037): a summary, not a place to manage students.
 * One tall box per view, in the menu's order (Students, Tests, Practice, Teachers for the master teacher, History) with its
 * main numbers (each opens the view with that filter), its latest items and the way in. Notices, search, Invite and the students table live on Students.
 */
export default async function TeacherDashboard() {
  const session = await auth();
  const now = new Date();
  await refreshAssignmentStates(now);
  const firstName = (session?.user.name ?? "teacher").split(" ")[0];
  const studentScope = session ? studentAccessWhereFor(session.user, now) : { role: "STUDENT", active: true, validationStatus: "APPROVED" };
  const master = session?.user.role === "TEACHER"
    ? Boolean((await prisma.user.findUnique({ where: { id: session.user.id }, select: { canManageTeachers: true } }))?.canManageTeachers)
    : false;
  const contentScope = await currentContentScope();
  const inviteWhere = { role: "STUDENT", usedAt: null, revokedAt: null, expiresAt: { gt: now }, ...(session?.user.role === "TEACHER" ? { invitedById: session.user.id } : {}) };

  const [students, invitations, testCount, sets, testAssignments] = await Promise.all([
    prisma.user.findMany({ where: studentScope, select: { id: true }, orderBy: { name: "asc" } }),
    prisma.inviteToken.count({ where: inviteWhere }).catch(() => 0),
    prisma.fullPracticeTest.count({ where: { ...contentScope, status: "PUBLISHED" } }),
    prisma.practiceSet.findMany({ where: { ...contentScope, status: "PUBLISHED" }, select: { topic: { select: { domain: { select: { practiceArea: true } } } } } }),
    // Test assignments of the teacher's students (same counting rule as the Tests page).
    prisma.fullPracticeTestAssignment.findMany({ where: { student: studentScope }, select: { status: true, dueDate: true } }),
  ]);
  const studentIds = students.map((s) => s.id);
  const [overviews, history, pending, teachers] = await Promise.all([
    loadStudentOverviews(studentIds, now),
    // Tries finished in the last 7 days (counted tries only, as History by default).
    loadAttemptHistory(studentIds, { status: "completed", from: new Date(now.getTime() - 7 * DAY) }),
    // Assigned and not finished (the Pending list): split by practice / Test and status.
    loadPending(studentIds),
    master && session
      ? Promise.all([
          prisma.user.count({ where: { role: "TEACHER", active: true } }),
          prisma.user.count({ where: { role: "TEACHER", active: false } }),
          teacherProgramIds(session.user).then((programIds) =>
            prisma.inviteToken.count({ where: { role: "TEACHER", usedAt: null, revokedAt: null, expiresAt: { gt: now }, OR: [{ invitedById: session.user.id }, { programId: { in: programIds } }] } }),
          ),
        ])
      : Promise.resolve(null),
  ]);
  const rows = students.map((s) => overviews.get(s.id)).filter((o): o is StudentOverview => Boolean(o));

  const inactive = rows.filter((s) => isInactive(s.lastActiveAt, now));
  const activeThisWeek = rows.filter((s) => !isInactive(s.lastActiveAt, now, 7)).length;
  const withTests = rows.filter((s) => s.tests.pending.length > 0).length;
  const recentStudents = [...rows].sort((a, b) => (b.lastActiveAt?.getTime() ?? 0) - (a.lastActiveAt?.getTime() ?? 0)).slice(0, LIST_SIZE);
  const testsCompleted = testAssignments.filter((a) => a.status === "COMPLETED").length;
  const pendingCount = (kind: "practice" | "test", status: PendingStatus) => pending.filter((p) => p.kind === kind && p.status === status).length;
  const setsIn = (area: string) => sets.filter((s) => resolvePracticeArea(s.topic.domain) === area).length;
  const latestTests = rows
    .flatMap((s) => (s.tests.latest?.submittedAt ? [{ ...s.tests.latest, studentId: s.id, student: s.name, submittedAt: s.tests.latest.submittedAt }] : []))
    .sort((a, b) => b.submittedAt.getTime() - a.submittedAt.getTime())
    .slice(0, LIST_SIZE);
  const practiceTries = history.filter((h) => h.kind === "practice").length;
  const latestTries = [...history].sort((a, b) => b.at.getTime() - a.at.getTime()).slice(0, LIST_SIZE);
  const plural = (n: number, word: string) => `${word}${n === 1 ? "" : "s"}`;
  const tone = (n: number, t: "success" | "warning" | "danger" | "info"): ViewSummaryChip["tone"] => (n ? t : "default");
  const statusChips = (kind: "practice" | "test", type: "practice" | "tests"): ViewSummaryChip[] => [
    { label: "Not started", value: pendingCount(kind, "PENDING"), tone: tone(pendingCount(kind, "PENDING"), "info"), href: pendingHref("/teacher/pending", { type, status: "PENDING" }) },
    { label: "In progress", value: pendingCount(kind, "IN_PROGRESS"), tone: tone(pendingCount(kind, "IN_PROGRESS"), "warning"), href: pendingHref("/teacher/pending", { type, status: "IN_PROGRESS" }) },
    { label: "Overdue", value: pendingCount(kind, "OVERDUE"), tone: tone(pendingCount(kind, "OVERDUE"), "danger"), href: pendingHref("/teacher/pending", { type, status: "OVERDUE" }) },
  ];

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

      {/* One tall box per view: its main numbers and the way in. */}
      <div className={cn("grid grid-cols-1 gap-3 sm:grid-cols-2 [&>*]:min-w-0", teachers ? "lg:grid-cols-5" : "lg:grid-cols-4")}>
        <ViewSummaryCard
          title="Students"
          icon={<Users size={16} />}
          href="/teacher/students"
          value={rows.length}
          valueLabel={plural(rows.length, "student")}
          chips={[
            { label: "Active this week", value: activeThisWeek, tone: tone(activeThisWeek, "success"), href: "/teacher/students?show=active" },
            { label: "Inactive for 5+ days", value: inactive.length, tone: tone(inactive.length, "warning"), href: "/teacher/students?show=inactive" },
            { label: "With tests to take", value: withTests, tone: tone(withTests, "info"), href: "/teacher/students?show=pending-tests" },
            { label: "Invitations", value: invitations, tone: tone(invitations, "info"), href: "/teacher/students#invitations" },
          ]}
          list={{
            title: "Recently active",
            empty: "No students yet.",
            items: recentStudents.map((s) => ({
              key: s.id,
              label: s.name,
              detail: s.lastActiveAt ? `Active ${relativeDay(s.lastActiveAt, now)}${isInactive(s.lastActiveAt, now) ? " · ⚠ inactive 5+ days" : ""}` : "Never active",
              href: `/teacher/students/${s.id}`,
            })),
          }}
          action="Open Students →"
        />
        <ViewSummaryCard
          title="Tests"
          icon={<ClipboardList size={16} />}
          href="/teacher/tests"
          accent="tests"
          value={testCount}
          valueLabel={`${plural(testCount, "test")} published`}
          chips={[
            ...statusChips("test", "tests"),
            { label: "Completed", value: testsCompleted, tone: tone(testsCompleted, "success"), href: historyHref({ type: "tests" }) },
          ]}
          list={{
            title: "Latest finished",
            empty: "No test finished yet.",
            items: latestTests.map((t) => ({
              key: t.id,
              label: `${t.student} · ${t.label}`,
              detail: (
                <>
                  <Scores rw={t.rw} math={t.math} /> · {formatDate(t.submittedAt)}
                </>
              ),
              href: `/teacher/students/${t.studentId}/tests/${t.id}`,
            })),
          }}
          action="Open Tests →"
        />
        <ViewSummaryCard
          title="Practice"
          icon={<BookOpen size={16} />}
          href="/teacher/practice-sets"
          value={sets.length}
          valueLabel={`practice ${plural(sets.length, "set")} published`}
          chips={[
            { label: "Math", value: setsIn("MATH"), color: "var(--sat-area-math)", href: "/teacher/practice-sets?area=math" },
            { label: "Reading", value: setsIn("READING"), color: "var(--sat-area-reading)", href: "/teacher/practice-sets?area=reading" },
            { label: "Writing", value: setsIn("WRITING"), color: "var(--sat-area-writing)", href: "/teacher/practice-sets?area=writing" },
            ...statusChips("practice", "practice"),
            { label: "Tries in the last 7 days", value: practiceTries, tone: tone(practiceTries, "success"), href: historyHref({ type: "practice" }, { period: "week" }) },
          ]}
          action="Open Practice →"
        />
        {teachers ? (
          <ViewSummaryCard
            title="Teachers"
            icon={<GraduationCap size={16} />}
            href="/teacher/teachers"
            value={teachers[0] + teachers[1]}
            valueLabel={plural(teachers[0] + teachers[1], "teacher")}
            chips={[
              { label: "Active", value: teachers[0], tone: tone(teachers[0], "success"), href: "/teacher/teachers?access=enabled" },
              { label: "Deactivated", value: teachers[1], href: "/teacher/teachers?access=disabled" },
              { label: "Invitations", value: teachers[2], tone: tone(teachers[2], "info"), href: "/teacher/teachers#invitations" },
            ]}
            action="Open Teachers →"
          />
        ) : null}
        <ViewSummaryCard
          title="History"
          icon={<Clock size={16} />}
          href="/teacher/history"
          value={history.length}
          valueLabel={`${history.length === 1 ? "try" : "tries"} finished in the last 7 days`}
          chips={[
            { label: "Practice", value: practiceTries, tone: tone(practiceTries, "success"), href: historyHref({ type: "practice" }, { period: "week" }) },
            { label: "Tests", value: history.length - practiceTries, tone: tone(history.length - practiceTries, "success"), href: historyHref({ type: "tests" }, { period: "week" }) },
          ]}
          list={{
            title: "Latest tries",
            empty: "No tries in the last 7 days.",
            items: latestTries.map((t) => ({
              key: t.id,
              label: `${t.studentName} · ${t.title}`,
              detail: (
                <>
                  {t.kind === "test" ? <Scores rw={t.rw} math={t.math} /> : <Pct value={t.pct} />} · {relativeDay(t.at, now)}
                </>
              ),
              href: `/teacher/students/${t.studentId}/${t.kind === "test" ? "tests" : "attempts"}/${t.id}`,
            })),
          }}
          action="Open History →"
        />
      </div>
    </PageShell>
  );
}
