import prisma from "@/lib/prisma";

export const FEATURE_SETTINGS = {
  STUDENT_UNLOCK_REQUESTS: {
    label: "Student unlock requests",
    description: "Lets students ask their teacher to unlock a locked practice set.",
    defaultValue: false,
    owner: "product",
    expiresAt: null as string | null,
  },
  STUDENT_SELF_ENROLLMENT: {
    label: "Student self enrollment",
    description: "Lets students or parents ask to join an open program.",
    defaultValue: false,
    owner: "product",
    expiresAt: null as string | null,
  },
  TEACHER_PROGRAM_MANAGEMENT: {
    label: "Teacher program management",
    description: "Lets teachers create and edit their own programs.",
    defaultValue: false,
    owner: "product",
    expiresAt: null as string | null,
  },
  ASSIGN_LOCKED_OPTION: {
    label: "\"Keep it locked\" option when assigning practice",
    description: "Shows \"Keep it locked for now (you unlock it later)\" in Assign practice. When off it is hidden and new assignments are never locked.",
    defaultValue: false,
    owner: "product",
    expiresAt: null as string | null,
  },
  TEACHER_GROUP_MANAGEMENT: {
    label: "Teacher group management",
    description: "Lets teachers create groups of students and assign work to a whole group.",
    defaultValue: false,
    owner: "product",
    expiresAt: null as string | null,
  },
  QUESTION_GRAPH_VISUALIZATION: {
    label: "Question graph visualization option",
    description: "Shows the 'graph' option in the question editor.",
    defaultValue: false,
    owner: "product",
    expiresAt: null as string | null,
  },
  MATERIALS_MODULE: {
    label: "Study Materials module",
    description: "Shows Study Materials to students and teachers. Turning it off hides them; nothing is deleted.",
    defaultValue: false,
    owner: "product",
    expiresAt: null as string | null,
  },
  FPT_PRETEST_EXCLUSION: {
    label: "Exclude Test pretest questions from score",
    description: "When on, the 2 trial questions at the start of each module don't count toward the score.",
    defaultValue: false,
    owner: "product",
    expiresAt: null as string | null,
  },
  TIME_FILTER_END_DATE: {
    label: "Show 'to' date in time filters",
    description: "Adds an end date to date filters. When off, filters run from the start date to today.",
    defaultValue: false,
    owner: "product",
    expiresAt: null as string | null,
  },
  CALCULATOR_PRACTICE_SETS: {
    label: "External graphing calculator in Practice Sets",
    description: "Shows a graphing calculator in Math practice. It hides itself if it can't load.",
    defaultValue: false,
    owner: "product",
    expiresAt: null as string | null,
  },
  CALCULATOR_FULL_TESTS: {
    label: "External graphing calculator in Tests",
    description: "Shows a graphing calculator in Math exams. It hides itself if it can't load.",
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
