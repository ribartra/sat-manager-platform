import {
  AttemptStatusBadge,
  ChevronCell,
  DIFFICULTIES,
  EmptyState,
  LinkTabs,
  LinkTr,
  PageShell,
  Pagination,
  RowLink,
  SectionHeader,
  SimpleTable,
  SkillDifficultyMatrix,
  StatGrid,
  StatTile,
  TD,
  TestSectionScore,
  TestTotalCell,
  VoidableValue,
  invalidatedRowClass,
  isInvalidated,
  pageFromParam,
  paginate,
} from "@/components/sat";
import { Pct } from "@/components/sat/work-status";
import { Button } from "@/components/ui/button";
import { loadStudentTests } from "@/lib/test-assignments";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import Link from "next/link";
import { formatClock, formatDate, formatDuration, relativeDay } from "@/lib/utils";
import { difficultyBadgeVariant, difficultyLabel } from "@/lib/domain-meta";
import { shortSetName } from "@/lib/student-report";
import { scoreBandTextClass } from "@/lib/score-band";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ProgressFilters } from "@/components/progress-filters";
import {
  buildAreaHref,
  practiceAreaFromTab,
  practiceAreaLabel,
  practiceAreaTopicWhere,
} from "@/lib/practice-area";
import { classifyPracticeSetArea, practiceSetAreaLabel } from "@/lib/parent-access";
import { PerformanceBreakdown } from "@/components/performance-breakdown";
import { TopicDifficultyTrend } from "@/components/topic-difficulty-trend";
import { summarizeAllQuestionAnswers } from "@/lib/weighted-score";
import {
  aggregateDifficultyMetrics,
  aggregateTopicDifficultyMetrics,
  aggregateTopicDifficultyTrend,
} from "@/lib/progress-analytics";
import { buildProgressHref, progressDateWhere, progressFilterEntries, progressFiltersFromParams } from "@/lib/progress-filters";
import { applyTimeFilterSetting } from "@/lib/time-filters";
import { compareSkills, isOfficialSkill } from "@/lib/taxonomy-order";
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

type HistoryQuestionRow = {
  topicId: string;
  topicName: string;
  difficulty: string;
  answer: string | null;
  isCorrect: boolean;
  attemptId: string;
};

export default async function StudentHistoryPage({ searchParams }: PageProps) {
  const session = await auth();
  const userId = session!.user.id;
  const params = await searchParams;
  const { filters, showEndDate } = await applyTimeFilterSetting(progressFiltersFromParams(params));
  const area = filters.area;
  const practiceArea = practiceAreaFromTab(area);
  const topicId = filters.topic || "";
  const difficulty = filters.difficulty || "";
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
        <h1 className="text-2xl font-semibold text-gray-900">My history</h1>
        {historyTabs}
        <form action="/student/history" className="flex flex-wrap items-end gap-2 text-sm">
          <input type="hidden" name="area" value="sessions" />
          <label className="flex flex-col text-xs text-gray-500">Source
            <select name="source" defaultValue={source} className="mt-0.5 rounded-md border border-gray-300 px-2 py-1.5 text-sm text-gray-800">
              <option value="">All sources</option>
              <option value="test">Test</option>
              <option value="practice">Practice</option>
            </select>
          </label>
          <label className="flex flex-col text-xs text-gray-500">Area
            <select name="sarea" defaultValue={sarea} className="mt-0.5 rounded-md border border-gray-300 px-2 py-1.5 text-sm text-gray-800">
              <option value="">All areas</option>
              <option value="math">Math</option>
              <option value="reading">Reading</option>
              <option value="writing">Writing</option>
            </select>
          </label>
          <label className="flex flex-col text-xs text-gray-500">Result
            <select name="result" defaultValue={result} className="mt-0.5 rounded-md border border-gray-300 px-2 py-1.5 text-sm text-gray-800">
              <option value="">All results</option>
              <option value="ok">Correct</option>
              <option value="bad">Incorrect</option>
              <option value="blank">Blank</option>
            </select>
          </label>
          <label className="flex flex-col text-xs text-gray-500">From
            <input type="date" name="from" defaultValue={from} className="mt-0.5 rounded-md border border-gray-300 px-2 py-1 text-sm text-gray-800" />
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
    // Try numbers and module progress come from the Test assignments (all tries, not only the filtered ones).
    const tryInfo = new Map(tests.flatMap((t) => t.attempts.map((a) => [a.id, { a, of: t.attempts.length }] as const)));
    const examPage = paginate(examAttempts, requestedPage, HISTORY_PAGE_SIZE);

    return (
      <PageShell width="wide" density="compact" className="space-y-4">
        <Breadcrumbs items={[{ label: "Home", href: "/student" }, { label: "History", href: "/student/history" }, { label: "Tests" }]} />
        <h1 className="text-2xl font-semibold text-gray-900">My history</h1>
        <p className="text-sm text-gray-500">Every Test attempt is saved, including tests you haven&apos;t finished. Click a row to see the results.</p>
        {historyTabs}
        <ProgressFilters action="/student/history" filters={filters} topics={[]} showEndDate={showEndDate} />

        <section>
          <SectionHeader
            title="Test attempts"
            description={`${examAttempts.length} attempt${examAttempts.length === 1 ? "" : "s"}`}
            action={<Button asChild size="sm" variant="secondary"><Link href="/student/tests">Go to Tests ›</Link></Button>}
          />
          {examAttempts.length === 0 ? (
            <EmptyState
              title="No Test attempts for these filters."
              action={<Link href="/student/tests" className="text-sm text-blue-600 hover:underline">See your tests →</Link>}
            />
          ) : (
            <SimpleTable head={["Date", "Test", "Attempt", "Reading & Writing", "Math", "Total", ""]}>
              {examPage.items.map((exam) => {
                const info = tryInfo.get(exam.id);
                const row = info?.a ?? { ...exam, view: null, tryNumber: 1 };
                const when = exam.submittedAt ?? exam.startedAt;
                return (
                  <LinkTr key={exam.id} className={invalidatedRowClass(exam.status)}>
                    <td className={`${TD} whitespace-nowrap text-gray-600`}>
                      {formatDate(when)}
                      <span className="block text-xs text-gray-400">{exam.submittedAt ? "Completed" : "Started"} {relativeDay(when)}</span>
                    </td>
                    <td className={TD}>
                      <span className="flex flex-wrap items-center gap-2">
                        <RowLink href={`/student/tests/results/${exam.id}`}>{exam.test.name}</RowLink>
                        {isInvalidated(exam.status) ? <AttemptStatusBadge status={exam.status} /> : null}
                        {exam.status === "IN_PROGRESS" ? <Badge variant="warning">In progress</Badge> : null}
                      </span>
                    </td>
                    <td className={`${TD} whitespace-nowrap`}>Try {row.tryNumber}{info ? ` of ${info.of}` : ""}</td>
                    <td className={TD}><TestSectionScore attempt={row} section="RW" /></td>
                    <td className={TD}><TestSectionScore attempt={row} section="MATH" /></td>
                    <td className={TD}><TestTotalCell attempt={row} /></td>
                    <ChevronCell />
                  </LinkTr>
                );
              })}
            </SimpleTable>
          )}
          <Pagination basePath="/student/history" params={pageParams} pageSize={HISTORY_PAGE_SIZE} {...examPage} />
        </section>
      </PageShell>
    );
  }

  const [historyAttempts, topics] = await Promise.all([
    prisma.attempt.findMany({
      where: {
        studentId: userId,
        status: { in: HISTORY_STATUSES },
        ...dateFilter,
        assignment: {
          practiceSet: {
            ...(practiceArea ? { topic: { domain: { practiceArea } } } : {}),
          },
        },
      },
      include: {
        answers: { include: { question: { select: { difficulty: true, topicId: true, topic: { select: { id: true, name: true } } } } } },
        assignment: {
          include: {
            practiceSet: {
              include: {
                topic: { include: { domain: { include: { section: true } } } },
                questions: { include: { question: { select: { topicId: true, difficulty: true, topic: { select: { id: true, name: true } } } } } },
              },
            },
          },
        },
      },
      orderBy: { submittedAt: "desc" },
    }),
    prisma.topic.findMany({
      where: practiceArea ? practiceAreaTopicWhere(practiceArea) : undefined,
      include: { domain: { include: { section: true } } },
      orderBy: { name: "asc" },
    }),
  ]);

  const attempts = historyAttempts.filter((attempt) => attempt.status === "SUBMITTED");
  const buildQuestionRows = (attempt: (typeof historyAttempts)[number]): HistoryQuestionRow[] => {
    const answersByQuestion = new Map(attempt.answers.map((answer) => [answer.questionId, answer]));
    const practiceQuestions = attempt.assignment?.practiceSet.questions ?? [];
    const questionSources = practiceQuestions.length
      ? practiceQuestions.map((item) => ({ question: item.question, answer: answersByQuestion.get(item.questionId) }))
      : attempt.answers.map((answer) => ({ question: answer.question, answer }));
    return questionSources.map(({ question, answer }) => ({
      topicId: question.topicId,
      topicName: question.topic.name,
      difficulty: question.difficulty,
      answer: answer?.answer ?? null,
      isCorrect: answer?.isCorrect === true,
      attemptId: attempt.id,
    }));
  };
  const questionRowsByAttempt = attempts.map(buildQuestionRows);
  const questionMatchesFilters = (row: HistoryQuestionRow) =>
    (!difficulty || row.difficulty === difficulty) &&
    (!topicId || row.topicId === topicId);
  const matchingQuestionRows = questionRowsByAttempt.map((rows) => rows.filter(questionMatchesFilters));
  const scoredAttempts = attempts.map((a, index) => {
    const rows = matchingQuestionRows[index] ?? [];
    const score = summarizeAllQuestionAnswers(rows);
    return { attempt: a, correct: score.correct, total: score.total, pct: score.percent, elapsedTime: a.totalTime ?? 0 };
  });
  const visibleAttempts = scoredAttempts;
  const attemptDetailById = new Map(scoredAttempts.map(({ attempt }) => [attempt.id, attempt]));
  const progressRows = matchingQuestionRows.flatMap((rows) => rows.map((row) => {
    const attempt = attemptDetailById.get(row.attemptId);
    return {
      topic: row.topicName,
      difficulty: row.difficulty,
      correct: row.isCorrect,
      attemptId: row.attemptId,
      attemptLabel: attempt?.assignment?.practiceSet.name ? shortSetName(attempt.assignment.practiceSet.name) : "Practice set",
      submittedAt: attempt?.submittedAt ?? null,
    };
  }));
  const difficultyMetrics = aggregateDifficultyMetrics(progressRows);
  const topicDifficultyMetrics = aggregateTopicDifficultyMetrics(progressRows);

  // Headline accuracy is question-weighted over the filtered rows, so it reflects the selection.
  const totalQuestions = progressRows.length;
  const correctQuestions = progressRows.filter((row) => row.correct).length;
  const avgPct = totalQuestions > 0 ? Math.round((correctQuestions / totalQuestions) * 100) : null;

  // Build a per-attempt trend only after both topic and difficulty filters are selected.
  const trendAttemptIds = new Set(progressRows.map((row) => row.attemptId));
  const trendAttempts = [...scoredAttempts]
    .filter(({ attempt: a }) => trendAttemptIds.has(a.id))
    .map(({ attempt: a }) => ({
      id: a.id,
      label: a.assignment?.practiceSet.name ? shortSetName(a.assignment.practiceSet.name) : "Practice set",
      submittedAt: a.submittedAt,
    }));
  const topicTrend = aggregateTopicDifficultyTrend(
    progressRows.map((row) => ({ topic: row.topic, difficulty: row.difficulty, correct: row.correct, attemptId: row.attemptId })),
    trendAttempts,
  );
  const trendTopics = Object.keys(topicTrend);

  // History list: every submitted or invalidated attempt, scored the same way, newest first.
  const scoreForHistory = (a: (typeof historyAttempts)[number]) => {
    const score = summarizeAllQuestionAnswers(buildQuestionRows(a).filter(questionMatchesFilters));
    return { attempt: a, correct: score.correct, total: score.total, pct: score.percent, elapsedTime: a.totalTime ?? 0 };
  };
  const scoredById = new Map(scoredAttempts.map((entry) => [entry.attempt.id, entry]));
  const listedAttempts = historyAttempts.map((a) => scoredById.get(a.id) ?? scoreForHistory(a));
  const latestSubmitted = scoredAttempts[0] ?? null;
  const historyPage = paginate(listedAttempts, requestedPage, HISTORY_PAGE_SIZE);
  const historyRows = historyPage.items.map(({ attempt: a, correct, total, pct, elapsedTime }) => {
    const ps = a.assignment?.practiceSet;
    const areaLabel = ps
      ? practiceSetAreaLabel(
          classifyPracticeSetArea({
            practiceArea: ps.topic.domain.practiceArea,
            sectionName: ps.topic.domain.section.name,
          }),
        )
      : null;

    return { a, correct, total, pct, elapsedTime, ps, areaLabel };
  });

  // Skill × difficulty matrix: every finished attempt of the area (not narrowed by the skill/level
  // filter), so it stays a map to click through; the selected cell is highlighted.
  const matrixBuckets = new Map<string, { right: number; total: number; attempts: Set<string> }>();
  for (const row of questionRowsByAttempt.flat()) {
    const key = `${row.topicId}|${row.difficulty}`;
    const bucket = matrixBuckets.get(key) ?? { right: 0, total: 0, attempts: new Set<string>() };
    bucket.total += 1;
    if (row.isCorrect) bucket.right += 1;
    bucket.attempts.add(row.attemptId);
    matrixBuckets.set(key, bucket);
  }
  const officialTopics = topics.filter((topic) => isOfficialSkill(topic.id)).sort(compareSkills);
  const matrixRows = officialTopics
    .filter((topic) => DIFFICULTIES.some((d) => matrixBuckets.has(`${topic.id}|${d}`)))
    .map((topic) => ({
      id: topic.id,
      label: topic.name,
      cells: Object.fromEntries(
        DIFFICULTIES.map((d) => {
          const b = matrixBuckets.get(`${topic.id}|${d}`);
          return [
            d,
            b
              ? {
                  pct: Math.round((b.right / b.total) * 100),
                  right: b.right,
                  total: b.total,
                  tries: b.attempts.size,
                  href: `${buildProgressHref("/student/history", filters, { topic: topic.id, difficulty: d })}#history`,
                }
              : null,
          ];
        }),
      ),
    }));
  const timePracticing = scoredAttempts.reduce((sum, entry) => sum + entry.elapsedTime, 0);
  const setsPracticed = new Set(attempts.map((a) => a.practiceSetId)).size;
  // "Try n of m" and the Best badge per assignment (submitted + invalidated tries).
  const triesByAssignment = new Map<string, number>();
  for (const a of historyAttempts) if (a.assignmentId) triesByAssignment.set(a.assignmentId, (triesByAssignment.get(a.assignmentId) ?? 0) + 1);
  const bestByAssignment = new Map<string, { id: string; pct: number }>();
  for (const entry of scoredAttempts) {
    const key = entry.attempt.assignmentId;
    if (!key || entry.pct === null) continue;
    const prev = bestByAssignment.get(key);
    if (!prev || entry.pct > prev.pct) bestByAssignment.set(key, { id: entry.attempt.id, pct: entry.pct });
  }
  const breakdownOf = (a: (typeof historyAttempts)[number]) => {
    const rows = buildQuestionRows(a).filter(questionMatchesFilters);
    return { wrong: rows.filter((r) => r.answer && !r.isCorrect).length, blank: rows.filter((r) => !r.answer).length };
  };

  return (
    <PageShell width="wide" density="compact" className="space-y-4">
      <Breadcrumbs items={[{ label: "Home", href: "/student" }, { label: "History", href: "/student/history" }, { label: `Practice · ${practiceAreaLabel(practiceArea)}` }]} />
      <header className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">My history</h1>
          <p className="mt-0.5 text-sm text-gray-500">Review your {practiceAreaLabel(practiceArea).toLowerCase()} practice and find your next focus area.</p>
        </div>
        <p className="text-xs text-gray-500">{visibleAttempts.length} finished set{visibleAttempts.length === 1 ? "" : "s"}</p>
      </header>
      {historyTabs}
      <ProgressFilters
        action="/student/history"
        filters={filters}
        topics={officialTopics.map((topic) => ({ id: topic.id, name: topic.name, group: topic.domain.name }))}
        showEndDate={showEndDate}
      />

      {listedAttempts.length === 0 ? (
        <Card padding="lg" className="py-14 text-center text-gray-500">
          <p>No finished {practiceAreaLabel(practiceArea).toLowerCase()} practice sets for these filters.</p>
          <Link href={buildProgressHref("/student/practice", filters)} className="mt-2 inline-block text-sm text-blue-600 hover:underline">
            Go to the content map →
          </Link>
        </Card>
      ) : (
        <div className="space-y-4">
          {/* Row 1 — key stats (full width) */}
          <StatGrid cols={4}>
            <StatTile
              label="Average score"
              value={<Pct value={avgPct} />}
              sub={<>{correctQuestions} correct of {totalQuestions} questions{difficulty ? ` · ${difficultyLabel(difficulty)}` : ""}</>}
            />
            <StatTile label="Completed" value={visibleAttempts.length} sub={`attempt${visibleAttempts.length === 1 ? "" : "s"} on ${setsPracticed} practice set${setsPracticed === 1 ? "" : "s"}`} />
            <StatTile
              label="Latest score"
              value={!latestSubmitted ? "—" : latestSubmitted.pct === null ? "No answers" : <Pct value={latestSubmitted.pct} />}
              sub={latestSubmitted ? "Your last finished set · open ›" : "No finished set yet"}
              href={latestSubmitted ? buildProgressHref(`/student/results/${latestSubmitted.attempt.id}`, filters) : undefined}
            />
            <StatTile label="Time practicing" value={formatDuration(timePracticing)} sub="on finished sets" />
          </StatGrid>

          <section>
            <SectionHeader
              title="Performance by skill and difficulty"
              description="% correct · click a cell to see only that skill and level"
              action={topicId || difficulty ? <Link href={buildProgressHref("/student/history", { ...filters, topic: undefined, difficulty: undefined })} className="text-xs text-blue-600 hover:underline">Clear skill and level</Link> : undefined}
            />
            <SkillDifficultyMatrix rows={matrixRows} selected={{ skill: topicId, difficulty }} emptyText="No finished practice in this area yet." />
          </section>

          <PerformanceBreakdown
            title="Details by skill and difficulty"
            rowLabel="Skill"
            dimensionLabel="difficulty"
            dimensions={difficulty ? [difficulty] : ["EASY", "MEDIUM", "HARD"]}
            summaryMetrics={difficultyMetrics}
            detailMetrics={topicDifficultyMetrics}
          />

          {/* Row 4 — progression by difficulty over time (full width) */}
          {topicId && difficulty && trendTopics.length > 0 && trendAttempts.length > 0 && (
            <TopicDifficultyTrend
              topics={trendTopics}
              pointsByTopic={topicTrend}
              selectedTopic={topics.find((topic) => topic.id === topicId)?.name ?? trendTopics[0]}
              selectedDifficulty={difficulty}
            />
          )}

          <section id="history" aria-labelledby="history-results-heading" className="scroll-mt-6">
            <SectionHeader title={<span id="history-results-heading">Practice history</span>} description="Click a row to see each question again." />

            <div className="hidden md:block">
              <SimpleTable head={["Completed", "Practice set", "Attempt", "Score", "Time", ""]}>
                {historyRows.map(({ a, correct, total, pct, elapsedTime, ps, areaLabel }) => {
                  const of = a.assignmentId ? triesByAssignment.get(a.assignmentId) ?? 1 : 1;
                  const isBest = of > 1 && a.assignmentId ? bestByAssignment.get(a.assignmentId)?.id === a.id : false;
                  const { wrong, blank } = breakdownOf(a);
                  return (
                    <LinkTr key={a.id} className={invalidatedRowClass(a.status)}>
                      <td className={`${TD} whitespace-nowrap text-gray-600`}>
                        {a.submittedAt ? (
                          <>
                            {formatDate(a.submittedAt)} <span className="text-xs text-gray-400">{formatClock(a.submittedAt)}</span>
                            <span className="block text-xs text-gray-400">{relativeDay(a.submittedAt)}</span>
                          </>
                        ) : "—"}
                      </td>
                      <td className={TD}>
                        <span className="flex flex-wrap items-center gap-2">
                          <RowLink href={buildProgressHref(`/student/results/${a.id}`, filters)}>{ps?.topic.name ?? (ps?.name ? shortSetName(ps.name) : "—")}</RowLink>
                          {ps?.difficulty ? <Badge variant={difficultyBadgeVariant(ps.difficulty)}>{difficultyLabel(ps.difficulty)}</Badge> : null}
                          {isInvalidated(a.status) ? <AttemptStatusBadge status={a.status} /> : null}
                        </span>
                        <span className="block text-xs text-gray-500">{areaLabel ?? "—"}{ps?.topic.domain.name ? ` · ${ps.topic.domain.name}` : ""}</span>
                      </td>
                      <td className={`${TD} whitespace-nowrap`}>
                        Try {a.attemptNumber} of {Math.max(of, a.attemptNumber)}
                        {isBest ? <Badge variant="success" className="ml-2">Best</Badge> : null}
                      </td>
                      <td className={TD}>
                        <VoidableValue status={a.status}>
                          <span className="font-medium text-gray-900">{correct} of {total}</span>{" "}
                          <span className={`text-xs font-semibold ${isInvalidated(a.status) ? "" : scoreBandTextClass(pct)}`}>· {pct}%</span>
                        </VoidableValue>
                        <span className="block text-xs text-gray-500">{wrong} wrong · {blank} blank</span>
                      </td>
                      <td className={`${TD} text-gray-600`}>{formatDuration(elapsedTime)}</td>
                      <ChevronCell />
                    </LinkTr>
                  );
                })}
              </SimpleTable>
              <Pagination basePath="/student/history" params={pageParams} pageSize={HISTORY_PAGE_SIZE} anchor="history" {...historyPage} />
            </div>

            <div className="space-y-2 md:hidden">
              {historyRows.map(({ a, correct, total, pct, elapsedTime, ps, areaLabel }) => (
                <Card key={a.id} padding="sm" className={invalidatedRowClass(a.status)}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-gray-900">{ps?.name ? shortSetName(ps.name) : "—"}</p>
                      {isInvalidated(a.status) ? <AttemptStatusBadge status={a.status} /> : null}
                      <p className="mt-0.5 truncate text-xs text-gray-500">
                        {areaLabel ?? "—"}
                        {ps?.topic.name ? ` · ${ps.topic.name}` : ""}
                        {ps?.difficulty ? ` · ${difficultyLabel(ps.difficulty)}` : ""}
                      </p>
                    </div>
                    <VoidableValue status={a.status} className={`shrink-0 text-sm font-semibold ${isInvalidated(a.status) ? "" : scoreBandTextClass(pct)}`}>{pct === null ? "No answers" : `${pct}%`}</VoidableValue>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-gray-100 pt-2 text-xs text-gray-500">
                    <span>{a.submittedAt ? formatDate(a.submittedAt) : "—"}</span>
                    <span>{correct} of {total} correct · {formatDuration(elapsedTime)}</span>
                    <Badge variant="default">Try {a.attemptNumber}</Badge>
                    <Link href={buildProgressHref(`/student/results/${a.id}`, filters)} className="font-medium text-blue-600 hover:underline">Review</Link>
                  </div>
                </Card>
              ))}
              <Pagination basePath="/student/history" params={pageParams} pageSize={HISTORY_PAGE_SIZE} {...historyPage} />
            </div>
          </section>
        </div>
      )}
    </PageShell>
  );
}
