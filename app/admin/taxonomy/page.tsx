import prisma from "@/lib/prisma";
import { TaxonomyClient } from "./taxonomy-client";

export default async function AdminTaxonomyPage() {
  const nodes = await prisma.taxonomyNode.findMany({
    orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
  });

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="mb-2 text-xl font-semibold text-gray-900">Taxonomy</h1>
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
    </div>
  );
}
