import { PageShell } from "@/components/sat";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import Link from "next/link";
import { ChevronRight, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { academicTopicWhere, activeTaxonomySection, buildTaxonomyTree, matchesTaxonomySection, TAXONOMY_SECTION_TABS, type TaxonomyTreeNode } from "@/lib/taxonomy";

const DIFFICULTIES = ["EASY", "MEDIUM", "HARD"] as const;

interface PageProps {
  searchParams: Promise<{ area?: string }>;
}

export default async function ContentMapPage({ searchParams }: PageProps) {
  const session = await auth();
  const userId = session!.user.id;
  const params = await searchParams;
  const activeArea = activeTaxonomySection(params.area);

  const [taxonomyNodes, topics] = await Promise.all([
    prisma.taxonomyNode.findMany({
      where: { active: true },
      orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
    }),
    prisma.topic.findMany({
      where: academicTopicWhere,
      include: {
        taxonomyNode: true,
        practiceSets: {
          where: { status: "PUBLISHED" },
          select: { id: true, difficulty: true },
        },
      },
      orderBy: { name: "asc" },
    }),
  ]);
  const { roots } = buildTaxonomyTree(taxonomyNodes);
  const visibleRoots = roots.filter((node) => matchesTaxonomySection(node, activeArea));
  const topicsByNodeId = new Map<string, typeof topics>();
  for (const topic of topics) {
    if (!topic.taxonomyNodeId) continue;
    const items = topicsByNodeId.get(topic.taxonomyNodeId) ?? [];
    items.push(topic);
    topicsByNodeId.set(topic.taxonomyNodeId, items);
  }

  const legacySections = taxonomyNodes.length
    ? []
    : await prisma.section.findMany({
    include: {
      domains: {
        include: {
          topics: {
            include: {
              practiceSets: {
                where: { status: "PUBLISHED" },
                select: { id: true, difficulty: true },
              },
            },
          },
        },
      },
    },
    orderBy: { name: "asc" },
  });

  // Get all assignment IDs for this student (to know what's available)
  const assignments = await prisma.assignment.findMany({
    where: { studentId: userId },
    select: { practiceSetId: true, locked: true },
  });
  const unlockedSetIds = new Set(assignments.filter((a) => !a.locked).map((a) => a.practiceSetId));

  function renderTopicRow(topic: (typeof topics)[number]) {
    const setsByDiff: Record<string, typeof topic.practiceSets> = {};
    DIFFICULTIES.forEach((d) => {
      setsByDiff[d] = topic.practiceSets.filter((ps) => ps.difficulty === d);
    });
    const hasAnyUnlocked = topic.practiceSets.some((ps) => unlockedSetIds.has(ps.id));
    if (!hasAnyUnlocked && topic.practiceSets.length > 0) {
      return (
        <Card key={topic.id} variant="subtle" className="flex items-center justify-between px-4 py-2.5 opacity-60">
          <div className="flex items-center gap-2">
            <Lock size={14} className="text-gray-400" />
            <span className="text-sm text-gray-500">{topic.name}</span>
          </div>
        </Card>
      );
    }
    if (topic.practiceSets.length === 0) return null;
    return (
      <Card key={topic.id} className="flex items-center justify-between px-4 py-2.5 transition-colors hover:bg-gray-50">
        <div className="flex items-center gap-2">
          <ChevronRight size={14} className="text-gray-400" />
          <span className="text-sm font-medium text-gray-800">{topic.name}</span>
        </div>
        <div className="flex items-center gap-2">
          {DIFFICULTIES.map((diff) => {
            const sets = setsByDiff[diff];
            const available = sets.filter((ps) => unlockedSetIds.has(ps.id)).length;
            if (sets.length === 0) return null;
            return (
              <Link
                key={diff}
                href={`/student/content-map/${topic.id}/${diff.toLowerCase()}`}
                className={cn(
                  "rounded px-2.5 py-1 text-xs font-medium transition-colors",
                  available > 0
                    ? diff === "EASY"
                      ? "bg-green-100 text-green-700 hover:bg-green-200"
                      : diff === "MEDIUM"
                        ? "bg-yellow-100 text-yellow-700 hover:bg-yellow-200"
                        : "bg-red-100 text-red-700 hover:bg-red-200"
                    : "bg-gray-100 text-gray-400"
                )}
              >
                {diff.charAt(0) + diff.slice(1).toLowerCase()} ({available})
              </Link>
            );
          })}
        </div>
      </Card>
    );
  }

  function renderNode(node: TaxonomyTreeNode, depth = 0) {
    const nodeTopics = topicsByNodeId.get(node.id) ?? [];
    return (
      <div key={node.id} className={depth === 0 ? "mb-8" : "mt-4"}>
        {depth === 0 ? (
          <h2 className="mb-3 border-b border-gray-200 pb-2 text-lg font-semibold text-gray-900">{node.label}</h2>
        ) : (
          <h3 className={cn("mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-gray-500", depth > 1 && "normal-case tracking-normal text-gray-600")}>
            {node.label}
          </h3>
        )}
        <div className={cn("space-y-2", depth > 0 && "pl-3")}>
          {nodeTopics.map((topic) => renderTopicRow(topic))}
          {node.children.map((child) => renderNode(child, depth + 1))}
        </div>
      </div>
    );
  }

  return (
    <PageShell>
      <h1 className="text-2xl font-semibold text-gray-900 mb-6">Content Map</h1>
      <div className="mb-6 flex gap-2 border-b border-gray-200">
        {TAXONOMY_SECTION_TABS.map((tab) => (
          <Link
            key={tab.key}
            href={`/student/content-map?area=${tab.key}`}
            className={cn(
              "border-b-2 px-3 py-2 text-sm font-medium",
              activeArea === tab.key
                ? "border-blue-600 text-blue-700"
                : "border-transparent text-gray-500 hover:text-gray-800"
            )}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      {visibleRoots.length > 0
        ? visibleRoots.map((node) => renderNode(node))
        : legacySections.map((section) => (
        <div key={section.id} className="mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-3 pb-2 border-b border-gray-200">
            {section.label}
          </h2>
          <div className="space-y-2">
            {section.domains.map((domain) => (
              <div key={domain.id}>
                <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide mt-4 mb-2 px-1">
                  {domain.name}
                </h3>
                <div className="space-y-1">
                  {domain.topics.map((topic) => {
                    const setsByDiff: Record<string, typeof topic.practiceSets> = {};
                    DIFFICULTIES.forEach((d) => {
                      setsByDiff[d] = topic.practiceSets.filter((ps) => ps.difficulty === d);
                    });

                    const hasAnyUnlocked = topic.practiceSets.some((ps) => unlockedSetIds.has(ps.id));
                    if (!hasAnyUnlocked && topic.practiceSets.length > 0) {
                      return (
                        <Card
                          key={topic.id}
                          variant="subtle"
                          className="flex items-center justify-between px-4 py-2.5 opacity-60"
                        >
                          <div className="flex items-center gap-2">
                            <Lock size={14} className="text-gray-400" />
                            <span className="text-sm text-gray-500">{topic.name}</span>
                          </div>
                        </Card>
                      );
                    }

                    if (topic.practiceSets.length === 0) return null;

                    return (
                      <Card
                        key={topic.id}
                        className="flex items-center justify-between px-4 py-2.5 transition-colors hover:bg-gray-50"
                      >
                        <div className="flex items-center gap-2">
                          <ChevronRight size={14} className="text-gray-400" />
                          <span className="text-sm font-medium text-gray-800">{topic.name}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          {DIFFICULTIES.map((diff) => {
                            const sets = setsByDiff[diff];
                            const available = sets.filter((ps) => unlockedSetIds.has(ps.id)).length;
                            if (sets.length === 0) return null;
                            return (
                              <Link
                                key={diff}
                                href={`/student/content-map/${topic.id}/${diff.toLowerCase()}`}
                                className={cn(
                                  "px-2.5 py-1 rounded text-xs font-medium transition-colors",
                                  available > 0
                                    ? diff === "EASY"
                                      ? "bg-green-100 text-green-700 hover:bg-green-200"
                                      : diff === "MEDIUM"
                                      ? "bg-yellow-100 text-yellow-700 hover:bg-yellow-200"
                                      : "bg-red-100 text-red-700 hover:bg-red-200"
                                    : "bg-gray-100 text-gray-400"
                                )}
                              >
                                {diff.charAt(0) + diff.slice(1).toLowerCase()} ({available})
                              </Link>
                            );
                          })}
                        </div>
                      </Card>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </PageShell>
  );
}
