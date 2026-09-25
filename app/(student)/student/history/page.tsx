import { PageShell, PracticeAreaTabs } from "@/components/sat";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import Link from "next/link";
import { formatDate, formatTime, scorePercent } from "@/lib/utils";
import { scoreBandTextClass, scoreBandBarClass } from "@/lib/score-band";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { difficultyOptions } from "@/lib/domain-meta";
import {
  activeAreaTab,
  practiceAreaFromTab,
  practiceAreaLabel,
  practiceAreaTopicWhere,
} from "@/lib/practice-area";
import { classifyPracticeSetArea, practiceSetAreaLabel } from "@/lib/parent-access";
import { DifficultyAccuracyChart, TopicDifficultyChart } from "@/components/progress-charts";
import { aggregateDifficultyMetrics, aggregateTopicDifficultyMetrics } from "@/lib/progress-analytics";

interface PageProps {
  searchParams: Promise<{
    area?: string;
    topic?: string;
    difficulty?: string;
    from?: string;
    to?: string;
  }>;
}

function parseDateParam(value?: string, endOfDay = false) {
  if (!value) return undefined;
  const date = new Date(`${value}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}`);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

export default async function StudentHistoryPage({ searchParams }: PageProps) {
  const session = await auth();
  const userId = session!.user.id;
  const params = await searchParams;
  const area = activeAreaTab(params.area, "math");
  const practiceArea = practiceAreaFromTab(area);
  const topicId = params.topic || "";
  const difficulty = params.difficulty || "";
  const fromDate = parseDateParam(params.from);
  const toDate = parseDateParam(params.to, true);
  const dateFilter =
    fromDate || toDate
      ? {
          submittedAt: {
            ...(fromDate ? { gte: fromDate } : {}),
            ...(toDate ? { lte: toDate } : {}),
          },
        }
      : {};

  if (area === "mocks") {
    const examAttempts = await prisma.fullPracticeTestAttempt.findMany({
      where: {
        studentId: userId,
        status: "SUBMITTED",
        ...dateFilter,
      },
      include: { test: { select: { id: true, name: true } } },
      orderBy: { submittedAt: "desc" },
    });

    return (
      <PageShell width="wide" density="compact" className="space-y-4">
        <h1 className="text-2xl font-semibold text-gray-900">My History</h1>
        <PracticeAreaTabs basePath="/student/history" active={area} />
        <Card as="form" padding="sm" className="grid gap-3 md:grid-cols-3">
          <input type="hidden" name="area" value={area} />
          <label className="text-xs font-medium text-gray-600">
            From
            <input name="from" type="date" defaultValue={params.from || ""} className="mt-1 w-full rounded-md border border-gray-300 px-2 py-2 text-sm text-gray-900" />
          </label>
          <label className="text-xs font-medium text-gray-600">
            To
            <input name="to" type="date" defaultValue={params.to || ""} className="mt-1 w-full rounded-md border border-gray-300 px-2 py-2 text-sm text-gray-900" />
          </label>
          <div className="flex items-end gap-2">
            <button type="submit" className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700">
              Apply filters
            </button>
            <Link href="/student/history?area=mocks" className="rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
              Clear
            </Link>
          </div>
        </Card>

        <Card className="overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="px-4 py-3 text-left font-medium text-gray-500">Date</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Exam</th>
                <th className="px-4 py-3 text-right font-medium text-gray-500">R&amp;W</th>
                <th className="px-4 py-3 text-right font-medium text-gray-500">Math</th>
                <th className="px-4 py-3 text-right font-medium text-gray-500">Total</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {examAttempts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-gray-500">
                    <p>No completed Full Practice Tests match the current filters.</p>
                    <Link href="/student/content-map?area=mocks" className="mt-2 inline-block text-sm text-blue-600 hover:underline">
                      View assigned exams →
                    </Link>
                  </td>
                </tr>
              ) : (
                examAttempts.map((exam) => (
                  <tr key={exam.id} className="hover:bg-gray-50">
                    <td className="whitespace-nowrap px-4 py-3 text-gray-500">
                      {exam.submittedAt ? formatDate(exam.submittedAt) : "—"}
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-900">{exam.test.name}</td>
                    <td className="px-4 py-3 text-right text-gray-700">{exam.rwScore ?? "—"}</td>
                    <td className="px-4 py-3 text-right text-gray-700">{exam.mathScore ?? "—"}</td>
                    <td className="px-4 py-3 text-right font-semibold text-[var(--sat-area-mocks)]">
                      {exam.totalScore ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link href={`/student/full-tests/results/${exam.id}`} className="text-xs text-blue-600 hover:underline">
                        Review
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </Card>
      </PageShell>
    );
  }

  const [attempts, topics] = await Promise.all([
    prisma.attempt.findMany({
      where: {
        studentId: userId,
        status: "SUBMITTED",
        ...dateFilter,
        assignment: {
          practiceSet: {
            ...(practiceArea ? { topic: { domain: { practiceArea } } } : {}),
            ...(topicId ? { topicId } : {}),
            ...(difficulty ? { difficulty } : {}),
          },
        },
      },
      include: {
        answers: { include: { question: { select: { difficulty: true, topic: { select: { name: true } } } } } },
        assignment: {
          include: {
            practiceSet: {
              include: { topic: { include: { domain: { include: { section: true } } } } },
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

  const topicStats: Record<string, { name: string; correct: number; total: number; count: number }> = {};
  attempts.forEach((a) => {
    const topic = a.assignment?.practiceSet.topic;
    if (!topic) return;
    if (!topicStats[topic.id]) topicStats[topic.id] = { name: topic.name, correct: 0, total: 0, count: 0 };
    const correct = a.answers.filter((ans) => ans.isCorrect).length;
    topicStats[topic.id].correct += correct;
    topicStats[topic.id].total += a.answers.length;
    topicStats[topic.id].count += 1;
  });

  const scoredAttempts = attempts.map((a) => {
    const correct = a.answers.filter((ans) => ans.isCorrect).length;
    const total = a.answers.length;
    const pct = typeof a.scorePercent === "number" ? a.scorePercent : scorePercent(correct, total);
    return { attempt: a, correct, total, pct };
  });

  const avgPct =
    scoredAttempts.length > 0
      ? Math.round(scoredAttempts.reduce((sum, row) => sum + row.pct, 0) / scoredAttempts.length)
      : null;

  const progressRows = attempts.flatMap((attempt) =>
    attempt.answers.map((answer) => ({
      topic: answer.question.topic.name,
      difficulty: answer.question.difficulty,
      correct: Boolean(answer.isCorrect),
      timeSeconds: answer.timeSpent ?? 0,
      attemptId: attempt.id,
    })),
  );
  const difficultyMetrics = aggregateDifficultyMetrics(progressRows);
  const topicDifficultyMetrics = aggregateTopicDifficultyMetrics(progressRows);

  const chronological = [...scoredAttempts].reverse();
  const pctSeries = chronological.map((row, index) => {
    const slice = chronological.slice(0, index + 1);
    const average = Math.round(slice.reduce((sum, item) => sum + item.pct, 0) / slice.length);
    return { at: row.attempt.submittedAt, score: row.pct, average };
  });

  const historyRows = scoredAttempts.map(({ attempt: a, correct, total, pct }) => {
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

    return { a, correct, total, pct, ps, areaLabel };
  });

  return (
    <PageShell width="wide" density="compact" className="space-y-4">
      <header className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">My History</h1>
          <p className="mt-0.5 text-sm text-gray-500">Review your {practiceAreaLabel(practiceArea).toLowerCase()} practice and find your next focus area.</p>
        </div>
        <p className="text-xs text-gray-500">{attempts.length} completed set{attempts.length === 1 ? "" : "s"}</p>
      </header>
      <PracticeAreaTabs basePath="/student/history" active={area} />

      <Card as="form" padding="sm" className="space-y-3">
        <input type="hidden" name="area" value={area} />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <label className="text-xs font-medium text-gray-600">
            Topic
            <select name="topic" defaultValue={topicId} className="mt-1 w-full rounded-md border border-gray-300 px-2 py-2 text-sm text-gray-900">
              <option value="">All topics</option>
              {topics.map((topic) => (
                <option key={topic.id} value={topic.id}>
                  {topic.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-medium text-gray-600">
            Difficulty
            <select name="difficulty" defaultValue={difficulty} className="mt-1 w-full rounded-md border border-gray-300 px-2 py-2 text-sm text-gray-900">
              <option value="">All levels</option>
              {difficultyOptions().map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-medium text-gray-600">
            From
            <input name="from" type="date" defaultValue={params.from || ""} className="mt-1 w-full rounded-md border border-gray-300 px-2 py-2 text-sm text-gray-900" />
          </label>
          <label className="text-xs font-medium text-gray-600">
            To
            <input name="to" type="date" defaultValue={params.to || ""} className="mt-1 w-full rounded-md border border-gray-300 px-2 py-2 text-sm text-gray-900" />
          </label>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="submit" className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700">
            Apply filters
          </button>
          <Link href={`/student/history?area=${area}`} className="rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
            Clear
          </Link>
          <span className="text-xs text-gray-500">Filters apply to submitted practice sets.</span>
        </div>
      </Card>

      {attempts.length === 0 ? (
        <Card padding="lg" className="py-14 text-center text-gray-500">
          <p>No completed {practiceAreaLabel(practiceArea).toLowerCase()} practice sets match the current filters.</p>
          <Link href="/student/content-map" className="mt-2 inline-block text-sm text-blue-600 hover:underline">
            Browse Content Map →
          </Link>
        </Card>
      ) : (
        <div className="space-y-4">
          {/* Row 1 — key stats (full width) */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Card padding="sm">
              <p className="text-xs text-gray-500">Average score</p>
              <p className={`mt-1 text-2xl font-semibold ${scoreBandTextClass(avgPct)}`}>{avgPct !== null ? `${avgPct}%` : "—"}</p>
              <p className="mt-0.5 text-xs text-gray-500">Across submitted sets</p>
            </Card>
            <Card padding="sm">
              <p className="text-xs text-gray-500">Completed</p>
              <p className="mt-1 text-2xl font-semibold text-gray-900">{scoredAttempts.length}</p>
              <p className="mt-0.5 text-xs text-gray-500">Practice set{scoredAttempts.length === 1 ? "" : "s"}</p>
            </Card>
            <Card padding="sm" className="col-span-2 sm:col-span-1">
              <p className="text-xs text-gray-500">Latest score</p>
              <p className={`mt-1 text-2xl font-semibold ${scoreBandTextClass(historyRows[0]?.pct ?? null)}`}>
                {historyRows[0] ? `${historyRows[0].pct}%` : "—"}
              </p>
              <p className="mt-0.5 text-xs text-gray-500">Most recent submission</p>
            </Card>
          </div>

          {/* Row 2 — average by difficulty + progress by skill */}
          <div className="grid gap-4 lg:grid-cols-2">
            <DifficultyAccuracyChart metrics={difficultyMetrics} area={area} />
            <section className="min-w-0 rounded-md border border-gray-200 bg-white p-4 shadow-sm">
              <div className="mb-4">
                <h2 className="text-sm font-semibold text-gray-900">Progress by skill</h2>
                <p className="mt-1 text-xs text-gray-500">Accuracy across your submitted answers</p>
              </div>
              <div className="grid max-h-80 gap-x-4 gap-y-3 overflow-y-auto pr-1 sm:grid-cols-2">
                {Object.values(topicStats).map((ts) => {
                  const avg = Math.round((ts.correct / ts.total) * 100);
                  return (
                    <div key={ts.name} className="min-w-0">
                      <div className="mb-1 flex items-center justify-between gap-2">
                        <span className="truncate text-xs font-medium text-gray-700" title={ts.name}>{ts.name}</span>
                        <span className={`shrink-0 text-xs font-semibold ${scoreBandTextClass(avg)}`}>{avg}%</span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-gray-100">
                        <div className={`h-full rounded-full ${scoreBandBarClass(avg)}`} style={{ width: `${avg}%` }} />
                      </div>
                      <p className="mt-1 text-xs text-gray-500">
                        {ts.count} attempt{ts.count !== 1 ? "s" : ""}
                      </p>
                    </div>
                  );
                })}
              </div>
            </section>
          </div>

          {/* Row 3 — progress by topic and difficulty (full width: tabular data needs room) */}
          <TopicDifficultyChart metrics={topicDifficultyMetrics} area={area} />

          {/* Row 4 — score over time (full width) */}
          {pctSeries.length > 1 && (
            <Card padding="sm">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm font-medium text-gray-900">Score over time</p>
                <p className="text-xs text-gray-500">Cumulative average · last {Math.min(pctSeries.length, 8)} submissions</p>
              </div>
              <ul className="mt-3 grid gap-x-4 gap-y-1 text-xs text-gray-600 sm:grid-cols-2 lg:grid-cols-4">
                {pctSeries.slice(-8).map((point, index) => (
                  <li key={`pct-${index}`} className="whitespace-nowrap">
                    {point.at ? formatDate(point.at) : "—"}: {point.score}% <span className="text-gray-500">→ avg {point.average}%</span>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <section aria-labelledby="history-results-heading">
            <div className="mb-3 flex items-end justify-between gap-3">
              <div>
                <h2 id="history-results-heading" className="text-sm font-semibold text-gray-900">Practice history</h2>
                <p className="mt-0.5 text-xs text-gray-500">Open any submission to review each question.</p>
              </div>
            </div>

            <div className="hidden overflow-hidden rounded-lg border border-gray-200 bg-white md:block">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[42rem] text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50">
                      <th className="px-4 py-3 text-left font-medium text-gray-500">Date</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-500">Practice Set</th>
                      <th className="px-4 py-3 text-right font-medium text-gray-500">Score</th>
                      <th className="px-4 py-3 text-right font-medium text-gray-500">Time</th>
                      <th className="px-4 py-3 text-right font-medium text-gray-500">#</th>
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {historyRows.map(({ a, correct, total, pct, ps, areaLabel }) => (
                      <tr key={a.id} className="hover:bg-gray-50">
                        <td className="whitespace-nowrap px-4 py-3 text-gray-500">
                          {a.submittedAt ? formatDate(a.submittedAt) : "—"}
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-medium text-gray-900">{ps?.name ?? "—"}</p>
                          <p className="text-xs text-gray-500">
                            {areaLabel ?? "—"}
                            {ps?.topic.name ? ` · ${ps.topic.name}` : ""}
                            {ps?.difficulty ? ` · ${ps.difficulty}` : ""}
                          </p>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="font-medium text-gray-900">{correct}/{total}</span>
                          <span className={`ml-2 text-xs font-semibold ${scoreBandTextClass(pct)}`}>{pct}%</span>
                        </td>
                        <td className="px-4 py-3 text-right text-gray-500">{a.totalTime ? formatTime(a.totalTime) : "—"}</td>
                        <td className="px-4 py-3 text-right"><Badge variant="default">#{a.attemptNumber}</Badge></td>
                        <td className="px-4 py-3 text-right">
                          <Link href={`/student/results/${a.id}`} className="text-xs text-blue-600 hover:underline">Review</Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="space-y-2 md:hidden">
              {historyRows.map(({ a, correct, total, pct, ps, areaLabel }) => (
                <Card key={a.id} padding="sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-gray-900">{ps?.name ?? "—"}</p>
                      <p className="mt-0.5 truncate text-xs text-gray-500">
                        {areaLabel ?? "—"}
                        {ps?.topic.name ? ` · ${ps.topic.name}` : ""}
                        {ps?.difficulty ? ` · ${ps.difficulty}` : ""}
                      </p>
                    </div>
                    <span className={`shrink-0 text-sm font-semibold ${scoreBandTextClass(pct)}`}>{pct}%</span>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-gray-100 pt-2 text-xs text-gray-500">
                    <span>{a.submittedAt ? formatDate(a.submittedAt) : "—"}</span>
                    <span>{correct}/{total} correct · {a.totalTime ? formatTime(a.totalTime) : "—"}</span>
                    <Badge variant="default">#{a.attemptNumber}</Badge>
                    <Link href={`/student/results/${a.id}`} className="font-medium text-blue-600 hover:underline">Review</Link>
                  </div>
                </Card>
              ))}
            </div>
          </section>
        </div>
      )}
    </PageShell>
  );
}
