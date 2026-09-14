import { PageShell } from "@/components/sat";
import prisma from "@/lib/prisma";
import { SubskillsClient } from "./subskills-client";
import { academicTopicWhere, buildTaxonomyTree, taxonomyPathLabel } from "@/lib/taxonomy";

export default async function SubskillsPage() {
  const [topics, taxonomyNodes] = await Promise.all([
    prisma.topic.findMany({
      where: academicTopicWhere,
      include: { taxonomyNode: true, domain: { include: { section: true } }, subskills: { include: { taxonomyNode: true }, orderBy: { name: "asc" } } },
      orderBy: { name: "asc" },
    }),
    prisma.taxonomyNode.findMany({ where: { active: true }, orderBy: [{ sortOrder: "asc" }, { label: "asc" }] }),
  ]);
  const { byId } = buildTaxonomyTree(taxonomyNodes);

  return (
    <PageShell>
      <h1 className="mb-6 text-xl font-semibold text-gray-900">Subskills</h1>
      <SubskillsClient
        topics={topics.map((topic) => ({
          id: topic.id,
          label: taxonomyPathLabel(topic.taxonomyNodeId, byId, `${topic.domain.section.label} / ${topic.domain.name} / ${topic.name}`),
          subskills: topic.subskills.map((s) => ({
            id: s.id,
            name: s.name,
            label: taxonomyPathLabel(s.taxonomyNodeId, byId, s.name),
          })),
        }))}
      />
    </PageShell>
  );
}
