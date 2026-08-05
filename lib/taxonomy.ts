export const TAXONOMY_SECTION_TABS = [
  { key: "math", label: "Math" },
  { key: "rw", label: "R&W" },
] as const;

export type TaxonomySectionKey = (typeof TAXONOMY_SECTION_TABS)[number]["key"];

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

export function activeTaxonomySection(value: string | undefined | null): TaxonomySectionKey {
  return TAXONOMY_SECTION_TABS.some((tab) => tab.key === value) ? (value as TaxonomySectionKey) : "math";
}

export function isMathTaxonomyLabel(value: { name: string; label: string }) {
  return `${value.name} ${value.label}`.toLowerCase().includes("math");
}

export function matchesTaxonomySection(value: { name: string; label: string }, section: TaxonomySectionKey) {
  return section === "math" ? isMathTaxonomyLabel(value) : !isMathTaxonomyLabel(value);
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
