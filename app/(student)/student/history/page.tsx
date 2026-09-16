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
      <PageShell>
        <h1 className="mb-6 text-2xl font-semibold text-gray-900">My History</h1>
        <PracticeAreaTabs basePath="/student/history" active={area} />
        <Card as="form" padding="md" className="mb-5 grid gap-3 md:grid-cols-3">
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

        {examAttempts.length === 0 ? (
          <Card padding="lg" className="py-16 text-center text-gray-400">
            <p>No completed Full Practice Tests match the current filters.</p>
            <Link href="/student/full-tests" className="mt-2 inline-block text-sm text-blue-600 hover:underline">
              View assigned exams →
            </Link>
          </Card>
        ) : (
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
                {examAttempts.map((exam) => (
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
                ))}
              </tbody>
            </table>
          </Card>
        )}
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
        answers: true,
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

  const chronological = [...scoredAttempts].reverse();
  const pctSeries = chronological.map((row, index) => {
    const slice = chronological.slice(0, index + 1);
    const average = Math.round(slice.reduce((sum, item) => sum + item.pct, 0) / slice.length);
    return { at: row.attempt.submittedAt, score: row.pct, average };
  });

  return (
    <PageShell>
      <h1 className="mb-6 text-2xl font-semibold text-gray-900">My History</h1>
      <PracticeAreaTabs basePath="/student/history" active={area} />

      <Card as="form" padding="md" className="mb-5 grid gap-3 md:grid-cols-4">
        <input type="hidden" name="area" value={area} />
        <label className="text-xs font-medium text-gray-600">
          Topic
          <select name="topic" defaultValue={topicId} className="mt-1 w-full rounded-md border border-gray-300 px-2 py-2 text-sm text-gray-900">
            <option value="">All</option>
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
            <option value="">All</option>
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
        <div className="flex items-center gap-2 md:col-span-4">
          <button type="submit" className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700">
            Apply filters
          </button>
          <Link href={`/student/history?area=${area}`} className="rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
            Clear
          </Link>
        </div>
      </Card>

      {attempts.length === 0 ? (
        <Card padding="lg" className="py-16 text-center text-gray-400">
          <p>No completed {practiceAreaLabel(practiceArea).toLowerCase()} practice sets match the current filters.</p>
          <Link href="/student/content-map" className="mt-2 inline-block text-sm text-blue-600 hover:underline">
            Browse Content Map →
          </Link>
        </Card>
      ) : (
        <div className="grid grid-cols-3 gap-6">
          <div className="col-span-2 space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Card padding="md">
                <p className="text-xs text-gray-500">Average %</p>
                <p className={`text-2xl font-semibold ${scoreBandTextClass(avgPct)}`}>{avgPct !== null ? `${avgPct}%` : "—"}</p>
                <p className="text-xs text-gray-400">{scoredAttempts.length} attempt{scoredAttempts.length === 1 ? "" : "s"}</p>
              </Card>
            </div>
            {pctSeries.length > 1 && (
              <Card padding="md">
                <p className="mb-2 text-sm font-medium text-gray-900">Score over time (cumulative average %)</p>
                <ul className="space-y-0.5 text-xs text-gray-600">
                  {pctSeries.slice(-8).map((point, index) => (
                    <li key={`pct-${index}`}>
                      {point.at ? formatDate(point.at) : "—"}: {point.score}% → avg {point.average}%
                    </li>
                  ))}
                </ul>
              </Card>
            )}
            <Card className="overflow-hidden">
              <table className="w-full text-sm">
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
                  {scoredAttempts.map(({ attempt: a, correct, total, pct }) => {
                    const ps = a.assignment?.practiceSet;
                    const areaLabel = ps
                      ? practiceSetAreaLabel(
                          classifyPracticeSetArea({
                            practiceArea: ps.topic.domain.practiceArea,
                            sectionName: ps.topic.domain.section.name,
                            sectionLabel: ps.topic.domain.section.label,
                            domainName: ps.topic.domain.name,
                          })
                        )
                      : null;
                    return (
                      <tr key={a.id} className="hover:bg-gray-50">
                        <td className="whitespace-nowrap px-4 py-3 text-gray-500">
                          {a.submittedAt ? formatDate(a.submittedAt) : "—"}
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-medium text-gray-900">{ps?.name ?? "—"}</p>
                          <p className="text-xs text-gray-400">
                            {areaLabel ?? "—"}
                            {ps?.topic.name ? ` · ${ps.topic.name}` : ""}
                            {ps?.difficulty ? ` · ${ps.difficulty}` : ""}
                          </p>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="font-medium text-gray-900">
                            {correct}/{total}
                          </span>
                          <span className={`ml-2 text-xs font-semibold ${scoreBandTextClass(pct)}`}>{pct}%</span>
                        </td>
                        <td className="px-4 py-3 text-right text-gray-500">{a.totalTime ? formatTime(a.totalTime) : "—"}</td>
                        <td className="px-4 py-3 text-right">
                          <Badge variant="default">#{a.attemptNumber}</Badge>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Link href={`/student/results/${a.id}`} className="text-xs text-blue-600 hover:underline">
                            Review
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </Card>
          </div>

          <div>
            <h2 className="mb-3 text-sm font-semibold text-gray-900">Progress by Skill</h2>
            <div className="space-y-3">
              {Object.values(topicStats).map((ts) => {
                const avg = Math.round((ts.correct / ts.total) * 100);
                return (
                  <Card key={ts.name} padding="sm">
                    <div className="mb-1 flex items-center justify-between">
                      <span className="truncate text-xs font-medium text-gray-700">{ts.name}</span>
                      <span className={`text-xs font-semibold ${scoreBandTextClass(avg)}`}>{avg}%</span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-gray-100">
                      <div className={`h-full rounded-full ${scoreBandBarClass(avg)}`} style={{ width: `${avg}%` }} />
                    </div>
                    <p className="mt-1 text-xs text-gray-400">
                      {ts.count} attempt{ts.count !== 1 ? "s" : ""}
                    </p>
                  </Card>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </PageShell>
  );
}
