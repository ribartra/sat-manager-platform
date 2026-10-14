/**
 * Canonical Practice area classification (Math / Reading / Writing) and
 * report/analytics tab keys including Tests (`tests` URL key; legacy `mocks` still accepted).
 *
 * Source of truth for practice content is Domain.practiceArea (persisted).
 * Heuristic domain-name lists remain only as a fallback for null rows.
 */

export const PRACTICE_AREAS = ["MATH", "READING", "WRITING"] as const;
export type PracticeAreaCode = (typeof PRACTICE_AREAS)[number];

/** User-facing name of the full-length SAT exams (product decision: "Tests", never "Exams"/"Full Practice Tests"). */
export const TESTS_LABEL = "Tests";
export const TEST_LABEL = "Test";

/** URL / UI tab keys for practice + Tests. */
export const AREA_TAB_KEYS = ["math", "reading", "writing", "tests"] as const;
export type AreaTabKey = (typeof AREA_TAB_KEYS)[number];

export const PRACTICE_AREA_TABS = [
  { key: "math", label: "Math", practiceArea: "MATH" as const },
  { key: "reading", label: "Reading", practiceArea: "READING" as const },
  { key: "writing", label: "Writing", practiceArea: "WRITING" as const },
] as const;

export const AREA_TABS_WITH_TESTS = [
  ...PRACTICE_AREA_TABS,
  { key: "tests" as const, label: TESTS_LABEL, practiceArea: null },
];

/** Home pages add a Summary tab in front of the area tabs (no `area` param). */
export const HOME_TAB_KEYS = ["summary", ...AREA_TAB_KEYS] as const;
export type HomeTabKey = (typeof HOME_TAB_KEYS)[number];

export function activeHomeTab(value: string | null | undefined): HomeTabKey {
  if (!value || value === "summary") return "summary";
  return activeAreaTab(value, "math");
}

/** Legacy report-area keys used by parent tokens / PDF query params. */
export type ReportAreaKey = "mathematics" | "reading" | "writing";

export const READING_DOMAIN_NAMES = ["Information and Ideas", "Craft and Structure"] as const;
export const WRITING_DOMAIN_NAMES = ["Expression of Ideas", "Standard English Conventions"] as const;
export const MATH_DOMAIN_NAMES = [
  "Algebra",
  "Advanced Math",
  "Problem-Solving and Data Analysis",
  "Problem Solving and Data Analysis", // legacy name (pre 2026-09-29)
  "Geometry and Trigonometry",
] as const;

export const GRAMMAR_AND_STRUCTURE_TOPIC = "Grammar and Structure";
export const LEGACY_FORM_STRUCTURE_TOPIC = "Form, Structure, and Sense";

export function isAreaTabKey(value: string | null | undefined): value is AreaTabKey {
  return AREA_TAB_KEYS.includes((value ?? "") as AreaTabKey);
}

export function activeAreaTab(value: string | null | undefined, fallback: AreaTabKey = "math"): AreaTabKey {
  // Legacy pages used `rw` for a combined Reading & Writing tab. Reading is
  // the safest destination now that the combined surface is split in two.
  if (value === "rw") return "reading";
  if (value === "mocks") return "tests";
  return isAreaTabKey(value) ? value : fallback;
}

export function practiceAreaFromTab(tab: AreaTabKey): PracticeAreaCode | null {
  if (tab === "math") return "MATH";
  if (tab === "reading") return "READING";
  if (tab === "writing") return "WRITING";
  return null;
}

export function tabFromPracticeArea(area: PracticeAreaCode | null | undefined): AreaTabKey | null {
  if (area === "MATH") return "math";
  if (area === "READING") return "reading";
  if (area === "WRITING") return "writing";
  return null;
}

export function practiceAreaLabel(area: PracticeAreaCode | null | undefined): string {
  if (area === "MATH") return "Math";
  if (area === "READING") return "Reading";
  if (area === "WRITING") return "Writing";
  return "Unclassified";
}

/**
 * Section-style label used to GROUP practice content in pickers, tables and
 * breadcrumbs (Math uses the long form "Mathematics" to match SECTION_ORDER).
 * Reading and Writing are surfaced separately; the combined "Reading & Writing"
 * label is reserved for Test surfaces.
 */
export function practiceSectionLabel(area: PracticeAreaCode | null | undefined): string {
  if (area === "MATH") return "Mathematics";
  if (area === "READING") return "Reading";
  if (area === "WRITING") return "Writing";
  return "Unclassified";
}

/** Convenience: resolve a topic's domain to its practice section label in one call. */
export function domainSectionLabel(input: {
  practiceArea?: PracticeAreaCode | string | null;
  sectionName?: string | null;
  sectionLabel?: string | null;
  domainName?: string | null;
}): string {
  return practiceSectionLabel(resolvePracticeArea(input));
}

export function reportAreaFromTab(tab: Exclude<AreaTabKey, "tests">): ReportAreaKey {
  if (tab === "math") return "mathematics";
  return tab;
}

export function tabFromReportArea(area: ReportAreaKey): Exclude<AreaTabKey, "tests"> {
  if (area === "mathematics") return "math";
  return area;
}

export function practiceAreaFromReportArea(area: ReportAreaKey): PracticeAreaCode {
  if (area === "mathematics") return "MATH";
  if (area === "reading") return "READING";
  return "WRITING";
}

/** CSS custom-property name for an area tab (see globals.css). */
export function areaColorVar(tab: AreaTabKey): string {
  return `var(--sat-area-${tab})`;
}

export function areaTabClass(tab: AreaTabKey, active: boolean): string {
  const color = {
    math: "blue",
    reading: "amber",
    writing: "green",
    tests: "orange",
  }[tab];
  if (active) {
    return `border-${color}-600 text-${color}-700 border-b-2`;
  }
  return "border-transparent text-gray-500 hover:text-gray-800 border-b-2";
}

/** Explicit active/inactive classes (Tailwind needs full class names). */
export function areaTabLinkClass(tab: HomeTabKey, active: boolean): string {
  if (!active) return "border-b-2 border-transparent px-3 py-2 text-sm font-medium text-gray-500 hover:text-gray-800";
  switch (tab) {
    case "summary":
      return "border-b-2 border-gray-900 px-3 py-2 text-sm font-medium text-gray-900";
    case "math":
      return "border-b-2 border-[var(--sat-area-math)] px-3 py-2 text-sm font-medium text-[var(--sat-area-math)]";
    case "reading":
      return "border-b-2 border-[var(--sat-area-reading)] px-3 py-2 text-sm font-medium text-[var(--sat-area-reading)]";
    case "writing":
      return "border-b-2 border-[var(--sat-area-writing)] px-3 py-2 text-sm font-medium text-[var(--sat-area-writing)]";
    case "tests":
      return "border-b-2 border-[var(--sat-area-tests)] px-3 py-2 text-sm font-medium text-[var(--sat-area-tests)]";
  }
}

function normalizeName(value: string | null | undefined): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

/** Fallback when Domain.practiceArea is null (legacy / placeholder rows). */
export function inferPracticeAreaFromNames(input: {
  sectionName?: string | null;
  sectionLabel?: string | null;
  domainName?: string | null;
}): PracticeAreaCode | null {
  const section = normalizeName(`${input.sectionName ?? ""} ${input.sectionLabel ?? ""}`);
  const domain = normalizeName(input.domainName);

  if (!domain && !section) return null;
  if (domain === "full practice test") return null;
  if (MATH_DOMAIN_NAMES.some((name) => domain === normalizeName(name))) return "MATH";
  if (READING_DOMAIN_NAMES.some((name) => domain === normalizeName(name))) return "READING";
  if (WRITING_DOMAIN_NAMES.some((name) => domain === normalizeName(name))) return "WRITING";
  if (section.includes("math")) return "MATH";
  return null;
}

export function resolvePracticeArea(input: {
  practiceArea?: PracticeAreaCode | string | null;
  sectionName?: string | null;
  sectionLabel?: string | null;
  domainName?: string | null;
}): PracticeAreaCode | null {
  const persisted = input.practiceArea;
  if (persisted === "MATH" || persisted === "READING" || persisted === "WRITING") return persisted;
  return inferPracticeAreaFromNames(input);
}

/** Prisma where clause for practice content in a given area. */
export function practiceAreaDomainWhere(area: PracticeAreaCode) {
  const fallbackNames = area === "MATH"
    ? MATH_DOMAIN_NAMES
    : area === "READING"
      ? READING_DOMAIN_NAMES
      : WRITING_DOMAIN_NAMES;
  return {
    OR: [
      { practiceArea: area },
      { practiceArea: null, name: { in: [...fallbackNames] } },
    ],
  };
}

export function practiceAreaTopicWhere(area: PracticeAreaCode) {
  return { domain: practiceAreaDomainWhere(area) };
}

export function practiceAreaPracticeSetWhere(area: PracticeAreaCode) {
  return { topic: practiceAreaTopicWhere(area) };
}

export function buildAreaHref(
  basePath: string,
  area: HomeTabKey,
  extra?: Record<string, string | undefined | null>
): string {
  const params = new URLSearchParams();
  if (area !== "summary") params.set("area", area);
  if (extra) {
    for (const [key, value] of Object.entries(extra)) {
      if (value) params.set(key, value);
    }
  }
  const qs = params.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}
