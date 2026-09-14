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
