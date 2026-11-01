// Shared logic for shared parent report links (ParentAccessToken).
// Semantics: the link must be first opened before `expiresAt` (activation
// deadline). The first open records `usedAt`; from then the report stays
// available for PARENT_ACCESS_WINDOW_DAYS.
import {
  practiceAreaFromReportArea,
  resolvePracticeArea,
  type ReportAreaKey,
} from "@/lib/practice-area";

export const PARENT_ACCESS_WINDOW_DAYS = 7;
export const PARENT_ACTIVATION_DEADLINE_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

export type ReportArea = ReportAreaKey;
export type PracticeSetArea = ReportArea | "reading_writing";
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
  if (hasMath && hasRW) return "Math and Reading & Writing";
  if (hasMath) return "Math";
  if (hasRW) return "Reading & Writing";
  return "All sections";
}

/**
 * Classify content by its Section: MATH / READING / WRITING are practice sections; the
 * READING_WRITING section only holds Test content ("Reading & Writing").
 */
export function classifyPracticeSetArea(input: { practiceArea?: string | null; sectionName?: string | null }): PracticeSetArea | null {
  const resolved = resolvePracticeArea(input);
  if (resolved === "MATH") return "mathematics";
  if (resolved === "READING") return "reading";
  if (resolved === "WRITING") return "writing";
  return input.sectionName === "READING_WRITING" ? "reading_writing" : null;
}

/** Whether a Practice Set classification belongs in a selected report area. */
export function practiceSetMatchesArea(
  input: Parameters<typeof classifyPracticeSetArea>[0],
  area: ReportArea,
): boolean {
  const classification = classifyPracticeSetArea(input);
  if (classification === "mathematics") return area === "mathematics";
  if (classification === "reading") return area === "reading";
  if (classification === "writing") return area === "writing";
  return classification === "reading_writing" && (area === "reading" || area === "writing");
}

export function practiceSetAreaLabel(classification: PracticeSetArea | null): string | null {
  if (classification === "mathematics") return "Math";
  if (classification === "reading") return "Reading";
  if (classification === "writing") return "Writing";
  if (classification === "reading_writing") return "Reading & Writing";
  return null;
}

/** Prisma-friendly practice area for a report area key. */
export function persistedPracticeAreaForReport(area: ReportArea) {
  return practiceAreaFromReportArea(area);
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
