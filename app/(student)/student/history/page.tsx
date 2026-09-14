import { PageShell } from "@/components/sat";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import Link from "next/link";
import { formatDate, formatTime, scorePercent } from "@/lib/utils";
import { scoreBandTextClass, scoreBandBarClass } from "@/lib/score-band";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { FULL_PRACTICE_TEST_DOMAIN_NAME } from "@/lib/taxonomy";
import { difficultyOptions } from "@/lib/domain-meta";
import { classifyPracticeSetArea, practiceSetAreaLabel, READING_DOMAINS, WRITING_DOMAINS } from "@/lib/parent-access";

interface PageProps {
  searchParams: Promise<{
    area?: string;
    section?: string;
    topic?: string;
    difficulty?: string;
    from?: string;
    to?: string;
  }>;
}

const AREA_TABS = [
  { key: "mathematics", label: "Mathematics" },
  { key: "reading", label: "Reading" },
  { key: "writing", label: "Writing" },
] as const;

function matchesArea(section: { name: string; label: string }, area: string) {
  const text = `${section.name} ${section.label}`.toLowerCase();
  if (area === "mathematics") return text.includes("math");
  if (area === "reading") return text.includes("reading");
  if (area === "writing") return text.includes("writing");
  return true;
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
  const requestedArea = AREA_TABS.some((tab) => tab.key === params.area) ? params.area! : "mathematics";
  const sections = await prisma.section.findMany({
    include: { domains: { include: { topics: { orderBy: { name: "asc" } } } } },
    orderBy: { label: "asc" },
  });
  const areaSectionIds = sections.filter((section) => matchesArea(section, requestedArea)).map((section) => section.id);
  const sectionId = params.section || "";
  const effectiveSectionIds = sectionId
    ? (areaSectionIds.includes(sectionId) ? [sectionId] : [])
    : areaSectionIds;
  const topicId = params.topic || "";
  const difficulty = params.difficulty || "";
  const fromDate = parseDateParam(params.from);
  const toDate = parseDateParam(params.to, true);

  const areaDomainNames = requestedArea === "reading"
    ? [...READING_DOMAINS]
    : requestedArea === "writing"
      ? [...WRITING_DOMAINS]
      : undefined;
  const topicDomainFilter = {
    ...(effectiveSectionIds.length ? { sectionId: { in: effectiveSectionIds } } : {}),
    ...(areaDomainNames ? { name: { in: areaDomainNames } } : {}),
  };
  const practiceSetFilter = {
    ...(sectionId || effectiveSectionIds.length || areaDomainNames ? { topic: { domain: topicDomainFilter } } : {}),
    ...(topicId ? { topicId } : {}),
    ...(difficulty ? { difficulty } : {}),
  };
  const hasPracticeSetFilter = sectionId || effectiveSectionIds.length || topicId || difficulty;

  const [attempts, topics] = await Promise.all([
    prisma.attempt.findMany({
      where: {
        studentId: userId,
        status: "SUBMITTED",
        ...(fromDate || toDate
          ? {
              submittedAt: {
                ...(fromDate ? { gte: fromDate } : {}),
                ...(toDate ? { lte: toDate } : {}),
              },
            }
          : {}),
        ...(hasPracticeSetFilter
          ? {
              assignment: {
                practiceSet: practiceSetFilter,
              },
            }
          : {}),
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
      where: {
        domain: {
          ...(sectionId ? { sectionId } : { sectionId: { in: effectiveSectionIds } }),
          ...(areaDomainNames ? { name: { in: areaDomainNames } } : { name: { not: FULL_PRACTICE_TEST_DOMAIN_NAME } }),
        },
      },
      include: { domain: { include: { section: true } } },
      orderBy: { name: "asc" },
    }),
  ]);

  // Aggregate progress by skill
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
      <h1 className="text-2xl font-semibold text-gray-900 mb-6">My History</h1>
      <div className="mb-5 flex gap-2 border-b border-gray-200">
        {AREA_TABS.map((tab) => (
          <Link
            key={tab.key}
            href={`/student/history?area=${tab.key}`}
            className={`border-b-2 px-3 py-2 text-sm font-medium ${
              requestedArea === tab.key
                ? "border-blue-600 text-blue-700"
                : "border-transparent text-gray-500 hover:text-gray-800"
            }`}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      <Card as="form" padding="md" className="mb-5 grid gap-3 md:grid-cols-5">
        <input type="hidden" name="area" value={requestedArea} />
        <label className="text-xs font-medium text-gray-600">
          Section
          <select name="section" defaultValue={sectionId} className="mt-1 w-full rounded-md border border-gray-300 px-2 py-2 text-sm text-gray-900">
            <option value="">All</option>
            {sections.filter((section) => areaSectionIds.includes(section.id)).map((section) => (
              <option key={section.id} value={section.id}>
                {section.label}
              </option>
            ))}
          </select>
        </label>
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
        <div className="flex items-center gap-2 md:col-span-5">
          <button type="submit" className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700">
            Apply filters
          </button>
          <Link href="/student/history" className="rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
            Clear
          </Link>
        </div>
      </Card>

      {attempts.length === 0 ? (
        <Card padding="lg" className="py-16 text-center text-gray-400">
          <p>No completed practice sets match the current filters.</p>
          <Link href="/student/content-map" className="mt-2 inline-block text-sm text-blue-600 hover:underline">
            Browse Content Map →
          </Link>
        </Card>
      ) : (
        <div className="grid grid-cols-3 gap-6">
          {/* Left: history table */}
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
                  <tr className="bg-gray-50 border-b border-gray-200">
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
                      ? practiceSetAreaLabel(classifyPracticeSetArea({
                          sectionName: ps.topic.domain.section.name,
                          sectionLabel: ps.topic.domain.section.label,
                          domainName: ps.topic.domain.name,
                        }))
                      : null;
                    return (
                      <tr key={a.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                          {a.submittedAt ? formatDate(a.submittedAt) : "—"}
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-medium text-gray-900">{ps?.name ?? "—"}</p>
                          <p className="text-xs text-gray-400">
                            {areaLabel ?? ps?.topic.domain.section.label ?? "—"}
                            {ps?.topic.name ? ` · ${ps.topic.name}` : ""}
                            {ps?.difficulty ? ` · ${ps.difficulty}` : ""}
                          </p>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="font-medium text-gray-900">{correct}/{total}</span>
                          <span className={`ml-2 text-xs font-semibold ${scoreBandTextClass(pct)}`}>
                            {pct}%
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right text-gray-500">
                          {a.totalTime ? formatTime(a.totalTime) : "—"}
                        </td>
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

          {/* Right: progress by skill */}
          <div>
            <h2 className="text-sm font-semibold text-gray-900 mb-3">Progress by Skill</h2>
            <div className="space-y-3">
              {Object.values(topicStats).map((ts) => {
                const avg = Math.round((ts.correct / ts.total) * 100);
                return (
                  <Card key={ts.name} padding="sm">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-gray-700 truncate">{ts.name}</span>
                      <span className={`text-xs font-semibold ${scoreBandTextClass(avg)}`}>
                        {avg}%
                      </span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-gray-100">
                      <div
                        className={`h-full rounded-full ${scoreBandBarClass(avg)}`}
                        style={{ width: `${avg}%` }}
                      />
                    </div>
                    <p className="text-xs text-gray-400 mt-1">{ts.count} set{ts.count !== 1 ? "s" : ""}</p>
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
