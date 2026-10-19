import { Breadcrumbs } from "@/components/sat/breadcrumbs";
import { PageShell } from "@/components/sat";
import prisma from "@/lib/prisma";
import { TaxonomyClient } from "./taxonomy-client";

export default async function AdminTaxonomyPage() {
  const nodes = await prisma.taxonomyNode.findMany({
    orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
  });

  return (
    <PageShell>
      <Breadcrumbs items={[{ label: "Home", href: "/teacher" }, { label: "Admin" }, { label: "Taxonomy" }]} />
      <h1 className="mb-2 text-[26px] font-bold tracking-[-0.3px] text-gray-900">Taxonomy</h1>
      <p className="mb-6 text-sm text-gray-500">Academic hierarchy used by the content map, question bank, and import review.</p>
      <TaxonomyClient nodes={nodes.map((node) => ({
        id: node.id,
        name: node.name,
        label: node.label,
        type: node.type,
        parentId: node.parentId,
        sortOrder: node.sortOrder,
        active: node.active,
      }))} />
    </PageShell>
  );
}
