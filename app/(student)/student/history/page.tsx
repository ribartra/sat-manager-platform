import Link from "next/link";
import { redirect } from "next/navigation";
import { X } from "lucide-react";
import { Breadcrumbs, EmptyState, ListFilters, PAGE_SIZE, PageHeader, PageShell, Pagination, pageFromParam, paginate } from "@/components/sat";
import { HistoryTable, historyColumns } from "@/components/sat/history-table";
import { HEADER_SHORTCUT_CLASS, HeaderActions } from "@/components/sat/header-actions";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { loadAttemptHistory } from "@/lib/attempt-history";
import { practiceSetTitle } from "@/lib/attempt-groups";
import { difficultyLabel, difficultyOptions } from "@/lib/domain-meta";
import { HISTORY_STATUS_DEFAULT, historyHref, parseHistoryParams, type HistoryArea } from "@/lib/history-params";
import { PRACTICE_AREA_TABS, practiceAreaLabel, type PracticeAreaCode } from "@/lib/practice-area";
import { periodDates, periodParams, resolvePeriod } from "@/lib/period-filter";
import { officialSkillsFor } from "@/lib/taxonomy-order";

export const dynamic = "force-dynamic";

const AREA_CODE: Record<HistoryArea, PracticeAreaCode> = { math: "MATH", reading: "READING", writing: "WRITING" };
const STATUS_OPTIONS = [
  { value: "completed", label: "Completed" },
  { value: "progress", label: "In progress" },
  { value: "invalidated", label: "Not counted" },
];

/**
 * The student's History: the teacher's History (one table of tries, newest first, grouped by day)
 * for their own tries only — no Student column or filter. Filters in the URL (lib/history-params.ts:
 * type / area, skill, difficulty, set, test, status, period); a fixed filter hides its column. Each
 * row opens the try's results (with every question).
 */
export default async function StudentHistoryPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const userId = session.user.id;
  const raw = await searchParams;
  // Older links: ?area=tests meant the Tests tab, ?area=sessions the default list.
  const query = raw.area === "tests" ? { ...raw, area: undefined, type: "tests" } : raw.area === "sessions" ? { ...raw, area: undefined } : raw;
  const filter = parseHistoryParams(query);
  const period = resolvePeriod(query);

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
  // Only this student's tries.
  const rows = await loadAttemptHistory([userId], {
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
  const page = paginate(rows, pageFromParam(query.page), PAGE_SIZE);
  const current = { ...filter, q: undefined, student: undefined };
  const keepExtra = periodParams(period);
  const show = historyColumns(filter, false);
  const context = [
    filter.type === "tests" ? "Tests" : filter.type === "practice" ? "Practice" : null,
    filter.area ? practiceAreaLabel(AREA_CODE[filter.area]) : null,
    skillName ?? null,
    filter.difficulty ? difficultyLabel(filter.difficulty) : null,
    setName ?? testName ?? null,
  ].filter(Boolean);

  return (
    <PageShell>
      <Breadcrumbs items={[{ label: "Home", href: "/student" }, { label: "History" }]} />
      <PageHeader
        title="History"
        description={
          <>
            {context.length ? <b className="font-medium text-gray-700">{context.join(" · ")} · </b> : null}
            Every practice set and Test you took, newest first. Practice shows % correct; Tests show SAT section scores.
          </>
        }
        actions={
          <HeaderActions>
            {/* What is still to do (with the way back from there). */}
            <Link href="/student/pending" className={HEADER_SHORTCUT_CLASS}>Pending →</Link>
          </HeaderActions>
        }
      />

      <ListFilters
        action="/student/history"
        search={false}
        hidden={{ set: filter.set, test: filter.test }}
        filters={[
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
            <Link href={historyHref({ ...current, set: undefined, test: undefined }, keepExtra, "/student/history")} aria-label="Show every set and Test" className="text-gray-400 hover:text-gray-700">
              <X size={12} aria-hidden />
            </Link>
          </span>
        </p>
      ) : null}
      <p className="mb-2 text-xs text-gray-500">{rows.length} attempt{rows.length === 1 ? "" : "s"}</p>
      {rows.length === 0 ? (
        <EmptyState title="No attempts match these filters." />
      ) : (
        <>
          <HistoryTable
            rows={page.items}
            show={show}
            type={filter.type}
            hrefFor={(r) => (r.kind === "test" ? `/student/tests/results/${r.id}` : `/student/results/${r.id}`)}
          />
          <Pagination basePath="/student/history" params={{ ...current, ...keepExtra }} pageSize={PAGE_SIZE} {...page} />
        </>
      )}
    </PageShell>
  );
}
