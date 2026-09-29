import prisma from "@/lib/prisma";

export const FEATURE_SETTINGS = {
  STUDENT_UNLOCK_REQUESTS: {
    label: "Student unlock requests",
    description: "Allow students to request access to locked Practice Sets.",
    defaultValue: false,
    owner: "product",
    expiresAt: null as string | null,
  },
  STUDENT_SELF_ENROLLMENT: {
    label: "Student self enrollment",
    description: "Allow students or parents to request enrollment into an available program.",
    defaultValue: false,
    owner: "product",
    expiresAt: null as string | null,
  },
  TEACHER_PROGRAM_MANAGEMENT: {
    label: "Teacher program management",
    description: "Allow teachers to create and edit their own programs.",
    defaultValue: false,
    owner: "product",
    expiresAt: null as string | null,
  },
  TEACHER_GROUP_MANAGEMENT: {
    label: "Teacher group management",
    description: "Allow teachers to create groups, manage memberships, and assign work by group.",
    defaultValue: false,
    owner: "product",
    expiresAt: null as string | null,
  },
  QUESTION_GRAPH_VISUALIZATION: {
    label: "Question graph visualization option",
    description:
      "Show the “Enable graph visualization” checkbox in the question editor (Math). When off, the option stays hidden; existing supportsGraph values are unchanged.",
    defaultValue: false,
    owner: "product",
    expiresAt: null as string | null,
  },
  MATERIALS_MODULE: {
    label: "Study Materials module",
    description:
      "Show Materials in Student and Teacher navigation and allow access to materials pages/APIs. When off (default), Materials stays hidden for both roles; data is preserved.",
    defaultValue: false,
    owner: "product",
    expiresAt: null as string | null,
  },
  FPT_PRETEST_EXCLUSION: {
    label: "Exclude Full Practice Test pretest questions from score",
    description:
      "When on, questions marked as pretest (typically the first 2 per module) do not count toward R&W/Math raw or scaled scores. When off (default), every question counts.",
    defaultValue: false,
    owner: "product",
    expiresAt: null as string | null,
  },
  TIME_FILTER_END_DATE: {
    label: "Show 'to' date in time filters",
    description:
      "When off (default), time filters only ask for a start date ('From' / 'Start date from') and the range stays open until today. When on, an end date ('To' / 'Start date to') is also shown and applied.",
    defaultValue: false,
    owner: "product",
    expiresAt: null as string | null,
  },
  CALCULATOR_PRACTICE_SETS: {
    label: "External graphing calculator in Practice Sets",
    description:
      "When on, Math Practice players may load the external graphing calculator (Desmos/GeoGebra per env). When off (default), no calculator panel is shown. If the CDN fails or the browser is offline, the panel hides automatically.",
    defaultValue: false,
    owner: "product",
    expiresAt: null as string | null,
  },
  CALCULATOR_FULL_TESTS: {
    label: "External graphing calculator in Full Practice Tests",
    description:
      "When on, Math modules in Full Practice Tests may load the external graphing calculator (Desmos/GeoGebra per env). When off (default), no calculator panel is shown. If the CDN fails or the browser is offline, the panel hides automatically.",
    defaultValue: false,
    owner: "product",
    expiresAt: null as string | null,
  },
} as const;

export type FeatureSettingKey = keyof typeof FEATURE_SETTINGS;

export function isFeatureSettingKey(key: string): key is FeatureSettingKey {
  return key in FEATURE_SETTINGS;
}

export async function getFeatureSetting(key: FeatureSettingKey): Promise<boolean> {
  const setting = await prisma.appSetting.findUnique({ where: { key } });
  if (!setting) return FEATURE_SETTINGS[key].defaultValue;
  return setting.value === "true";
}

export async function getFeatureSettings(): Promise<Record<FeatureSettingKey, boolean>> {
  const rows = await prisma.appSetting.findMany({
    where: { key: { in: Object.keys(FEATURE_SETTINGS) } },
  });
  const rowMap = new Map(rows.map((row) => [row.key, row.value === "true"]));

  return Object.fromEntries(
    Object.entries(FEATURE_SETTINGS).map(([key, config]) => [
      key,
      rowMap.get(key) ?? config.defaultValue,
    ])
  ) as Record<FeatureSettingKey, boolean>;
}
