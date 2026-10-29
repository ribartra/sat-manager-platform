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

/**
 * Source chosen on an AI Import upload form ("" / missing = none, i.e. the default at promotion).
 * Returns the id, or an error message when it does not exist or is inactive.
 */
export async function uploadSourceId(value: FormDataEntryValue | null): Promise<{ sourceId: string | null; error?: string }> {
  const sourceId = typeof value === "string" ? value.trim() : "";
  if (!sourceId) return { sourceId: null };
  const source = await prisma.source.findUnique({ where: { id: sourceId }, select: { active: true } });
  if (!source) return { sourceId: null, error: "The selected source does not exist." };
  if (!source.active) return { sourceId: null, error: "The selected source is no longer active." };
  return { sourceId };
}

/**
 * Source given to what an AI Import batch promotes: the batch's source when it is used for that kind of
 * content, otherwise the default (College Board for Practice Sets, Innovator for Tests).
 */
export async function promotionSourceId(batchId: string, kind: SourceKind): Promise<string> {
  const fallback = kind === "practice" ? DEFAULT_PRACTICE_SOURCE_ID : DEFAULT_TEST_SOURCE_ID;
  const batch = await prisma.ingestBatch.findUnique({ where: { id: batchId }, select: { sourceId: true } });
  if (!batch?.sourceId) return fallback;
  const source = await prisma.source.findUnique({ where: { id: batch.sourceId }, select: { forPracticeSets: true, forTests: true } });
  if (!source) return fallback;
  return (kind === "practice" ? source.forPracticeSets : source.forTests) ? batch.sourceId : fallback;
}
