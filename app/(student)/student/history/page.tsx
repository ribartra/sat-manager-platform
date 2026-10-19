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

interface PageProps {
  searchParams: Promise<{
    area?: string;
    topic?: string;
    difficulty?: string;
    from?: string;
    to?: string;
    page?: string;
  }>;
}

const HISTORY_PAGE_SIZE = 20;
// Tabs in the mockup's order: Tests first, then practice by area. `area` keeps the old values.
const HISTORY_TABS = [
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

  const historyTabs = (
    <LinkTabs
      label="History"
      active={area}
      tabs={HISTORY_TABS.map((t) => ({
        key: t.key,
        label: t.label,
        href: buildAreaHref("/student/history", t.key, { difficulty: filters.difficulty, from: filters.from, to: filters.to }),
      }))}
    />
  );

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
            sectionLabel: ps.topic.domain.section.label,
            domainName: ps.topic.domain.name,
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

          <section id="history" aria-labelledby="history-results-heading" className="scroll-mt-20">
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
