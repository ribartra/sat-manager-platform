/**
 * Canonical Digital SAT Full Practice Test module template and routing helpers.
 * Shared by create/promote-full-test and FT question promotion metadata (M1/M2).
 */

export const FULL_TEST_MODULES = [
  { name: "Reading & Writing Module 1", section: "RW" as const, moduleKey: "M1" as const, timeLimit: 32 * 60, expectedCount: 27 },
  { name: "Reading & Writing Module 2", section: "RW" as const, moduleKey: "M2" as const, timeLimit: 32 * 60, expectedCount: 27 },
  { name: "Math Module 1", section: "MATH" as const, moduleKey: "M1" as const, timeLimit: 35 * 60, expectedCount: 22 },
  { name: "Math Module 2", section: "MATH" as const, moduleKey: "M2" as const, timeLimit: 35 * 60, expectedCount: 22 },
] as const;

export type FullTestModuleKey = "M1" | "M2";
export type FullTestSection = "RW" | "MATH";

export const FULL_TEST_EXPECTED_COUNTS = FULL_TEST_MODULES.map((m) => m.expectedCount);

/** Stable Topic ids created by scripts/ensure-fulltest-topics.mjs */
export const FULL_TEST_TOPIC_IDS = {
  MATH_M1: "top-fulltest-math-m1",
  MATH_M2: "top-fulltest-math-m2",
  RW_M1: "top-fulltest-rw-m1",
  RW_M2: "top-fulltest-rw-m2",
} as const;

export function isFullTestSecondModule(moduleLabel: string | null | undefined): boolean {
  const label = (moduleLabel ?? "").toUpperCase();
  return /\b2\b|MOD\s*2|MODULE\s*2|2B/.test(label);
}

export function fullTestSectionFromCandidate(section: string | null | undefined): FullTestSection {
  const value = (section ?? "").toUpperCase();
  if (value.includes("RW") || value.includes("READ")) return "RW";
  return "MATH";
}

export function fullTestModuleKeyFromLabel(moduleLabel: string | null | undefined): FullTestModuleKey {
  return isFullTestSecondModule(moduleLabel) ? "M2" : "M1";
}

/** Order 0..3: RW M1, RW M2, Math M1, Math M2 */
export function moduleIndexForCandidate(candidate: {
  section: string | null;
  moduleLabel: string | null;
}): number {
  const section = fullTestSectionFromCandidate(candidate.section);
  const second = isFullTestSecondModule(candidate.moduleLabel);
  if (section === "RW") return second ? 1 : 0;
  return second ? 3 : 2;
}

export function moduleKeyFromOrder(order: number): FullTestModuleKey {
  return order === 1 || order === 3 ? "M2" : "M1";
}

export function difficultyFromFullTestModuleKey(moduleKey: FullTestModuleKey): "EASY" | "HARD" {
  return moduleKey === "M2" ? "HARD" : "EASY";
}

export function difficultyFromFullTestModuleLabel(moduleLabel: string | null | undefined): "EASY" | "HARD" {
  return difficultyFromFullTestModuleKey(fullTestModuleKeyFromLabel(moduleLabel));
}

export function fullTestTopicIdFor(section: FullTestSection, moduleKey: FullTestModuleKey): string {
  if (section === "MATH") {
    return moduleKey === "M2" ? FULL_TEST_TOPIC_IDS.MATH_M2 : FULL_TEST_TOPIC_IDS.MATH_M1;
  }
  return moduleKey === "M2" ? FULL_TEST_TOPIC_IDS.RW_M2 : FULL_TEST_TOPIC_IDS.RW_M1;
}

export function fullTestModuleBuckets(counts: number[]) {
  return FULL_TEST_MODULES.map((module, index) => ({
    name: module.name,
    section: module.section,
    moduleKey: module.moduleKey,
    expected: module.expectedCount,
    count: counts[index] ?? 0,
    timeLimit: module.timeLimit,
  }));
}
