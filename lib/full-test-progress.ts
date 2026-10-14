import prisma from "@/lib/prisma";

export type FullTestTimerPhase = "MODULE" | "BREAK";

export type FullTestProgressState = {
  timers: number[];
  phase: FullTestTimerPhase;
  breakRemaining: number;
  /** Seconds worked past each module's time limit (overtime is allowed and recorded, never enforced). */
  overtime?: number[];
  /**
   * Indexes (module order) the student has submitted. Students may take modules in any order; a
   * submitted module is locked. Written only by the module-submit endpoint, never by autosave.
   */
  completedModules?: number[];
};

function normalizeCompleted(values: unknown, moduleCount: number): number[] {
  if (!Array.isArray(values)) return [];
  return [...new Set(values.map((v) => Number(v)).filter((v) => Number.isInteger(v) && v >= 0 && v < moduleCount))].sort();
}

function normalizeTimers(values: unknown, moduleCount: number): number[] {
  if (!Array.isArray(values)) return Array.from({ length: moduleCount }, () => 0);
  const timers = values.map((value) => Math.max(0, Number(value) || 0));
  while (timers.length < moduleCount) timers.push(0);
  return timers.slice(0, moduleCount);
}

export function parseFullTestProgressState(raw: string | null | undefined, moduleCount: number): FullTestProgressState | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return { timers: normalizeTimers(parsed, moduleCount), phase: "MODULE", breakRemaining: 0 };
    }
    if (parsed && typeof parsed === "object") {
      return {
        timers: normalizeTimers(parsed.timers, moduleCount),
        phase: parsed.phase === "BREAK" ? "BREAK" : "MODULE",
        breakRemaining: Math.max(0, Number(parsed.breakRemaining) || 0),
        overtime: normalizeTimers(parsed.overtime, moduleCount),
        completedModules: normalizeCompleted(parsed.completedModules, moduleCount),
      };
    }
  } catch {
    return null;
  }
  return null;
}

export async function getFullTestProgressState(attemptId: string, moduleCount = 4): Promise<FullTestProgressState | null> {
  try {
    const rows = await prisma.$queryRaw<Array<{ moduleTimerState: string | null }>>`
      SELECT "moduleTimerState" FROM "FullPracticeTestAttempt" WHERE "id" = ${attemptId}
    `;
    return parseFullTestProgressState(rows[0]?.moduleTimerState, moduleCount);
  } catch {
    return null;
  }
}

/** @deprecated Prefer getFullTestProgressState — kept for callers that only need timer array. */
export async function getFullTestTimerState(attemptId: string) {
  const state = await getFullTestProgressState(attemptId);
  return state?.timers ?? null;
}

export async function saveFullTestProgressState(attemptId: string, state: FullTestProgressState) {
  // completedModules is server-owned: keep what is stored unless the caller sets it explicitly.
  const completedModules = Array.isArray(state.completedModules)
    ? state.completedModules
    : (await getFullTestProgressState(attemptId, state.timers.length || 4))?.completedModules ?? [];
  const payload: FullTestProgressState = {
    timers: state.timers.map((value) => Math.max(0, Number(value) || 0)),
    phase: state.phase === "BREAK" ? "BREAK" : "MODULE",
    breakRemaining: Math.max(0, Number(state.breakRemaining) || 0),
    ...(Array.isArray(state.overtime) ? { overtime: state.overtime.map((value) => Math.max(0, Math.round(Number(value) || 0))) } : {}),
    ...(completedModules.length ? { completedModules: [...new Set(completedModules)].sort() } : {}),
  };
  await prisma.$executeRaw`
    UPDATE "FullPracticeTestAttempt"
    SET "moduleTimerState" = ${JSON.stringify(payload)}
    WHERE "id" = ${attemptId}
  `;
}

export async function saveFullTestTimerState(attemptId: string, moduleTimerState: unknown) {
  if (moduleTimerState && typeof moduleTimerState === "object" && !Array.isArray(moduleTimerState)) {
    const raw = moduleTimerState as Partial<FullTestProgressState>;
    await saveFullTestProgressState(attemptId, {
      timers: Array.isArray(raw.timers) ? raw.timers.map((value) => Math.max(0, Number(value) || 0)) : [],
      phase: raw.phase === "BREAK" ? "BREAK" : "MODULE",
      breakRemaining: Math.max(0, Number(raw.breakRemaining) || 0),
      overtime: Array.isArray(raw.overtime) ? raw.overtime : undefined,
      // never trust the client for completedModules (see saveFullTestProgressState)
    });
    return;
  }
  if (!Array.isArray(moduleTimerState)) return;
  await saveFullTestProgressState(attemptId, {
    timers: moduleTimerState.map((value) => Math.max(0, Number(value) || 0)),
    phase: "MODULE",
    breakRemaining: 0,
  });
}

/** Overtime seconds per module, for results pages (0 for attempts saved before overtime existed). */
export function overtimeByModule(raw: string | null | undefined, moduleCount: number): number[] {
  return parseFullTestProgressState(raw, moduleCount)?.overtime ?? Array.from({ length: moduleCount }, () => 0);
}

/** Module indexes the student already submitted (empty for attempts started before module choice). */
export function completedModulesOf(raw: string | null | undefined, moduleCount: number): number[] {
  return parseFullTestProgressState(raw, moduleCount)?.completedModules ?? [];
}

export { MODULE_KEYS, moduleIndexFromKey, moduleKeyFromIndex, type ModuleKey } from "@/lib/test-module-keys";
