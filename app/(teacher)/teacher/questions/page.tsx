import prisma from "@/lib/prisma";
import Link from "next/link";
import { Plus, Pencil } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { MathContent } from "@/components/math-content";

interface SearchParams { topic?: string; difficulty?: string; status?: string }

export default async function QuestionBankPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const filters = await searchParams;

  const questions = await prisma.question.findMany({
    where: {
      topicId: filters.topic || undefined,
      difficulty: (filters.difficulty as string | undefined) || undefined,
      status: (filters.status as string | undefined) || undefined,
    },
    include: {
      topic: { include: { domain: { include: { section: true } } } },
      setItems: { select: { practiceSetId: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  const topics = await prisma.topic.findMany({
    include: { domain: { include: { section: true } } },
    orderBy: { name: "asc" },
  });

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Question Bank</h1>
        <div className="flex items-center gap-2">
          <Link href="/admin/import" className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
            Bulk Import
          </Link>
          <Link
            href="/teacher/questions/new"
            className="flex items-center gap-1.5 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            <Plus size={14} /> New Question
          </Link>
        </div>
      </div>

      {/* Filters */}
      <form className="flex items-center gap-3 mb-5">
        <select name="topic" defaultValue={filters.topic ?? ""} className="rounded-md border border-gray-300 px-3 py-1.5 text-sm">
          <option value="">All topics</option>
          {topics.map((t) => (
            <option key={t.id} value={t.id}>{t.domain.section.label} / {t.name}</option>
          ))}
        </select>
        <select name="difficulty" defaultValue={filters.difficulty ?? ""} className="rounded-md border border-gray-300 px-3 py-1.5 text-sm">
          <option value="">All difficulties</option>
          <option value="EASY">Easy</option>
          <option value="MEDIUM">Medium</option>
          <option value="HARD">Hard</option>
        </select>
        <select name="status" defaultValue={filters.status ?? ""} className="rounded-md border border-gray-300 px-3 py-1.5 text-sm">
          <option value="">All statuses</option>
          <option value="PUBLISHED">Published</option>
          <option value="DRAFT">Draft</option>
          <option value="ARCHIVED">Archived</option>
        </select>
        <button type="submit" className="rounded-md bg-gray-100 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-200">
          Filter
        </button>
      </form>

      <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="px-4 py-3 text-left font-medium text-gray-500">Question</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">Topic</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">Difficulty</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">Type</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">Status</th>
              <th className="px-4 py-3 text-right font-medium text-gray-500">Used in</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {questions.map((q) => (
              <tr key={q.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 max-w-xs">
                  <MathContent content={q.stem} className="line-clamp-2 text-sm text-gray-800" />
                </td>
                <td className="px-4 py-3">
                  <p className="text-xs text-gray-500">{q.topic.domain.section.label}</p>
                  <p className="text-sm text-gray-700">{q.topic.name}</p>
                </td>
                <td className="px-4 py-3">
                  <Badge variant={q.difficulty === "EASY" ? "easy" : q.difficulty === "MEDIUM" ? "medium" : "hard"}>
                    {q.difficulty}
                  </Badge>
                </td>
                <td className="px-4 py-3">
                  <Badge variant="default">{q.type}</Badge>
                </td>
                <td className="px-4 py-3">
                  <Badge variant={q.status === "PUBLISHED" ? "success" : q.status === "DRAFT" ? "warning" : "default"}>
                    {q.status}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-right text-gray-500">
                  {new Set(q.setItems.map((s) => s.practiceSetId)).size} sets
                </td>
                <td className="px-4 py-3 text-right">
                  <Link href={`/teacher/questions/${q.id}/edit`} className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline">
                    <Pencil size={12} /> Edit
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {questions.length === 0 && (
          <div className="text-center py-12 text-gray-400">
            <p>No questions found. Create your first one.</p>
          </div>
        )}
      </div>
    </div>
  );
}
