import Link from "next/link";
import { ArrowLeft, X } from "lucide-react";
import { Breadcrumbs, EmptyState, PageHeader, PageShell, Pagination, ListFilters, pageFromParam, paginate, PAGE_SIZE } from "@/components/sat";
import { HistoryTable, historyColumns } from "@/components/sat/history-table";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { studentAccessWhereFor } from "@/lib/program-scope";
import { loadAttemptHistory } from "@/lib/attempt-history";
import { difficultyLabel, difficultyOptions } from "@/lib/domain-meta";
import { PRACTICE_AREA_TABS, practiceAreaLabel, type PracticeAreaCode } from "@/lib/practice-area";
import { historyHref, parseHistoryParams, type HistoryArea, HISTORY_STATUS_DEFAULT } from "@/lib/history-params";
import { officialSkillsFor } from "@/lib/taxonomy-order";
import { practiceSetTitle } from "@/lib/attempt-groups";
import { HEADER_ACTION_CLASS, HeaderActions } from "@/components/sat/header-actions";
import { periodDates, periodParams, resolvePeriod } from "@/lib/period-filter";

export const dynamic = "force-dynamic";

interface PageProps {
  /** See lib/history-params.ts (student, type, area, skill, difficulty, set, test, status, period, q, page). */
  searchParams: Promise<Record<string, string | undefined>>;
}

const AREA_CODE: Record<HistoryArea, PracticeAreaCode> = { math: "MATH", reading: "READING", writing: "WRITING" };
const STATUS_OPTIONS = [
  { value: "completed", label: "Completed" },
  { value: "progress", label: "In progress" },
  { value: "invalidated", label: "Not counted" },
];

/**
 * History (mockup teacher/history.html): every practice and Test try of the students the teacher can
 * see, newest first, grouped by day — the one place for tries (the student page links here). Opened
 * from a student, an attempt or a set, the URL carries that context (lib/history-params.ts) and the
 * list opens filtered; a column whose filter is fixed is hidden (it would repeat). Practice shows %
 * correct; Tests show SAT section scores. Students are scoped with studentAccessWhereFor.
 */
export default async function TeacherHistoryPage({ searchParams }: PageProps) {
  const session = await auth();
  const now = new Date();
  const query = await searchParams;
  const filter = parseHistoryParams(query);
  const students = await prisma.user.findMany({
    where: session ? studentAccessWhereFor(session.user, now) : { role: "STUDENT", active: true, validationStatus: "APPROVED" },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  const studentId = students.some((s) => s.id === query.student) ? query.student! : "";
  const student = students.find((s) => s.id === studentId) ?? null;
  // Period: All time, Last week / month / year or Custom dates (older ?from= links count as Custom).
  const period = resolvePeriod(query, now);

  // Skill options follow the chosen area (every practice area otherwise).
  const skillAreas: HistoryArea[] = filter.area ? [filter.area] : filter.type === "tests" ? [] : ["math", "reading", "writing"];
  const skillLists = await Promise.all(skillAreas.map(async (a) => ({ area: a, skills: await officialSkillsFor(AREA_CODE[a]) })));
  const skillOptions = skillLists.flatMap(({ area: a, skills }) =>
    skills.map((skill) => ({ value: skill.id, label: filter.area ? skill.name : `${practiceAreaLabel(AREA_CODE[a])} · ${skill.name}` })),
  );
  const skillName = filter.skill ? skillLists.flatMap((l) => l.skills).find((skill) => skill.id === filter.skill)?.name : undefined;
  const [setName, testName] = await Promise.all([
    filter.set ? prisma.practiceSet.findUnique({ where: { id: filter.set }, select: { name: true, difficulty: true } }).then((set) => (set ? practiceSetTitle(set.name, set.difficulty) : null)) : null,
    filter.test ? prisma.fullPracticeTest.findUnique({ where: { id: filter.test }, select: { name: true } }).then((test) => test?.name ?? null) : null,
  ]);

  const statusShown = filter.status ?? HISTORY_STATUS_DEFAULT;
  const rows = await loadAttemptHistory(studentId ? [studentId] : students.map((s) => s.id), {
    kind: filter.type === "tests" ? "test" : filter.type === "practice" ? "practice" : undefined,
    area: filter.area ? AREA_CODE[filter.area] : undefined,
    topicId: filter.skill,
    difficulty: filter.difficulty,
    practiceSetId: filter.set,
    testId: filter.test,
    context: filter.context === "classroom" ? "CLASSROOM" : filter.context === "homework" ? "HOMEWORK" : undefined,
    // Completed by default (status=all: every try).
    status: statusShown === "all" ? undefined : statusShown,
    ...periodDates(period),
  });
  // No free-text search here: the Student and Skill drop-downs search inside when they are long.
  const shownRows = rows;
  // 25 rows per page, every filter kept when paging.
  const pageSize = PAGE_SIZE;
  const page = paginate(shownRows, pageFromParam(query.page), pageSize);
  const current = { ...filter, q: undefined, student: studentId || undefined };
  // The period travels with every link of the page (chip, student cells, pager).
  const keepExtra = periodParams(period);
  const params = { ...current, ...keepExtra };

  // A fixed filter hides its column (it would repeat the same value on every row).
  const show = historyColumns(filter, !studentId);
  const context = [
    filter.type === "tests" ? "Tests" : filter.type === "practice" ? "Practice" : null,
    filter.area ? practiceAreaLabel(AREA_CODE[filter.area]) : null,
    skillName ?? null,
    filter.difficulty ? difficultyLabel(filter.difficulty) : null,
    setName ?? testName ?? null,
  ].filter(Boolean);
  // Back to the student, on the tab the History was opened from.
  const backArea = filter.type === "tests" ? "tests" : filter.area ?? (filter.type === "practice" ? "math" : null);
  const backHref = student ? `/teacher/students/${student.id}${backArea ? `?area=${backArea}` : ""}` : null;

  return (
    <PageShell>
      <Breadcrumbs
        items={
          student
            ? [{ label: "Home", href: "/teacher" }, { label: "Students", href: "/teacher/students" }, { label: student.name, href: backHref! }, { label: "History" }]
            : [{ label: "Home", href: "/teacher" }, { label: "History" }]
        }
      />
      <PageHeader
        title={student ? `History · ${student.name}` : "History"}
        description={
          <>
            {context.length ? <b className="font-medium text-gray-700">{context.join(" · ")} · </b> : null}
              Every practice set and Test {student ? student.name.split(" ")[0] : "your students"} took, newest first. Practice shows % correct; Tests show SAT section scores.
          </>
        }
        actions={
          backHref ? (
            <HeaderActions>
              <Link href={backHref} className={HEADER_ACTION_CLASS}>
                <ArrowLeft size={14} aria-hidden /> Back to {student!.name.split(" ")[0]}
              </Link>
            </HeaderActions>
          ) : null
        }
      />

      <ListFilters
        action="/teacher/history"
        search={false}
        hidden={{ set: filter.set, test: filter.test }}
        filters={[
          { name: "student", label: "Student", value: studentId, allLabel: "All students", options: students.map((st) => ({ value: st.id, label: st.name })) },
          // Type and practice area in one select: Tests, Practice (every area) or one practice area.
          {
            name: "what",
            label: "Type",
            value: filter.type === "tests" ? "tests" : filter.area ?? (filter.type === "practice" ? "practice" : ""),
            allLabel: "Tests and practice",
            options: [{ value: "tests", label: "Tests" }, { value: "practice", label: "Practice" }, ...PRACTICE_AREA_TABS.map((t) => ({ value: t.key, label: `Practice · ${t.label}` }))],
          },
          ...(filter.type === "tests" ? [] : [{ name: "skill", label: "Skill", value: filter.skill ?? "", allLabel: "All skills", options: skillOptions }]),
          ...(filter.type === "tests" ? [] : [{ name: "difficulty", label: "Difficulty", value: filter.difficulty ?? "", allLabel: "All levels", options: difficultyOptions() }]),
          // Practice only: Classroom (not scored) or Homework.
          ...(filter.type === "tests" ? [] : [{ name: "context", label: "Context", value: filter.context ?? "", allLabel: "Classroom and Homework", options: [{ value: "classroom", label: "Classroom" }, { value: "homework", label: "Homework" }] }]),
          { name: "status", label: "Status", value: statusShown, allLabel: "Any", allValue: "all", defaultValue: HISTORY_STATUS_DEFAULT, options: STATUS_OPTIONS },
        ]}
        period={period}
      />

      {setName || testName ? (
        <p className="mb-2 flex flex-wrap items-center gap-2 text-xs text-gray-600">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--sat-border)] bg-white px-2.5 py-1 font-medium">
            {setName ? "Practice set" : "Test"}: {setName ?? testName}
            <Link href={historyHref({ ...current, set: undefined, test: undefined }, keepExtra)} aria-label="Show every set and Test" className="text-gray-400 hover:text-gray-700">
              <X size={12} aria-hidden />
            </Link>
          </span>
        </p>
      ) : null}
      <p className="mb-2 text-xs text-gray-500">{shownRows.length} attempt{shownRows.length === 1 ? "" : "s"}</p>
      {shownRows.length === 0 ? (
        <EmptyState title="No attempts match these filters." />
      ) : (
        <>
          {/* No Date column: the day heading above each day's tries already says it. */}
          <HistoryTable
            rows={page.items}
            show={show}
            type={filter.type}
            hrefFor={(r) => `/teacher/students/${r.studentId}/${r.kind === "test" ? "tests" : "attempts"}/${r.id}`}
            studentHref={(r) => historyHref({ ...current, student: r.studentId }, keepExtra)}
          />
          <Pagination basePath="/teacher/history" params={params} pageSize={pageSize} {...page} />
        </>
      )}
    </PageShell>
  );
}
