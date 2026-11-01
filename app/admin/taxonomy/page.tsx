import { Breadcrumbs } from "@/components/sat/breadcrumbs";
import { PageHeader, PageShell } from "@/components/sat";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import { requireAdmin } from "@/lib/rbac";
import { TaxonomyClient } from "./taxonomy-client";
import { TaxonomyAliasesClient, type CorrespondenceRow } from "./taxonomy-aliases-client";
import { compareDomains, compareSkills } from "@/lib/taxonomy-order";
import { practiceAreaLabel } from "@/lib/practice-area";

export default async function AdminTaxonomyPage() {
  // The admin layout also lets teachers in (AI Import); the taxonomy itself is admin-only.
  if (!(await requireAdmin())) redirect("/teacher");
  const [nodes, domains] = await Promise.all([
    prisma.taxonomyNode.findMany({ orderBy: [{ sortOrder: "asc" }, { label: "asc" }] }),
    // Practice domains only (Test placeholders have no practice area).
    prisma.domain.findMany({
      where: { practiceArea: { not: null } },
      select: {
        id: true,
        name: true,
        practiceArea: true,
        aliases: { where: { kind: "DOMAIN" }, select: { id: true, alias: true, source: true }, orderBy: { alias: "asc" } },
        topics: { select: { id: true, name: true, aliases: { select: { id: true, alias: true, source: true }, orderBy: { alias: "asc" } } } },
      },
    }),
  ]);
  const rows: CorrespondenceRow[] = [...domains].sort(compareDomains).flatMap((d) =>
    [...d.topics].sort(compareSkills).map((t, i) => ({
      section: practiceAreaLabel(d.practiceArea),
      domainId: d.id,
      domain: d.name,
      domainAliases: d.aliases,
      firstOfDomain: i === 0,
      domainSkillCount: d.topics.length,
      topicId: t.id,
      skill: t.name,
      skillAliases: t.aliases,
    })),
  );

  return (
    <PageShell>
      <Breadcrumbs items={[{ label: "Home", href: "/teacher" }, { label: "Admin" }, { label: "Taxonomy" }]} />
      <PageHeader title="Taxonomy" description="Academic hierarchy used by Practice, the question bank and import review." />
      <TaxonomyAliasesClient rows={rows} />
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
