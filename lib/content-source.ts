import prisma from "@/lib/prisma";

/**
 * Content source: where a Practice Set or Test comes from (College Board, Innovator, …). Global list
 * managed by admins at /admin/sources; inactive sources stay on their content but leave the editors.
 */

/** Seeded by migration 20261029_content_source. */
export const DEFAULT_PRACTICE_SOURCE_ID = "src_college_board";
export const DEFAULT_TEST_SOURCE_ID = "src_innovator";

export interface SourceOption {
  id: string;
  name: string;
  active: boolean;
}

export function listSources({ activeOnly = false }: { activeOnly?: boolean } = {}): Promise<SourceOption[]> {
  return prisma.source.findMany({
    where: activeOnly ? { active: true } : undefined,
    select: { id: true, name: true, active: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
}

/**
 * Validation message for a submitted source, or null when it is fine: it must exist and be active,
 * except that an item may keep the (now inactive) source it already has.
 */
export async function sourceIdIssue(sourceId: unknown, keep?: string | null): Promise<string | null> {
  if (typeof sourceId !== "string" || !sourceId) return "Choose a source.";
  if (keep && sourceId === keep) return null;
  const source = await prisma.source.findUnique({ where: { id: sourceId }, select: { active: true } });
  if (!source) return "The selected source does not exist.";
  if (!source.active) return "The selected source is no longer active.";
  return null;
}
