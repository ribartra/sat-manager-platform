import { Breadcrumbs } from "@/components/sat/breadcrumbs";
import { PageShell, PracticeAreaTabs } from "@/components/sat";
import prisma from "@/lib/prisma";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus } from "lucide-react";
import { Card } from "@/components/ui/card";
import {
  academicTopicWhere,
  buildTaxonomyTree,
  matchesTaxonomyDomainName,
  taxonomyDomainAnchorId,
  type TaxonomyTreeNode,
} from "@/lib/taxonomy";
import {
  activeAreaTab,
  buildAreaHref,
  practiceAreaFromTab,
  practiceAreaLabel,
  resolvePracticeArea,
} from "@/lib/practice-area";
import { cn } from "@/lib/utils";

export default async function TeacherContentPage({
  searchParams,
}: {
  searchParams: Promise<{ area?: string; section?: string; domain?: string }>;
}) {
  const params = await searchParams;
  // Navigation is by practice area: Math / Reading / Writing / Full Practice Tests.
  const area = activeAreaTab(params.area ?? params.section, "math");
  // "Full Practice Tests" is an exam surface, not a practice-set area.
  if (area === "tests") redirect("/teacher/tests");
  const activeArea = practiceAreaFromTab(area); // MATH | READING | WRITING (mocks handled above)
  const areaLabel = practiceAreaLabel(activeArea);
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
        domain: { select: { practiceArea: true, name: true } },
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
  // Show only topics of the active practice area that have practice sets; empty topics,
  // other-area topics, and now-empty section/domain headings are hidden (recursive).
  const topicVisible = (t: (typeof topics)[number]) =>
    t.practiceSets.length > 0 &&
    resolvePracticeArea({ practiceArea: t.domain?.practiceArea }) === activeArea;
  function subtreeVisible(node: TaxonomyTreeNode): boolean {
    const own = (topicsByNodeId.get(node.id) ?? []).some(topicVisible);
    return own || node.children.some(subtreeVisible);
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
    .map((root) => {
      if (!domainFilter) return root;
      return {
        ...root,
        children: root.children.filter((child) => matchesTaxonomyDomainName(child, domainFilter)),
      };
    })
    .filter((root) => !domainFilter || root.children.length > 0)
    .filter((root) => subtreeVisible(root));

  const visibleLegacy = legacySections
    .map((section) => ({
      ...section,
      domains: section.domains
        .filter(
          (domain) =>
            resolvePracticeArea({
              practiceArea: domain.practiceArea,
            }) === activeArea
        )
        .filter((domain) => !domainFilter || matchesTaxonomyDomainName(domain, domainFilter))
        .filter((domain) => domain.topics.some((t) => t.practiceSets.length > 0)),
    }))
    .filter((section) => section.domains.length > 0);

  const hasContent = visibleRoots.length > 0 || visibleLegacy.length > 0;

  function renderTopicRow(topic: (typeof topics)[number]) {
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
        </div>
      </Card>
    );
  }

  function renderNode(node: TaxonomyTreeNode, depth = 0) {
    const nodeTopics = (topicsByNodeId.get(node.id) ?? []).filter(topicVisible);
    const childNodes = node.children.map((child) => renderNode(child, depth + 1)).filter(Boolean);
    // Skip any node whose entire subtree has no visible topics (no empty headings left behind).
    if (nodeTopics.length === 0 && childNodes.length === 0) return null;
    const isDomainHeading = depth === 1;
    return (
      <div key={node.id} className={depth === 0 ? "mb-8" : "mt-4"} id={isDomainHeading ? taxonomyDomainAnchorId(node.label) : undefined}>
        {depth === 0 ? (
          <h2 className="mb-3 border-b border-gray-200 pb-2 text-lg font-semibold text-gray-900">{areaLabel}</h2>
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
          {childNodes}
        </div>
      </div>
    );
  }

  return (
    <PageShell>
      <Breadcrumbs items={[{ label: "Home", href: "/teacher" }, { label: "Practice", href: "/teacher/practice-sets" }, { label: "Content map" }]} />
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-[26px] font-bold tracking-[-0.3px] text-gray-900">Content Map</h1>
        <Link
          href="/teacher/practice-sets/new"
          className="flex items-center gap-1.5 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          <Plus size={14} /> New Practice Set
        </Link>
      </div>

      <PracticeAreaTabs basePath="/teacher/content" active={area} includeTests={false} />
      <p className="-mt-3 mb-3 text-xs text-gray-500">
        Practice skills only. Full-length tests are in <Link href="/teacher/tests" className="text-blue-600 hover:underline">Tests</Link>.
      </p>

      {domainFilter ? (
        <p className="mb-4 text-sm text-gray-500">
          Showing domain <span className="font-medium text-gray-800">{domainFilter}</span>
          {" · "}
          <Link href={buildAreaHref("/teacher/content", area)} className="text-blue-600 hover:underline">
            Clear filter
          </Link>
        </p>
      ) : null}

      {!hasContent && (
        <div className="py-12 text-center text-sm text-gray-400">
          {domainFilter ? "No content for this domain in the selected area." : "No content in this area yet."}
        </div>
      )}

      {visibleRoots.length > 0
        ? visibleRoots.map((node) => renderNode(node))
        : visibleLegacy.map((section) => (
            <div key={section.id} className="mb-8">
              <h2 className="mb-3 border-b border-gray-200 pb-2 text-lg font-semibold text-gray-900">{areaLabel}</h2>
              {section.domains.map((domain) => (
                <div key={domain.id} id={taxonomyDomainAnchorId(domain.name)} className="mb-4">
                  <h3 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-gray-500">{domain.name}</h3>
                  <div className="space-y-1">
                    {domain.topics.filter((topic) => topic.practiceSets.length > 0).map((topic) => {
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
