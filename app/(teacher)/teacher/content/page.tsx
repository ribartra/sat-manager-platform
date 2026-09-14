import { PageShell } from "@/components/sat";
import prisma from "@/lib/prisma";
import Link from "next/link";
import { Plus } from "lucide-react";
import { Card } from "@/components/ui/card";
import {
  academicTopicWhere,
  activeTaxonomySection,
  buildTaxonomyTree,
  matchesTaxonomyDomainName,
  matchesTaxonomySection,
  taxonomyDomainAnchorId,
  TAXONOMY_SECTION_TABS,
  type TaxonomyTreeNode,
} from "@/lib/taxonomy";
import { cn } from "@/lib/utils";

function tabHref(section: string) {
  return `/teacher/content?section=${section}`;
}

export default async function TeacherContentPage({
  searchParams,
}: {
  searchParams: Promise<{ section?: string; domain?: string }>;
}) {
  const params = await searchParams;
  const activeSection = activeTaxonomySection(params.section);
  const domainFilter = params.domain?.trim() || null;
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
          select: { id: true, status: true, difficulty: true },
        },
      },
      orderBy: { name: "asc" },
    }),
  ]);
  const { roots } = buildTaxonomyTree(taxonomyNodes);
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
                    select: { id: true, status: true, difficulty: true },
                  },
                },
              },
            },
          },
        },
        orderBy: { name: "asc" },
      });

  const visibleRoots = roots
    .filter((node) => matchesTaxonomySection(node, activeSection))
    .map((root) => {
      if (!domainFilter) return root;
      return {
        ...root,
        children: root.children.filter((child) => matchesTaxonomyDomainName(child, domainFilter)),
      };
    })
    .filter((root) => !domainFilter || root.children.length > 0);

  const visibleLegacy = legacySections
    .filter((section) => matchesTaxonomySection(section, activeSection))
    .map((section) => ({
      ...section,
      domains: domainFilter
        ? section.domains.filter((domain) => matchesTaxonomyDomainName(domain, domainFilter))
        : section.domains,
    }))
    .filter((section) => !domainFilter || section.domains.length > 0);

  const hasContent = visibleRoots.length > 0 || visibleLegacy.length > 0;

  const countByStatus = (sets: { status: string }[]) => ({
    published: sets.filter((s) => s.status === "PUBLISHED").length,
    draft: sets.filter((s) => s.status === "DRAFT").length,
    total: sets.length,
  });

  function renderTopicRow(topic: (typeof topics)[number]) {
    const counts = countByStatus(topic.practiceSets);
    const byDiff = ["EASY", "MEDIUM", "HARD"].map((d) => ({
      d,
      count: topic.practiceSets.filter((ps) => ps.difficulty === d && ps.status === "PUBLISHED").length,
      draft: topic.practiceSets.filter((ps) => ps.difficulty === d && ps.status === "DRAFT").length,
    }));

    return (
      <Card
        as={Link}
        key={topic.id}
        href={`/teacher/content/${topic.id}`}
        className="flex items-center justify-between px-4 py-3 transition-colors hover:bg-gray-50"
      >
        <span className="text-sm font-medium text-gray-800">{topic.name}</span>
        <div className="flex items-center gap-3">
          {byDiff.map(({ d, count, draft }) =>
            count + draft > 0 ? (
              <span key={d} className="text-xs text-gray-500">
                <span className={d === "EASY" ? "text-green-600" : d === "MEDIUM" ? "text-yellow-600" : "text-red-600"}>
                  {d.charAt(0) + d.slice(1).toLowerCase()}
                </span>
                : {count} pub{draft > 0 ? ` / ${draft} draft` : ""}
              </span>
            ) : null
          )}
          {counts.total === 0 && <span className="text-xs text-gray-400">No sets yet</span>}
        </div>
      </Card>
    );
  }

  function renderNode(node: TaxonomyTreeNode, depth = 0) {
    const nodeTopics = topicsByNodeId.get(node.id) ?? [];
    const isDomainHeading = depth === 1;
    return (
      <div key={node.id} className={depth === 0 ? "mb-8" : "mt-4"} id={isDomainHeading ? taxonomyDomainAnchorId(node.label) : undefined}>
        {depth === 0 ? (
          <h2 className="mb-3 border-b border-gray-200 pb-2 text-lg font-semibold text-gray-900">{node.label}</h2>
        ) : (
          <h3
            className={cn(
              "mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-gray-500",
              depth > 1 && "normal-case tracking-normal text-gray-600"
            )}
          >
            {node.label}
          </h3>
        )}
        <div className={cn("space-y-1", depth > 0 && "pl-3")}>
          {nodeTopics.map((topic) => renderTopicRow(topic))}
          {node.children.map((child) => renderNode(child, depth + 1))}
        </div>
      </div>
    );
  }

  return (
    <PageShell>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Content Map</h1>
        <Link
          href="/teacher/practice-sets/new"
          className="flex items-center gap-1.5 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          <Plus size={14} /> New Practice Set
        </Link>
      </div>

      <div className="mb-5 flex gap-2 border-b border-gray-200">
        {TAXONOMY_SECTION_TABS.map((tab) => (
          <Link
            key={tab.key}
            href={tabHref(tab.key)}
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

      {domainFilter ? (
        <p className="mb-4 text-sm text-gray-500">
          Showing domain <span className="font-medium text-gray-800">{domainFilter}</span>
          {" · "}
          <Link href={tabHref(activeSection)} className="text-blue-600 hover:underline">
            Clear filter
          </Link>
        </p>
      ) : null}

      {!hasContent && (
        <div className="py-12 text-center text-sm text-gray-400">
          {domainFilter ? "No content for this domain in the selected section." : "No content in this section yet."}
        </div>
      )}

      {visibleRoots.length > 0
        ? visibleRoots.map((node) => renderNode(node))
        : visibleLegacy.map((section) => (
            <div key={section.id} className="mb-8">
              <h2 className="mb-3 border-b border-gray-200 pb-2 text-lg font-semibold text-gray-900">{section.label}</h2>
              {section.domains.map((domain) => (
                <div key={domain.id} id={taxonomyDomainAnchorId(domain.name)} className="mb-4">
                  <h3 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-gray-500">{domain.name}</h3>
                  <div className="space-y-1">
                    {domain.topics.map((topic) => {
                      const counts = countByStatus(topic.practiceSets);
                      const byDiff = ["EASY", "MEDIUM", "HARD"].map((d) => ({
                        d,
                        count: topic.practiceSets.filter((ps) => ps.difficulty === d && ps.status === "PUBLISHED").length,
                        draft: topic.practiceSets.filter((ps) => ps.difficulty === d && ps.status === "DRAFT").length,
                      }));

                      return (
                        <Card
                          as={Link}
                          key={topic.id}
                          href={`/teacher/content/${topic.id}`}
                          className="flex items-center justify-between px-4 py-3 transition-colors hover:bg-gray-50"
                        >
                          <span className="text-sm font-medium text-gray-800">{topic.name}</span>
                          <div className="flex items-center gap-3">
                            {byDiff.map(({ d, count, draft }) =>
                              count + draft > 0 ? (
                                <span key={d} className="text-xs text-gray-500">
                                  <span
                                    className={
                                      d === "EASY" ? "text-green-600" : d === "MEDIUM" ? "text-yellow-600" : "text-red-600"
                                    }
                                  >
                                    {d.charAt(0) + d.slice(1).toLowerCase()}
                                  </span>
                                  : {count} pub{draft > 0 ? ` / ${draft} draft` : ""}
                                </span>
                              ) : null
                            )}
                            {counts.total === 0 && <span className="text-xs text-gray-400">No sets yet</span>}
                          </div>
                        </Card>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          ))}
    </PageShell>
  );
}
