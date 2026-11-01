/** Domain used only for Full Practice Test module skills (M1/M2) — not an academic SAT skill. */
export const FULL_PRACTICE_TEST_DOMAIN_NAME = "Full Practice Test";

/** Prisma `where` fragment: exclude FPT placeholder/module topics from skill pickers. */
export const academicTopicWhere = {
  domain: { name: { not: FULL_PRACTICE_TEST_DOMAIN_NAME } },
} as const;

export function isAcademicSkillTopic(topic: { domain?: { name?: string | null } | null }) {
  return (topic.domain?.name ?? "").trim() !== FULL_PRACTICE_TEST_DOMAIN_NAME;
}

export type TaxonomyNodeBase = {
  id: string;
  name: string;
  label: string;
  type: string;
  parentId: string | null;
  sortOrder: number;
  active: boolean;
};

export type TaxonomyTreeNode<T extends TaxonomyNodeBase = TaxonomyNodeBase> = T & {
  children: TaxonomyTreeNode<T>[];
};

/** Case-insensitive match for domain deep-links (`?domain=Algebra`). */
export function matchesTaxonomyDomainName(
  value: { name?: string | null; label?: string | null },
  domain: string | null | undefined
) {
  const needle = domain?.trim().toLowerCase();
  if (!needle) return true;
  return [value.name, value.label].some((part) => (part ?? "").trim().toLowerCase() === needle);
}

/** Stable DOM id for a domain heading (scroll / deep-link anchors). */
export function taxonomyDomainAnchorId(name: string) {
  return `domain-${name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")}`;
}

export function buildTaxonomyTree<T extends TaxonomyNodeBase>(nodes: T[]) {
  const byId = new Map<string, TaxonomyTreeNode<T>>();
  for (const node of nodes) {
    byId.set(node.id, { ...node, children: [] });
  }
  const roots: TaxonomyTreeNode<T>[] = [];
  for (const node of byId.values()) {
    if (node.parentId && byId.has(node.parentId)) {
      byId.get(node.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }
  const sortNodes = (items: TaxonomyTreeNode<T>[]) => {
    items.sort((a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label));
    items.forEach((item) => sortNodes(item.children));
  };
  sortNodes(roots);
  return { roots, byId };
}

export function taxonomyPath(nodeId: string | null | undefined, byId: Map<string, TaxonomyTreeNode>) {
  if (!nodeId) return [];
  const path: TaxonomyTreeNode[] = [];
  let current = byId.get(nodeId);
  while (current) {
    path.unshift(current);
    current = current.parentId ? byId.get(current.parentId) : undefined;
  }
  return path;
}

export function taxonomyPathLabel(nodeId: string | null | undefined, byId: Map<string, TaxonomyTreeNode>, fallback: string) {
  const labels = taxonomyPath(nodeId, byId).map((node) => node.label);
  return labels.length ? labels.join(" / ") : fallback;
}
