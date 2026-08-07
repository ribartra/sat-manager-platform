import prisma from "@/lib/prisma";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Plus } from "lucide-react";
import { PracticeSetActions } from "./practice-set-actions-client";
import { PracticeSetsFilter } from "./practice-sets-filter-client";
import { activeTaxonomySection, buildTaxonomyTree, matchesTaxonomySection, TAXONOMY_SECTION_TABS } from "@/lib/taxonomy";
import { cn } from "@/lib/utils";

interface SearchParams { section?: string; topic?: string; difficulty?: string; status?: string }

function tabHref(section: string, filters: SearchParams) {
  const params = new URLSearchParams();
  params.set("section", section);
  if (filters.difficulty) params.set("difficulty", filters.difficulty);
  if (filters.status) params.set("status", filters.status);
  return `/teacher/practice-sets?${params.toString()}`;
}

export default async function TeacherPracticeSetsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const filters = await searchParams;
  const activeSection = activeTaxonomySection(filters.section);

  const [taxonomyNodes, topics] = await Promise.all([
    prisma.taxonomyNode.findMany({ where: { active: true }, orderBy: [{ sortOrder: "asc" }, { label: "asc" }] }),
    prisma.topic.findMany({ include: { taxonomyNode: true, domain: { include: { section: true } } }, orderBy: { name: "asc" } }),
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

  const practiceSets = await prisma.practiceSet.findMany({
    where: {
      topicId: selectedTopicId || { in: [...visibleTopicIds] },
      difficulty: (filters.difficulty as string | undefined) || undefined,
      status: (filters.status as string | undefined) || undefined,
    },
    include: {
      topic: { include: { domain: { include: { section: true } } } },
      questions: { select: { questionId: true } },
      assignments: { select: { id: true, studentId: true, status: true } },
    },
    orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
  });

  const statusVariant = (status: string) => {
    const map: Record<string, "success" | "warning" | "danger" | "default"> = {
      PUBLISHED: "success",
      DRAFT: "warning",
      BLOCKED: "danger",
      ARCHIVED: "default",
    };
    return map[status] ?? "default";
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Practice Sets</h1>
          <p className="mt-1 text-sm text-gray-500">Skill practice assignments, separate from Exams.</p>
        </div>
        <Link href="/teacher/practice-sets/new" className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
          <Plus size={14} /> New Practice Set
        </Link>
      </div>

      <div className="mb-5 flex gap-2 border-b border-gray-200">
        {TAXONOMY_SECTION_TABS.map((tab) => (
          <Link
            key={tab.key}
            href={tabHref(tab.key, filters)}
            className={cn(
              "border-b-2 px-3 py-2 text-sm font-medium",
              activeSection === tab.key ? "border-blue-600 text-blue-700" : "border-transparent text-gray-500 hover:text-gray-800"
            )}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      <PracticeSetsFilter
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

      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs uppercase text-gray-500">
            <tr>
              <th className="px-4 py-3 text-left">Practice Set</th>
              <th className="px-4 py-3 text-left">Skill</th>
              <th className="px-4 py-3 text-left">Difficulty</th>
              <th className="px-4 py-3 text-right">Questions</th>
              <th className="px-4 py-3 text-right">Assignments</th>
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {practiceSets.map((practiceSet) => (
              <tr key={practiceSet.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-900">{practiceSet.name}</td>
                <td className="px-4 py-3">
                  <p className="text-xs text-gray-500">{practiceSet.topic.domain.section.label} / {practiceSet.topic.domain.name}</p>
                  <p className="text-sm text-gray-700">{practiceSet.topic.name}</p>
                </td>
                <td className="px-4 py-3">
                  <Badge variant={practiceSet.difficulty === "EASY" ? "easy" : practiceSet.difficulty === "MEDIUM" ? "medium" : "hard"}>
                    {practiceSet.difficulty}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-right text-gray-500">{practiceSet.questions.length}</td>
                <td className="px-4 py-3 text-right text-gray-500">{practiceSet.assignments.length}</td>
                <td className="px-4 py-3">
                  <Badge variant={statusVariant(practiceSet.status)}>{practiceSet.status}</Badge>
                </td>
                <td className="px-4 py-3 text-right">
                  <PracticeSetActions practiceSetId={practiceSet.id} status={practiceSet.status} assignmentCount={practiceSet.assignments.length} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {practiceSets.length === 0 && <div className="p-10 text-center text-sm text-gray-400">No Practice Sets yet.</div>}
      </Card>
    </div>
  );
}
