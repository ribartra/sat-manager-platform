import prisma from "@/lib/prisma";
import Link from "next/link";
import { Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { MathContent } from "@/components/math-content";
import { QuestionActions } from "./question-actions-client";
import { cn } from "@/lib/utils";
import { activeTaxonomySection, buildTaxonomyTree, matchesTaxonomySection, taxonomyPathLabel, TAXONOMY_SECTION_TABS } from "@/lib/taxonomy";

interface SearchParams { section?: string; topic?: string; difficulty?: string; status?: string }

function tabHref(section: string, filters: SearchParams) {
  const params = new URLSearchParams();
  params.set("section", section);
  if (filters.difficulty) params.set("difficulty", filters.difficulty);
  if (filters.status) params.set("status", filters.status);
  return `/teacher/questions?${params.toString()}`;
}

export default async function QuestionBankPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const filters = await searchParams;
  const activeSection = activeTaxonomySection(filters.section);

  const [taxonomyNodes, topics] = await Promise.all([
    prisma.taxonomyNode.findMany({ where: { active: true }, orderBy: [{ sortOrder: "asc" }, { label: "asc" }] }),
    prisma.topic.findMany({
      include: { taxonomyNode: true, domain: { include: { section: true } } },
      orderBy: { name: "asc" },
    }),
  ]);
  const { roots, byId } = buildTaxonomyTree(taxonomyNodes);
  const rootByNodeId = new Map<string, (typeof roots)[number]>();
  for (const node of byId.values()) {
    let current = node;
    while (current.parentId && byId.has(current.parentId)) current = byId.get(current.parentId)!;
    rootByNodeId.set(node.id, current);
  }
  const visibleTopics = topics.filter((topic) => {
    if (topic.taxonomyNodeId) {
      const root = rootByNodeId.get(topic.taxonomyNodeId);
      if (root) return matchesTaxonomySection(root, activeSection);
    }
    return matchesTaxonomySection(topic.domain.section, activeSection);
  });
  const visibleTopicIds = new Set(visibleTopics.map((topic) => topic.id));
  const selectedTopicId = filters.topic && visibleTopicIds.has(filters.topic) ? filters.topic : undefined;

  const questions = await prisma.question.findMany({
    where: {
      topicId: selectedTopicId || { in: [...visibleTopicIds] },
      difficulty: (filters.difficulty as string | undefined) || undefined,
      status: (filters.status as string | undefined) || undefined,
    },
    include: {
      topic: { include: { domain: { include: { section: true } } } },
      subskill: true,
      setItems: { select: { practiceSetId: true } },
      fullTestItems: { select: { moduleId: true } },
      answers: { select: { id: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
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

      <div className="mb-5 flex gap-2 border-b border-gray-200">
        {TAXONOMY_SECTION_TABS.map((tab) => (
          <Link
            key={tab.key}
            href={tabHref(tab.key, filters)}
            className={cn(
              "border-b-2 px-3 py-2 text-sm font-medium",
              activeSection === tab.key
                ? "border-blue-600 text-blue-700"
                : "border-transparent text-gray-500 hover:text-gray-800"
            )}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      {/* Filters */}
      <form className="flex items-center gap-3 mb-5">
        <input type="hidden" name="section" value={activeSection} />
        <select name="topic" defaultValue={selectedTopicId ?? ""} className="rounded-md border border-gray-300 px-3 py-1.5 text-sm">
          <option value="">All skills</option>
          {visibleTopics.map((t) => (
            <option key={t.id} value={t.id}>
              {taxonomyPathLabel(t.taxonomyNodeId, byId, `${t.domain.section.label} / ${t.domain.name} / ${t.name}`)}
            </option>
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

      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="px-4 py-3 text-left font-medium text-gray-500">Question</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">Skill / Subskill</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">Difficulty</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">Type</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">Status</th>
              <th className="px-4 py-3 text-right font-medium text-gray-500">Used in</th>
              <th className="px-4 py-3 text-right font-medium text-gray-500">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {questions.map((q) => (
              <tr key={q.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 max-w-xs">
                  <MathContent content={q.stem} className="line-clamp-2 text-sm text-gray-800" />
                </td>
                <td className="px-4 py-3">
                  <p className="text-xs text-gray-500">{q.topic.domain.section.label} / {q.topic.domain.name}</p>
                  <p className="text-sm text-gray-700">{q.topic.name}</p>
                  {q.subskill && <p className="text-xs text-gray-500">{q.subskill.name}</p>}
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
                  {new Set(q.setItems.map((s) => s.practiceSetId)).size + q.fullTestItems.length} uses
                </td>
                <td className="px-4 py-3 text-right">
                  <QuestionActions
                    questionId={q.id}
                    status={q.status}
                    usedCount={new Set(q.setItems.map((s) => s.practiceSetId)).size + q.fullTestItems.length + q.answers.length}
                  />
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
      </Card>
    </div>
  );
}
