import { PageShell } from "@/components/sat";
import prisma from "@/lib/prisma";
import Link from "next/link";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { academicTopicWhere, activeTaxonomySection, buildTaxonomyTree, matchesTaxonomySection, TAXONOMY_SECTION_TABS } from "@/lib/taxonomy";
import { QuestionsFilter } from "./questions-filter-client";
import { loadOptionImageUrlsByQuestionId } from "@/lib/question-list-media-query";
import { QuestionsTable, type QuestionBankRow } from "./questions-table-client";

interface SearchParams { section?: string; topic?: string; difficulty?: string; status?: string }

const TOPIC_IN_CHUNK = 400;

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
      where: academicTopicWhere,
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
  const visibleTopicIds = [...new Set(visibleTopics.map((topic) => topic.id))];
  const selectedTopicId = filters.topic && visibleTopicIds.includes(filters.topic) ? filters.topic : undefined;

  const topicFilter = selectedTopicId
    ? selectedTopicId
    : visibleTopicIds.length <= TOPIC_IN_CHUNK
      ? { in: visibleTopicIds }
      : { in: visibleTopicIds.slice(0, TOPIC_IN_CHUNK) };

  const questions = await prisma.question.findMany({
    where: {
      topicId: topicFilter,
      difficulty: (filters.difficulty as string | undefined) || undefined,
      status: (filters.status as string | undefined) || undefined,
    },
    include: {
      topic: { include: { domain: { include: { section: true } } } },
      setItems: { select: { practiceSetId: true } },
      fullTestItems: { select: { moduleId: true } },
      answers: { select: { id: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  const optionImages = await loadOptionImageUrlsByQuestionId(questions.map((q) => q.id));

  return (
    <PageShell>
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

      <QuestionsFilter
        section={activeSection}
        sectionLabel={visibleTopics[0]?.domain.section.label ?? (activeSection === "math" ? "Mathematics" : "Reading & Writing")}
        topics={visibleTopics.map((t) => ({
          id: t.id,
          name: t.name,
          sectionLabel: t.domain.section.label,
          domainName: t.domain.name,
        }))}
        initialTopicId={selectedTopicId}
        initialDifficulty={filters.difficulty}
        initialStatus={filters.status}
      />

      <QuestionsTable
        rows={questions.map((q): QuestionBankRow => {
          const setUses = new Set(q.setItems.map((s) => s.practiceSetId)).size;
          const fullUses = q.fullTestItems.length;
          return {
            id: q.id,
            stem: q.stem,
            imageUrl: q.imageUrl,
            stimulus: q.stimulus,
            optionImageUrls: optionImages.get(q.id) ?? [],
            skillSection: q.topic.domain.section.label,
            skillDomain: q.topic.domain.name,
            skillName: q.topic.name,
            difficulty: q.difficulty,
            type: q.type,
            status: q.status,
            uses: setUses + fullUses,
            usedCount: setUses + fullUses + q.answers.length,
          };
        })}
      />
    </PageShell>
  );
}
