import { BookOpen, ClipboardList, Clock, FileText } from "lucide-react";
import { nameWithSource } from "@/lib/test-name";
import { Breadcrumbs, PageHeader } from "@/components/sat";
import type { Crumb } from "@/components/sat/breadcrumbs";
import { Scores } from "@/components/sat/test-scores";
import { ViewSummaryCard, type ViewSummaryChip } from "@/components/sat/view-summary-card";
import { Pct } from "@/components/sat/work-status";
import { getFeatureSetting } from "@/lib/app-settings";
import { loadAttemptHistory } from "@/lib/attempt-history";
import { difficultyLabel } from "@/lib/domain-meta";
import { historyHref } from "@/lib/history-params";
import { loadPending, pendingHref, type PendingStatus } from "@/lib/pending";
import { PRACTICE_AREA_TABS } from "@/lib/practice-area";
import prisma from "@/lib/prisma";
import { loadStudentPractice, sortPracticeSets } from "@/lib/student-practice";
import { loadStudentTests, sortTests } from "@/lib/test-assignments";
import { cn, formatDate, relativeDay } from "@/lib/utils";

const DAY = 86_400_000;
/** Latest items listed in a box. */
const LIST_SIZE = 4;

/**
 * Where the Home boxes link: the student's own pages, or the teacher's pages in "Student view"
 * (/teacher/impersonate/[studentId], read-only: the same boxes, only the links change).
 */
export interface HomeLinks {
  tests: string;
  practice: (area?: "math" | "reading" | "writing") => string;
  pending: (type: "practice" | "tests", status?: PendingStatus) => string;
  history: (type?: "practice" | "tests", extra?: Record<string, string>) => string;
  practiceResult: (attemptId: string) => string;
  testResult: (attemptId: string) => string;
  /** Start / continue a set or a Test; null in the teacher's Student view (it only looks). */
  practiceStart: ((assignmentId: string) => string) | null;
  testStart: ((assignmentId: string) => string) | null;
  /** Breadcrumb trail of the Home (Student view: Home › Students › {name} › View as student). */
  crumbs?: Crumb[];
}

export const STUDENT_HOME_LINKS: HomeLinks = {
  tests: "/student/tests",
  practice: (area) => (area ? `/student/practice?area=${area}` : "/student/practice"),
  pending: (type, status) => pendingHref("/student/pending", { type, status }),
  history: (type, extra) => historyHref({ type }, extra, "/student/history"),
  practiceResult: (id) => `/student/results/${id}`,
  testResult: (id) => `/student/tests/results/${id}`,
  practiceStart: (id) => `/student/practice/assignment/${id}`,
  testStart: (id) => `/student/tests/${id}`,
};

/** Teacher "Student view": the boxes open the teacher's pages for this student. */
export function teacherViewLinks(studentId: string, studentName: string): HomeLinks {
  const student = `/teacher/students/${studentId}`;
  const home = `/teacher/impersonate/${studentId}`;
  return {
    tests: `${student}?area=tests`,
    practice: (area) => `${student}?area=${area ?? "math"}`,
    pending: (type, status) => pendingHref("/teacher/pending", { student: studentId, type, status }),
    history: (type, extra) => historyHref({ student: studentId, type }, extra),
    practiceResult: (id) => `${student}/attempts/${id}`,
    testResult: (id) => `${student}/tests/${id}`,
    practiceStart: null,
    testStart: null,
    crumbs: [
      { label: "Home", href: "/teacher" },
      { label: "Students", href: "/teacher/students" },
      { label: studentName, href: student },
      { label: "View as student", href: home },
    ],
  };
}

/**
 * Student Home (same pattern as the teacher Home): one tall box per view, in the menu's order — Tests,
 * Practice, Materials (when on), History — with the main numbers (each opens the view with that
 * filter), what is next or latest, and the way in. No tabs: each view has its own page.
 */
export async function StudentHome({ studentId, firstName, links = STUDENT_HOME_LINKS }: { studentId: string; firstName: string; links?: HomeLinks }) {
  const now = new Date();
  const [practice, tests, pending, history, materialsOn] = await Promise.all([
    loadStudentPractice(studentId),
    loadStudentTests(studentId),
    loadPending([studentId]),
    // Tries finished in the last 7 days (counted tries only, as History by default).
    loadAttemptHistory([studentId], { status: "completed", from: new Date(now.getTime() - 7 * DAY) }),
    getFeatureSetting("MATERIALS_MODULE"),
  ]);
  // Materials of the programs the student is enrolled in (as the Materials page lists them).
  const materials =
    materialsOn && !links.crumbs
      ? await prisma.studyMaterial.count({
          where: { status: "PUBLISHED", program: { deletedAt: null, enrollments: { some: { studentId, active: true, status: "APPROVED" } } } },
        })
      : null;

  const pendingCount = (kind: "practice" | "test", status?: PendingStatus) => pending.filter((p) => p.kind === kind && (!status || p.status === status)).length;
  const tone = (n: number, t: "success" | "warning" | "danger" | "info"): ViewSummaryChip["tone"] => (n ? t : "default");
  const statusChips = (kind: "practice" | "test", type: "practice" | "tests"): ViewSummaryChip[] => [
    { label: "Not started", value: pendingCount(kind, "PENDING"), tone: tone(pendingCount(kind, "PENDING"), "info"), href: links.pending(type, "PENDING") },
    { label: "In progress", value: pendingCount(kind, "IN_PROGRESS"), tone: tone(pendingCount(kind, "IN_PROGRESS"), "warning"), href: links.pending(type, "IN_PROGRESS") },
    { label: "Overdue", value: pendingCount(kind, "OVERDUE"), tone: tone(pendingCount(kind, "OVERDUE"), "danger"), href: links.pending(type, "OVERDUE") },
  ];

  const testsTodo = sortTests(tests).pending;
  // The list says the same status as the chips and the Pending page (the assignment's).
  const statusOf = new Map(pending.map((p) => [p.id, p.status]));
  const statusLabel = (id: string, due: Date | null) => {
    const status = statusOf.get(id);
    if (status === "OVERDUE") return due ? `Overdue · was due ${formatDate(due)}` : "Overdue";
    if (status === "IN_PROGRESS") return "In progress";
    return due ? `Not started · due ${formatDate(due)}` : "Not started · no due date";
  };
  const testsDone = tests.filter((t) => t.lastSubmitted).length;
  const latestTest = tests
    .flatMap((t) => (t.lastSubmitted?.submittedAt ? [{ name: t.name, source: t.sourceName, attempt: t.lastSubmitted, at: t.lastSubmitted.submittedAt }] : []))
    .sort((a, b) => b.at.getTime() - a.at.getTime())[0];
  const practiceTodo = sortPracticeSets(practice).filter((p) => p.state !== "done");
  // Sets finished at least once (a retry in progress still counts here).
  const practiceDone = practice.filter((p) => p.state === "done").length;
  const practiceTries = history.filter((h) => h.kind === "practice").length;
  const latestTries = [...history].sort((a, b) => b.at.getTime() - a.at.getTime()).slice(0, LIST_SIZE);
  const boxes = 3 + (materials !== null ? 1 : 0);

  return (
    <>
      {/* The breadcrumb row keeps the title at the same height as on every other page. */}
      <div className="mb-4">
        <Breadcrumbs items={links.crumbs ? links.crumbs.map((c, i) => (i === links.crumbs!.length - 1 ? { label: c.label } : c)) : [{ label: "Home" }]} />
        <PageHeader title={`Hello, ${firstName}!`} description={<>Today is {now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}.</>} />
      </div>

      {/* One tall box per view: its main numbers and the way in. */}
      <div className={cn("grid grid-cols-1 gap-3 sm:grid-cols-2 [&>*]:min-w-0", boxes === 4 ? "lg:grid-cols-4" : "lg:grid-cols-3")}>
        <ViewSummaryCard
          title="Tests"
          icon={<ClipboardList size={16} />}
          href={links.tests}
          accent="tests"
          value={testsTodo.length}
          valueLabel={`${testsTodo.length === 1 ? "test" : "tests"} to take`}
          chips={[...statusChips("test", "tests"), { label: "Completed", value: testsDone, tone: tone(testsDone, "success"), href: links.history("tests") }]}
          line={
            latestTest ? (
              <>
                Latest: {nameWithSource(latestTest.name, latestTest.source)} · <Scores rw={latestTest.attempt.rwScore} math={latestTest.attempt.mathScore} /> · {formatDate(latestTest.at)}
              </>
            ) : (
              "No test finished yet"
            )
          }
          list={{
            title: "Up next",
            empty: "No test to take.",
            items: testsTodo.slice(0, LIST_SIZE).map((t) => ({
              key: t.assignmentId,
              label: nameWithSource(t.name, t.sourceName),
              detail: statusLabel(t.assignmentId, t.dueDate),
              href: links.testStart ? links.testStart(t.assignmentId) : links.tests,
            })),
          }}
          action="Open Tests →"
        />
        <ViewSummaryCard
          title="Practice"
          icon={<BookOpen size={16} />}
          href={links.practice()}
          value={practiceTodo.length}
          valueLabel={`practice ${practiceTodo.length === 1 ? "set" : "sets"} to do`}
          chips={[
            ...PRACTICE_AREA_TABS.map((t) => ({
              label: t.label,
              value: practiceTodo.filter((p) => p.area === t.practiceArea).length,
              color: `var(--sat-area-${t.key})`,
              href: links.practice(t.key),
            })),
            ...statusChips("practice", "practice"),
            { label: "Completed", value: practiceDone, tone: tone(practiceDone, "success"), href: links.history("practice") },
          ]}
          list={{
            title: "Up next",
            empty: "Nothing to do right now.",
            items: practiceTodo.slice(0, LIST_SIZE).map((p) => ({
              key: p.assignmentId,
              label: `${p.skill} · ${difficultyLabel(p.difficulty)}`,
              detail: p.locked ? `Opens ${formatDate(p.opensAt)}` : statusLabel(p.assignmentId, p.dueDate),
              href: links.practiceStart ? links.practiceStart(p.assignmentId) : links.practice(),
            })),
          }}
          action="Open Practice →"
        />
        {materials !== null ? (
          <ViewSummaryCard
            title="Materials"
            icon={<FileText size={16} />}
            href="/student/materials"
            value={materials}
            valueLabel={materials === 1 ? "study material" : "study materials"}
            action="Open Materials →"
          />
        ) : null}
        <ViewSummaryCard
          title="History"
          icon={<Clock size={16} />}
          href={links.history()}
          value={history.length}
          valueLabel={`${history.length === 1 ? "try" : "tries"} finished in the last 7 days`}
          chips={[
            { label: "Practice", value: practiceTries, tone: tone(practiceTries, "success"), href: links.history("practice", { period: "week" }) },
            { label: "Tests", value: history.length - practiceTries, tone: tone(history.length - practiceTries, "success"), href: links.history("tests", { period: "week" }) },
          ]}
          list={{
            title: "Latest tries",
            empty: "No tries in the last 7 days.",
            items: latestTries.map((t) => ({
              key: t.id,
              label: t.title,
              detail: (
                <>
                  {t.kind === "test" ? <Scores rw={t.rw} math={t.math} /> : <Pct value={t.pct} />} · {relativeDay(t.at, now)}
                </>
              ),
              href: t.kind === "test" ? links.testResult(t.id) : links.practiceResult(t.id),
            })),
          }}
          action="Open History →"
        />
      </div>
    </>
  );
}
