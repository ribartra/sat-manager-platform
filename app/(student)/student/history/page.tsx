import {
  EmptyState,
  LinkTabs,
  PageShell,
  PracticeSetAttemptsAccordion,
  Pagination,
  SectionHeader,
  SimpleTable,
  SkillResults,
  StatGrid,
  StatTile,
  TestAttemptsAccordion,
  TD,
  pageFromParam,
  paginate,
} from "@/components/sat";
import { Pct } from "@/components/sat/work-status";
import { Button } from "@/components/ui/button";
import { loadStudentTests } from "@/lib/test-assignments";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import Link from "next/link";
import { formatClock, formatDuration, relativeDay } from "@/lib/utils";
import { difficultyBadgeVariant, difficultyLabel } from "@/lib/domain-meta";
import { loadPracticeReport, shortSetName } from "@/lib/student-report";
import { practiceSetGroups, setsFromReportAttempts, testGroups as groupTests } from "@/lib/attempt-groups";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ProgressFilters } from "@/components/progress-filters";
import {
  buildAreaHref,
  practiceAreaFromTab,
  practiceAreaLabel,
  tabFromPracticeArea,
} from "@/lib/practice-area";
import { buildProgressHref, progressDateWhere, progressFilterEntries, progressFiltersFromParams } from "@/lib/progress-filters";
import { applyTimeFilterSetting } from "@/lib/time-filters";
import { Breadcrumbs } from "@/components/sat/breadcrumbs";
import { AreaTag } from "@/components/sat/practice-set-row";
import { loadStudentSessions, type StudentSession } from "@/lib/session-history";

interface PageProps {
  searchParams: Promise<{
    area?: string;
    topic?: string;
    difficulty?: string;
    from?: string;
    to?: string;
    page?: string;
    source?: string;
    sarea?: string;
    result?: string;
  }>;
}

const HISTORY_PAGE_SIZE = 20;
/** The student's own history lists every try of a set (the teacher's profile shows the last 3). */
const ALL_TRIES = 1000;
// Tabs in the mockup's order: By session (default), Tests, then practice by area. `area` keeps the old values.
const HISTORY_TABS = [
  { key: "sessions", label: "By session" },
  { key: "tests", label: "Tests" },
  { key: "math", label: "Practice · Math" },
  { key: "reading", label: "Practice · Reading" },
  { key: "writing", label: "Practice · Writing" },
] as const;
// History lists show submitted AND invalidated attempts (crossed out); stats use SUBMITTED only.
const HISTORY_STATUSES = ["SUBMITTED", "INVALIDATED"];

export default async function StudentHistoryPage({ searchParams }: PageProps) {
  const session = await auth();
  const userId = session!.user.id;
  const params = await searchParams;
  const { filters, showEndDate } = await applyTimeFilterSetting(progressFiltersFromParams(params));
  const area = filters.area;
  const practiceArea = practiceAreaFromTab(area);
  const dateFilter = progressDateWhere(filters);
  const pageParams = Object.fromEntries(progressFilterEntries(filters));
  const requestedPage = pageFromParam(params.page);

  const sessionsView = !params.area || params.area === "sessions";
  const historyTabs = (
    <LinkTabs
      label="History"
      active={sessionsView ? "sessions" : area}
      tabs={HISTORY_TABS.map((t) => ({
        key: t.key,
        label: t.label,
        href:
          t.key === "sessions"
            ? "/student/history?area=sessions"
            : buildAreaHref("/student/history", t.key, { difficulty: filters.difficulty, from: filters.from, to: filters.to }),
      }))}
    />
  );

  if (sessionsView) {
    const all = await loadStudentSessions(userId);
    const source = params.source === "test" || params.source === "practice" ? params.source : "";
    const sarea = params.sarea === "math" || params.sarea === "reading" || params.sarea === "writing" ? params.sarea : "";
    const result = params.result === "ok" || params.result === "bad" || params.result === "blank" ? params.result : "";
    const from = params.from && !Number.isNaN(new Date(`${params.from}T00:00:00`).getTime()) ? params.from : "";
    const areaMatch = (s: StudentSession) =>
      !sarea ||
      (sarea === "math" ? s.area === "MATH" || s.area === "math-test" : s.area === sarea.toUpperCase() || s.area === "rw");
    const listed = all
      .filter((s) => (!source || s.source === source) && areaMatch(s) && (!from || s.at >= new Date(`${from}T00:00:00`)))
      .map((s) => ({ s, rows: result ? s.rows.filter((r) => r.result === result) : s.rows }))
      .filter((x) => !result || x.rows.length > 0);
    const sessionPage = paginate(listed, requestedPage, HISTORY_PAGE_SIZE);
    const dayOf = (d: Date) => d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
    // A day heading before the first session of each day.
    const headings = sessionPage.items.map((x, i) => (i === 0 || dayOf(sessionPage.items[i - 1].s.at) !== dayOf(x.s.at) ? dayOf(x.s.at) : null));
    return (
      <PageShell width="wide" density="compact" className="space-y-4">
        <Breadcrumbs items={[{ label: "Home", href: "/student" }, { label: "History", href: "/student/history" }, { label: "By session" }]} />
        <h1 className="text-[26px] font-bold tracking-[-0.3px] text-gray-900">My history</h1>
        {historyTabs}
        <form action="/student/history" className="flex flex-wrap items-end gap-2.5 rounded-[var(--sat-radius)] border border-[var(--sat-border)] bg-white p-3 text-sm">
          <input type="hidden" name="area" value="sessions" />
          <label className="flex min-w-[150px] flex-1 flex-col gap-1 text-xs font-medium text-[var(--sat-muted)]">Source
            <select name="source" defaultValue={source} className="rounded-lg border border-[var(--sat-border-strong)] bg-white px-2.5 py-2 text-sm text-[var(--sat-text)]">
              <option value="">All sources</option>
              <option value="test">Test</option>
              <option value="practice">Practice</option>
            </select>
          </label>
          <label className="flex min-w-[150px] flex-1 flex-col gap-1 text-xs font-medium text-[var(--sat-muted)]">Area
            <select name="sarea" defaultValue={sarea} className="rounded-lg border border-[var(--sat-border-strong)] bg-white px-2.5 py-2 text-sm text-[var(--sat-text)]">
              <option value="">All areas</option>
              <option value="math">Math</option>
              <option value="reading">Reading</option>
              <option value="writing">Writing</option>
            </select>
          </label>
          <label className="flex min-w-[150px] flex-1 flex-col gap-1 text-xs font-medium text-[var(--sat-muted)]">Result
            <select name="result" defaultValue={result} className="rounded-lg border border-[var(--sat-border-strong)] bg-white px-2.5 py-2 text-sm text-[var(--sat-text)]">
              <option value="">All results</option>
              <option value="ok">Correct</option>
              <option value="bad">Incorrect</option>
              <option value="blank">Blank</option>
            </select>
          </label>
          <label className="flex min-w-[150px] flex-1 flex-col gap-1 text-xs font-medium text-[var(--sat-muted)]">From
            <input type="date" name="from" defaultValue={from} className="rounded-lg border border-[var(--sat-border-strong)] bg-white px-2.5 py-[7px] text-sm text-[var(--sat-text)]" />
          </label>
          <Button type="submit" size="sm" variant="secondary">Apply</Button>
          {source || sarea || result || from ? <Link href="/student/history?area=sessions" className="pb-1.5 text-xs text-blue-600 hover:underline">Clear</Link> : null}
        </form>
        <p className="text-xs text-gray-500">Each card is one session: a practice set or a test module. Click a session to see every question.</p>
        {sessionPage.items.length === 0 ? (
          <EmptyState title="No sessions match these filters." />
        ) : (
          <div>
            {sessionPage.items.map(({ s, rows }, index) => {
              const heading = headings[index];
              const right = s.rows.filter((r) => r.result === "ok").length;
              const pct = Math.round((right / Math.max(1, s.rows.length)) * 100);
              const time = s.rows.reduce((x, r) => x + (r.time ?? 0), 0);
              return (
                <div key={s.id}>
                  {heading ? (
                    <h3 className="mb-2 mt-5 text-sm font-semibold text-gray-900">
                      {heading} <span className="text-xs font-normal text-gray-500">· {relativeDay(s.at)}</span>
                    </h3>
                  ) : null}
                  <details className="group mt-2 rounded-lg border border-gray-200 bg-white">
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3.5 py-3 [&::-webkit-details-marker]:hidden">
                      <span className="min-w-0">
                        <span className="flex flex-wrap items-center gap-1.5">
                          {s.source === "test" ? <Badge variant="test">Test</Badge> : <Badge>Practice</Badge>}
                          {s.area === "rw" ? (
                            <span className="text-xs font-medium text-[var(--sat-area-reading)]">Reading &amp; Writing</span>
                          ) : s.area === "math-test" ? (
                            <AreaTag area="MATH" />
                          ) : (
                            <AreaTag area={s.area} />
                          )}
                          {s.done ? null : <Badge variant="warning">In progress</Badge>}
                        </span>
                        <b className="block text-sm text-gray-900">{s.title}</b>
                        <span className="text-xs text-gray-500">{formatClock(s.at)} · {s.rows.length} questions · {formatDuration(time)}</span>
                      </span>
                      <span className="flex shrink-0 items-center gap-2 text-right">
                        <span>
                          <span className="block text-xs text-gray-500">CORRECT</span>
                          <b className="text-sm">{right}/{s.rows.length}</b> <Pct value={pct} className="text-sm" />
                        </span>
                        <span aria-hidden className="text-gray-400 transition-transform group-open:rotate-90">›</span>
                      </span>
                    </summary>
                    <div className="border-t border-gray-200">
                      <SimpleTable head={["#", "Result", "Skill", "Difficulty", "Time"]} className="rounded-none border-0">
                        {rows.map((r) => (
                          <tr key={r.n}>
                            <td className={TD}>{r.n}</td>
                            <td className={TD}>
                              {r.result === "blank" ? <Badge>Blank</Badge> : r.result === "ok" ? <Badge variant="success">Correct</Badge> : <Badge variant="danger">Incorrect</Badge>}
                            </td>
                            <td className={`${TD} text-gray-700`}>{r.skill}</td>
                            <td className={TD}><Badge variant={difficultyBadgeVariant(r.difficulty)}>{difficultyLabel(r.difficulty)}</Badge></td>
                            <td className={`${TD} text-gray-500`}>{r.time ? formatDuration(r.time) : "—"}</td>
                          </tr>
                        ))}
                      </SimpleTable>
                      <div className="px-3.5 py-2.5">
                        <Button asChild size="sm"><Link href={s.href}>{s.done ? "Open full results" : "Continue"} ›</Link></Button>
                      </div>
                    </div>
                  </details>
                </div>
              );
            })}
          </div>
        )}
        <Pagination
          basePath="/student/history"
          params={{ area: "sessions", source, sarea, result, from }}
          pageSize={HISTORY_PAGE_SIZE}
          {...sessionPage}
        />
      </PageShell>
    );
  }

  if (area === "tests") {
    const [examAttempts, tests] = await Promise.all([
      prisma.fullPracticeTestAttempt.findMany({
        where: {
          studentId: userId,
          // Every attempt is kept, including Tests not finished yet (modules can be taken in any order).
          status: { in: [...HISTORY_STATUSES, "IN_PROGRESS"] },
          ...dateFilter,
        },
        include: { test: { select: { id: true, name: true } } },
        orderBy: [{ submittedAt: "desc" }, { startedAt: "desc" }],
      }),
      loadStudentTests(userId),
    ]);
    // One row per Test with its last try, opening to every try (same accordion as the teacher);
    // the date filter keeps the tries listed by the query above.
    const inFilter = new Set(examAttempts.map((exam) => exam.id));
    const testRows = groupTests(tests, (a) => inFilter.has(a.id));
    const examPage = paginate(testRows, requestedPage, HISTORY_PAGE_SIZE);

    return (
      <PageShell width="wide" density="compact" className="space-y-4">
        <Breadcrumbs items={[{ label: "Home", href: "/student" }, { label: "History", href: "/student/history" }, { label: "Tests" }]} />
        <h1 className="text-[26px] font-bold tracking-[-0.3px] text-gray-900">My history</h1>
        <p className="text-sm text-gray-500">Every Test attempt is saved, including tests you haven&apos;t finished. Open a test to see every try; click a try to see the results.</p>
        {historyTabs}
        <ProgressFilters action="/student/history" filters={filters} topics={[]} showEndDate={showEndDate} />

        <section>
          <SectionHeader
            title="Test attempts"
            description={`${examAttempts.length} attempt${examAttempts.length === 1 ? "" : "s"}`}
            action={<Button asChild size="sm" variant="secondary"><Link href="/student/tests?view=completed">Go to Tests ›</Link></Button>}
          />
          {examAttempts.length === 0 ? (
            <EmptyState
              title="No Test attempts for these filters."
              action={<Link href="/student/tests" className="text-sm text-blue-600 hover:underline">See your tests →</Link>}
            />
          ) : (
            <TestAttemptsAccordion tests={examPage.items} hrefFor={(id) => `/student/tests/results/${id}`} />
          )}
          <Pagination basePath="/student/history" params={pageParams} pageSize={HISTORY_PAGE_SIZE} {...examPage} />
        </section>
      </PageShell>
    );
  }

  // Same data as the teacher's view (lib/student-report.ts); results by skill have no filters.
  const report = await loadPracticeReport(userId, practiceArea ?? "MATH", {});
  const counted = report.attempts; // SUBMITTED, newest first
  const latestSubmitted = counted[0] ?? null;
  const setsPracticed = new Set(counted.map((a) => a.assignmentId ?? a.id)).size;
  const timePracticing = counted.reduce((sum, a) => sum + a.totalTime, 0);
  // Practice sets with their last attempt; this is the student's history, so every try is listed.
  const setGroups = practiceSetGroups(setsFromReportAttempts(report.attemptHistory), ALL_TRIES);
  const historyPage = paginate(setGroups, requestedPage, HISTORY_PAGE_SIZE);
  return (
    <PageShell width="wide" density="compact" className="space-y-4">
      <Breadcrumbs items={[{ label: "Home", href: "/student" }, { label: "History", href: "/student/history" }, { label: `Practice · ${practiceAreaLabel(practiceArea)}` }]} />
      <header className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-[26px] font-bold tracking-[-0.3px] text-gray-900">My history</h1>
          <p className="mt-0.5 text-sm text-gray-500">Review your {practiceAreaLabel(practiceArea).toLowerCase()} practice and find your next focus area.</p>
        </div>
        <p className="text-xs text-gray-500">{counted.length} finished attempt{counted.length === 1 ? "" : "s"}</p>
      </header>
      {historyTabs}

      {setGroups.length === 0 ? (
        <Card padding="lg" className="py-14 text-center text-gray-500">
          <p>No finished {practiceAreaLabel(practiceArea).toLowerCase()} practice sets yet.</p>
          <Link href={buildAreaHref("/student/practice", tabFromPracticeArea(practiceArea) ?? "summary")} className="mt-2 inline-block text-sm text-blue-600 hover:underline">
            Go to Practice →
          </Link>
        </Card>
      ) : (
        <div className="space-y-4">
          <StatGrid cols={3}>
            <StatTile label="Completed" value={counted.length} sub={`attempt${counted.length === 1 ? "" : "s"} on ${setsPracticed} practice set${setsPracticed === 1 ? "" : "s"}`} href="#history" />
            <StatTile
              label="Latest score"
              value={!latestSubmitted ? "—" : latestSubmitted.percent === null ? "No answers" : <Pct value={latestSubmitted.percent} />}
              sub={latestSubmitted ? `${shortSetName(latestSubmitted.name)} · open ›` : "No finished set yet"}
              href={latestSubmitted ? buildProgressHref(`/student/results/${latestSubmitted.id}`, filters) : undefined}
            />
            <StatTile label="Time practicing" value={formatDuration(timePracticing)} sub="on finished sets" />
          </StatGrid>

          <SkillResults
            report={report}
            title="Skills by difficulty"
            description="Each level adds up your last attempt of every set (by questions) · open a skill to see each source"
            attemptHref={(id) => buildProgressHref(`/student/results/${id}`, filters)}
          />

          <section id="history" aria-labelledby="history-results-heading" className="scroll-mt-6">
            <SectionHeader
              title={<span id="history-results-heading">Practice history</span>}
              description="One row per practice set with your last attempt. Open it to see every try; click a try to see each question again."
            />
            <PracticeSetAttemptsAccordion sets={historyPage.items} hrefFor={(id) => buildProgressHref(`/student/results/${id}`, filters)} recentLimit={ALL_TRIES} />
            <Pagination basePath="/student/history" params={pageParams} pageSize={HISTORY_PAGE_SIZE} anchor="history" {...historyPage} />
          </section>
        </div>
      )}
    </PageShell>
  );
}
