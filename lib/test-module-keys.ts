/** Client-safe (no Prisma): URL keys for the 4 Test modules. */
/** URL keys for the 4 SAT modules in module order: R&W 1, R&W 2, Math 1, Math 2. */
export const MODULE_KEYS = ["rw1", "rw2", "m1", "m2"] as const;
export type ModuleKey = (typeof MODULE_KEYS)[number];

export function moduleIndexFromKey(key: string | null | undefined): number | null {
  const index = MODULE_KEYS.indexOf((key ?? "") as ModuleKey);
  return index >= 0 ? index : null;
}

export function moduleKeyFromIndex(index: number): ModuleKey | null {
  return MODULE_KEYS[index] ?? null;
}
