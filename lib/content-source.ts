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
  forPracticeSets: boolean;
  forTests: boolean;
}

/** Which content a source is offered for (Source.forPracticeSets / Source.forTests). */
export type SourceKind = "practice" | "tests";

function kindWhere(kind?: SourceKind) {
  return kind === "practice" ? { forPracticeSets: true } : kind === "tests" ? { forTests: true } : {};
}

export function listSources({ activeOnly = false, kind }: { activeOnly?: boolean; kind?: SourceKind } = {}): Promise<SourceOption[]> {
  return prisma.source.findMany({
    where: { ...(activeOnly ? { active: true } : {}), ...kindWhere(kind) },
    select: { id: true, name: true, active: true, forPracticeSets: true, forTests: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
}

/**
 * Validation message for a submitted source, or null when it is fine: it must exist, be active and be
 * offered for this kind of content, except that an item may keep the source it already has.
 */
export async function sourceIdIssue(sourceId: unknown, kind: SourceKind, keep?: string | null): Promise<string | null> {
  if (typeof sourceId !== "string" || !sourceId) return "Choose a source.";
  if (keep && sourceId === keep) return null;
  const source = await prisma.source.findUnique({ where: { id: sourceId }, select: { active: true, forPracticeSets: true, forTests: true } });
  if (!source) return "The selected source does not exist.";
  if (!source.active) return "The selected source is no longer active.";
  if (kind === "practice" ? !source.forPracticeSets : !source.forTests) {
    return kind === "practice" ? "The selected source is not used for Practice Sets." : "The selected source is not used for Tests.";
  }
  return null;
}
