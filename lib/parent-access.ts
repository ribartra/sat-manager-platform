// Shared logic for shared parent report links (ParentAccessToken).
// Semantics: the link must be first opened before `expiresAt` (activation
// deadline). The first open records `usedAt`; from then the report stays
// available for PARENT_ACCESS_WINDOW_DAYS.
export const PARENT_ACCESS_WINDOW_DAYS = 7;
export const PARENT_ACTIVATION_DEADLINE_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

export type ReportArea = "mathematics" | "reading" | "writing";
const ALL_AREAS: ReportArea[] = ["mathematics", "reading", "writing"];

export function parseAreas(csv: string | null | undefined): ReportArea[] {
  if (!csv) return [...ALL_AREAS];
  const parts = csv
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter((value): value is ReportArea => (ALL_AREAS as string[]).includes(value));
  return parts.length ? [...new Set(parts)] : [...ALL_AREAS];
}

/** Normalize an incoming areas selection to a stored CSV; empty means all. */
export function normalizeAreasInput(input: unknown): string {
  if (!Array.isArray(input)) return ALL_AREAS.join(",");
  const valid = input
    .map((value) => String(value).trim().toLowerCase())
    .filter((value): value is ReportArea => (ALL_AREAS as string[]).includes(value));
  return (valid.length ? [...new Set(valid)] : ALL_AREAS).join(",");
}

export function areasLabel(areas: ReportArea[]): string {
  const hasMath = areas.includes("mathematics");
  const hasRW = areas.includes("reading") || areas.includes("writing");
  if (hasMath && hasRW) return "Mathematics and Reading & Writing";
  if (hasMath) return "Mathematics";
  if (hasRW) return "Reading & Writing";
  return "All sections";
}

/** Whether a data-model section label is included by the selected areas. */
export function sectionMatchesAreas(sectionLabel: string | null | undefined, areas: ReportArea[]): boolean {
  const isMath = /math/i.test(sectionLabel ?? "");
  if (isMath) return areas.includes("mathematics");
  return areas.includes("reading") || areas.includes("writing");
}

export type AccessWindow = { active: boolean; effectiveExpiresAt: Date };

export function accessWindow(
  token: { usedAt: Date | null; expiresAt: Date; revokedAt: Date | null },
  now: Date = new Date()
): AccessWindow {
  if (token.revokedAt) return { active: false, effectiveExpiresAt: token.expiresAt };
  if (!token.usedAt) {
    // Not activated yet: valid until the activation deadline.
    return { active: now <= token.expiresAt, effectiveExpiresAt: token.expiresAt };
  }
  const windowEnd = new Date(token.usedAt.getTime() + PARENT_ACCESS_WINDOW_DAYS * DAY_MS);
  return { active: now <= windowEnd, effectiveExpiresAt: windowEnd };
}
