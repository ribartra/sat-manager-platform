import { AttemptStatusBadge, PageShell, Pagination, PracticeAreaTabs, VoidableValue, invalidatedRowClass, isInvalidated, pageFromParam, paginate } from "@/components/sat";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import Link from "next/link";
import { formatDate, formatDuration } from "@/lib/utils";
import { difficultyLabel } from "@/lib/domain-meta";
import { shortSetName } from "@/lib/student-report";
import { scoreBandTextClass } from "@/lib/score-band";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ProgressFilters } from "@/components/progress-filters";
import {
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

  if (area === "tests") {
    const examAttempts = await prisma.fullPracticeTestAttempt.findMany({
      where: {
        studentId: userId,
        status: { in: HISTORY_STATUSES },
        ...dateFilter,
      },
      include: { test: { select: { id: true, name: true } } },
      orderBy: [{ submittedAt: "desc" }, { startedAt: "desc" }],
    });
    const examPage = paginate(examAttempts, requestedPage, HISTORY_PAGE_SIZE);

    return (
      <PageShell width="wide" density="compact" className="space-y-4">
        <h1 className="text-2xl font-semibold text-gray-900">My history</h1>
        <PracticeAreaTabs basePath="/student/history" active={area} preserve={{ difficulty: filters.difficulty, from: filters.from, to: filters.to }} />
        <ProgressFilters action="/student/history" filters={filters} topics={[]} showEndDate={showEndDate} />

        <Card className="overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="px-4 py-3 text-left font-medium text-gray-500">Date</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Test</th>
                <th className="px-4 py-3 text-right font-medium text-gray-500">Reading &amp; Writing</th>
                <th className="px-4 py-3 text-right font-medium text-gray-500">Math</th>
                <th className="px-4 py-3 text-right font-medium text-gray-500">Total</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {examAttempts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-gray-500">
                    <p>No finished Full Practice Tests for these filters.</p>
                    <Link href={buildProgressHref("/student/content-map", filters)} className="mt-2 inline-block text-sm text-blue-600 hover:underline">
                      See your tests →
                    </Link>
                  </td>
                </tr>
              ) : (
                examPage.items.map((exam) => (
                  <tr key={exam.id} className={`hover:bg-gray-50 ${invalidatedRowClass(exam.status) ?? ""}`}>
                    <td className="whitespace-nowrap px-4 py-3 text-gray-500">
                      {exam.submittedAt ? formatDate(exam.submittedAt) : "—"}
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-900">
                      <span className="flex items-center gap-2">
                        {exam.test.name}
                        {isInvalidated(exam.status) ? <AttemptStatusBadge status={exam.status} /> : null}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700"><VoidableValue status={exam.status}>{exam.rwScore ?? "—"}</VoidableValue></td>
                    <td className="px-4 py-3 text-right text-gray-700"><VoidableValue status={exam.status}>{exam.mathScore ?? "—"}</VoidableValue></td>
                    <td className="px-4 py-3 text-right font-semibold text-[var(--sat-area-tests)]">
                      <VoidableValue status={exam.status}>{exam.totalScore ?? "—"}</VoidableValue>
                    </td>
                    <td className="px-4 py-3 text-right">
                    <Link href={buildProgressHref(`/student/full-tests/results/${exam.id}`, filters)} className="text-xs text-blue-600 hover:underline">
                        Review
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          <Pagination basePath="/student/history" params={pageParams} pageSize={HISTORY_PAGE_SIZE} {...examPage} className="border-t border-gray-100" />
        </Card>
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

  return (
    <PageShell width="wide" density="compact" className="space-y-4">
      <header className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">My history</h1>
          <p className="mt-0.5 text-sm text-gray-500">Review your {practiceAreaLabel(practiceArea).toLowerCase()} practice and find your next focus area.</p>
        </div>
        <p className="text-xs text-gray-500">{visibleAttempts.length} finished set{visibleAttempts.length === 1 ? "" : "s"}</p>
      </header>
        <PracticeAreaTabs
        basePath="/student/history"
        active={area}
        preserve={{ difficulty: filters.difficulty, from: filters.from, to: filters.to }}
      />
      <ProgressFilters
        action="/student/history"
        filters={filters}
        topics={topics.filter((topic) => isOfficialSkill(topic.id)).sort(compareSkills).map((topic) => ({ id: topic.id, name: topic.name, group: topic.domain.name }))}
        showEndDate={showEndDate}
      />

      {listedAttempts.length === 0 ? (
        <Card padding="lg" className="py-14 text-center text-gray-500">
          <p>No finished {practiceAreaLabel(practiceArea).toLowerCase()} practice sets for these filters.</p>
          <Link href={buildProgressHref("/student/content-map", filters)} className="mt-2 inline-block text-sm text-blue-600 hover:underline">
            Go to the content map →
          </Link>
        </Card>
      ) : (
        <div className="space-y-4">
          {/* Row 1 — key stats (full width) */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Card padding="sm">
              <p className="text-xs text-gray-500">Average score</p>
              <p className={`mt-1 text-2xl font-semibold ${scoreBandTextClass(avgPct)}`}>{avgPct !== null ? `${avgPct}%` : "—"}</p>
              <p className="mt-0.5 text-xs text-gray-500">
                {correctQuestions} correct of {totalQuestions} questions
                {difficulty ? ` · ${difficultyLabel(difficulty)}` : ""}
              </p>
            </Card>
            <Card padding="sm">
              <p className="text-xs text-gray-500">Completed</p>
                <p className="mt-1 text-2xl font-semibold text-gray-900">{visibleAttempts.length}</p>
                <p className="mt-0.5 text-xs text-gray-500">Practice set{visibleAttempts.length === 1 ? "" : "s"}</p>
            </Card>
            <Card padding="sm" className="col-span-2 sm:col-span-1">
              <p className="text-xs text-gray-500">Latest score</p>
              <p className={`mt-1 text-2xl font-semibold ${scoreBandTextClass(latestSubmitted?.pct ?? null)}`}>
                {!latestSubmitted ? "—" : latestSubmitted.pct === null ? "No answers" : `${latestSubmitted.pct}%`}
              </p>
              <p className="mt-0.5 text-xs text-gray-500">Your last finished set</p>
            </Card>
          </div>

          <PerformanceBreakdown
            title="Performance by skill and difficulty"
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

          <section aria-labelledby="history-results-heading">
            <div className="mb-3 flex items-end justify-between gap-3">
              <div>
                <h2 id="history-results-heading" className="text-sm font-semibold text-gray-900">Practice history</h2>
                <p className="mt-0.5 text-xs text-gray-500">Open any set to see each question again.</p>
              </div>
            </div>

            <div className="hidden overflow-hidden rounded-lg border border-gray-200 bg-white md:block">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[42rem] text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50">
                      <th className="px-4 py-3 text-left font-medium text-gray-500">Date</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-500">Practice set</th>
                      <th className="px-4 py-3 text-right font-medium text-gray-500">Score</th>
                      <th className="px-4 py-3 text-right font-medium text-gray-500">Time</th>
                      <th className="px-4 py-3 text-right font-medium text-gray-500">Try</th>
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {historyRows.map(({ a, correct, total, pct, elapsedTime, ps, areaLabel }) => (
                      <tr key={a.id} className={`hover:bg-gray-50 ${invalidatedRowClass(a.status) ?? ""}`}>
                        <td className="whitespace-nowrap px-4 py-3 text-gray-500">
                          {a.submittedAt ? formatDate(a.submittedAt) : "—"}
                        </td>
                        <td className="px-4 py-3">
                          <p className="flex items-center gap-2 font-medium text-gray-900">
                            {ps?.name ? shortSetName(ps.name) : "—"}
                            {isInvalidated(a.status) ? <AttemptStatusBadge status={a.status} /> : null}
                          </p>
                          <p className="text-xs text-gray-500">
                            {areaLabel ?? "—"}
                            {ps?.topic.name ? ` · ${ps.topic.name}` : ""}
                            {ps?.difficulty ? ` · ${difficultyLabel(ps.difficulty)}` : ""}
                          </p>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <VoidableValue status={a.status}>
                            <span className="font-medium text-gray-900">{correct} of {total} correct</span>
                            <span className={`ml-2 text-xs font-semibold ${isInvalidated(a.status) ? "" : scoreBandTextClass(pct)}`}>{pct}%</span>
                          </VoidableValue>
                        </td>
                        <td className="px-4 py-3 text-right text-gray-500">{formatDuration(elapsedTime)}</td>
                        <td className="px-4 py-3 text-right"><Badge variant="default">{a.attemptNumber}</Badge></td>
                        <td className="px-4 py-3 text-right">
                          <Link href={buildProgressHref(`/student/results/${a.id}`, filters)} className="text-xs text-blue-600 hover:underline">Review</Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pagination basePath="/student/history" params={pageParams} pageSize={HISTORY_PAGE_SIZE} {...historyPage} className="border-t border-gray-100" />
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
