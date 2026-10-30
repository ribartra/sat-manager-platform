import Link from "next/link";
import { Fragment } from "react";
import { ArrowLeft, X } from "lucide-react";
import {
  AttemptStatusBadge,
  Breadcrumbs,
  ChevronCell,
  Delta,
  EmptyState,
  LinkTr,
  PageShell,
  Pagination,
  RowAction,
  RowLink,
  SimpleTable,
  StudentCell,
  TD,
  VoidableValue,
  invalidatedRowClass,
  ListFilters,
  pageFromParam,
  paginate,
  PAGE_SIZE,
} from "@/components/sat";
import { AreaTag } from "@/components/sat/practice-set-row";
import { InvalidateAttemptButton } from "@/components/sat/invalidate-attempt-button";
import { Pct } from "@/components/sat/work-status";
import { Badge } from "@/components/ui/badge";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { studentAccessWhereFor } from "@/lib/program-scope";
import { loadAttemptHistory, type HistoryRow } from "@/lib/attempt-history";
import { difficultyBadgeVariant, difficultyLabel, difficultyOptions } from "@/lib/domain-meta";
import { PRACTICE_AREA_TABS, practiceAreaLabel, type PracticeAreaCode } from "@/lib/practice-area";
import { historyHref, parseHistoryParams, type HistoryArea, type HistoryParams } from "@/lib/history-params";
import { officialSkillsFor } from "@/lib/taxonomy-order";
import { practiceSetTitle } from "@/lib/attempt-groups";
import { HEADER_ACTION_CLASS } from "@/components/sat/header-actions";
import { formatDate, formatDuration, relativeDay } from "@/lib/utils";
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

  const rows = await loadAttemptHistory(studentId ? [studentId] : students.map((s) => s.id), {
    kind: filter.type === "tests" ? "test" : filter.type === "practice" ? "practice" : undefined,
    area: filter.area ? AREA_CODE[filter.area] : undefined,
    topicId: filter.skill,
    difficulty: filter.difficulty,
    practiceSetId: filter.set,
    testId: filter.test,
    status: filter.status,
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
  const show: Columns = {
    student: !studentId,
    type: !filter.type || (filter.type === "practice" && !filter.area),
    typeBadge: !filter.type,
    area: !filter.area,
    title: !filter.set && !filter.test,
    difficulty: !filter.difficulty,
  };
  const head = [
    "Date",
    ...(show.student ? ["Student"] : []),
    ...(show.type ? [show.typeBadge ? "Type" : "Area"] : []),
    ...(show.title ? [filter.type === "tests" ? "Test" : filter.type === "practice" ? "Practice set" : "Test / practice set"] : []),
    "Attempt",
    "Score",
    "Change",
    "",
    "",
  ];
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
    <PageShell maxWidth={1180} width="wide">
      <Breadcrumbs
        items={
          student
            ? [{ label: "Home", href: "/teacher" }, { label: "Students", href: "/teacher/students" }, { label: student.name, href: backHref! }, { label: "History" }]
            : [{ label: "Home", href: "/teacher" }, { label: "History" }]
        }
      />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-[26px] font-bold tracking-[-0.3px] text-gray-900">{student ? `History · ${student.name}` : "History"}</h1>
          <p className="mb-4 mt-0.5 text-sm text-gray-500">
            {context.length ? <b className="font-medium text-gray-700">{context.join(" · ")} · </b> : null}
            Every practice set and Test {student ? student.name.split(" ")[0] : "your students"} took, newest first. Practice shows % correct; Tests show SAT section scores.
          </p>
        </div>
        {backHref ? (
          <Link href={backHref} className={HEADER_ACTION_CLASS}>
            <ArrowLeft size={14} aria-hidden /> Back to {student!.name.split(" ")[0]}
          </Link>
        ) : null}
      </div>

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
          { name: "status", label: "Status", value: filter.status ?? "", allLabel: "Any", options: STATUS_OPTIONS },
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
          <SimpleTable head={head}>
            {page.items.map((r, index) => {
              // A day heading before the first try of each day (former Activity list).
              const day = dayLabel(r.at);
              const newDay = index === 0 || dayLabel(page.items[index - 1].at) !== day;
              return (
                <Fragment key={r.id}>
                  {newDay ? (
                    <tr className="bg-[var(--sat-surface-2)]">
                      <td colSpan={head.length} className="px-3 py-1.5 text-xs font-semibold text-gray-600">
                        {day} <span className="font-normal text-gray-400">· {relativeDay(r.at)}</span>
                      </td>
                    </tr>
                  ) : null}
                  <HistoryTableRow row={r} show={show} current={current} keep={keepExtra} />
                </Fragment>
              );
            })}
          </SimpleTable>
          <Pagination basePath="/teacher/history" params={params} pageSize={pageSize} {...page} />
        </>
      )}
    </PageShell>
  );
}

interface Columns {
  student: boolean;
  type: boolean;
  /** Test / Practice badge (hidden once the type is fixed). */
  typeBadge: boolean;
  area: boolean;
  title: boolean;
  difficulty: boolean;
}

const dayLabel = (date: Date) => date.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric", year: "numeric" });

function HistoryTableRow({ row: r, show, current, keep }: { row: HistoryRow; show: Columns; current: HistoryParams; keep: Record<string, string | undefined> }) {
  const isTest = r.kind === "test";
  const href = `/teacher/students/${r.studentId}/${isTest ? "tests" : "attempts"}/${r.id}`;
  return (
    <LinkTr className={invalidatedRowClass(r.status)}>
      <td className={`${TD} whitespace-nowrap text-gray-600`}>
        {formatDate(r.at)}
        <span className="block text-xs text-gray-400">{r.status === "IN_PROGRESS" ? "Started" : "Completed"} {relativeDay(r.at)}</span>
      </td>
      {show.student ? (
        <td className={TD}>
          <RowAction>
            {/* This student's History (same filters). */}
            <Link href={historyHref({ ...current, student: r.studentId }, keep)} className="hover:underline">
              <StudentCell name={r.studentName} avatarUrl={r.avatarUrl} />
            </Link>
          </RowAction>
        </td>
      ) : null}
      {show.type ? (
        <td className={TD}>
          <span className="flex flex-wrap items-center gap-1.5">
            {show.typeBadge ? isTest ? <Badge variant="test">Test</Badge> : <Badge>Practice</Badge> : null}
            {r.area && show.area ? <AreaTag area={r.area} /> : null}
          </span>
        </td>
      ) : null}
      {show.title ? (
        <td className={TD}>
          <span className="flex flex-wrap items-center gap-2">
            <RowLink href={href}>{r.title}</RowLink>
            {r.difficulty && show.difficulty ? <Badge variant={difficultyBadgeVariant(r.difficulty)}>{difficultyLabel(r.difficulty)}</Badge> : null}
            {r.status === "INVALIDATED" ? <AttemptStatusBadge status={r.status} /> : null}
          </span>
        </td>
      ) : null}
      <td className={`${TD} whitespace-nowrap`}>
        {show.title ? (
          `Try ${r.tryNumber} of ${r.tryCount}`
        ) : (
          <RowLink href={href}>Try {r.tryNumber} of {r.tryCount}</RowLink>
        )}
        {!show.title && r.status === "INVALIDATED" ? <AttemptStatusBadge status={r.status} /> : null}
        {r.status === "IN_PROGRESS" ? (
          <span className="block text-xs text-amber-700">{isTest ? `${r.modulesDone ?? 0} of 4 modules` : "In progress"}</span>
        ) : null}
      </td>
      <td className={TD}>
        {isTest ? (
          r.status === "IN_PROGRESS" ? (
            <span className="text-xs text-gray-400">—</span>
          ) : (
            <VoidableValue status={r.status}>
              <span className="whitespace-nowrap"><span className="text-[var(--sat-area-reading)]">R&amp;W</span> <b className="tabular-nums">{r.rw ?? "—"}</b> · <span className="text-[var(--sat-area-math)]">Math</span> <b className="tabular-nums">{r.math ?? "—"}</b></span>
            </VoidableValue>
          )
        ) : r.pct !== null ? (
          <VoidableValue status={r.status}>
            <Pct value={r.pct} className="font-semibold" /> <span className="text-xs text-gray-500">{r.correct} of {r.total}</span>
            {r.time ? <span className="block text-xs text-gray-400">{formatDuration(r.time)}</span> : null}
          </VoidableValue>
        ) : (
          <span className="text-xs text-gray-400">—</span>
        )}
      </td>
      <td className={TD}>
        {isTest ? (
          <span className="flex flex-col text-xs">
            {r.changeRw !== null ? <span>R&amp;W <Delta value={r.changeRw} unit="" /></span> : null}
            {r.changeMath !== null ? <span>Math <Delta value={r.changeMath} unit="" /></span> : null}
          </span>
        ) : (
          <Delta value={r.change} unit="%" />
        )}
      </td>
      <td className={`${TD} text-right`}>
        {/* The only action on an attempt, same component as the attempt pages and the student's History. */}
        <RowAction><InvalidateAttemptButton attemptId={r.id} kind={isTest ? "test" : "practice"} status={r.status} compact /></RowAction>
      </td>
      <ChevronCell />
    </LinkTr>
  );
}
