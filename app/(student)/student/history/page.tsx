import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import Link from "next/link";
import { formatDate, formatTime, scorePercent } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

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
  const effectiveSectionIds = sectionId ? [sectionId] : areaSectionIds;
  const topicId = params.topic || "";
  const difficulty = params.difficulty || "";
  const fromDate = parseDateParam(params.from);
  const toDate = parseDateParam(params.to, true);

  const practiceSetFilter = {
    ...(effectiveSectionIds.length ? { topic: { domain: { sectionId: { in: effectiveSectionIds } } } } : {}),
    ...(topicId ? { topicId } : {}),
    ...(difficulty ? { difficulty } : {}),
  };
  const hasPracticeSetFilter = effectiveSectionIds.length || topicId || difficulty;

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
      where: sectionId ? { domain: { sectionId } } : { domain: { sectionId: { in: effectiveSectionIds } } },
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

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
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
            {sections.map((section) => (
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
            <option value="EASY">Easy</option>
            <option value="MEDIUM">Medium</option>
            <option value="HARD">Hard</option>
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
          <div className="col-span-2">
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
                  {attempts.map((a) => {
                    const correct = a.answers.filter((ans) => ans.isCorrect).length;
                    const total = a.answers.length;
                    const pct = scorePercent(correct, total);
                    const ps = a.assignment?.practiceSet;
                    return (
                      <tr key={a.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                          {a.submittedAt ? formatDate(a.submittedAt) : "—"}
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-medium text-gray-900">{ps?.name ?? "—"}</p>
                          <p className="text-xs text-gray-400">
                            {ps?.topic.domain.section.label}
                            {ps?.topic.name ? ` · ${ps.topic.name}` : ""}
                            {ps?.difficulty ? ` · ${ps.difficulty}` : ""}
                          </p>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="font-medium text-gray-900">{correct}/{total}</span>
                          <span className={`ml-2 text-xs font-semibold ${pct >= 80 ? "text-green-600" : pct >= 60 ? "text-yellow-600" : "text-red-500"}`}>
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
                      <span className={`text-xs font-semibold ${avg >= 80 ? "text-green-600" : avg >= 60 ? "text-yellow-600" : "text-red-500"}`}>
                        {avg}%
                      </span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-gray-100">
                      <div
                        className={`h-full rounded-full ${avg >= 80 ? "bg-green-400" : avg >= 60 ? "bg-yellow-400" : "bg-red-400"}`}
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
    </div>
  );
}
