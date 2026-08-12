import prisma from "@/lib/prisma";

export type FullTestTimerPhase = "MODULE" | "BREAK";

export type FullTestProgressState = {
  timers: number[];
  phase: FullTestTimerPhase;
  breakRemaining: number;
};

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
  const payload: FullTestProgressState = {
    timers: state.timers.map((value) => Math.max(0, Number(value) || 0)),
    phase: state.phase === "BREAK" ? "BREAK" : "MODULE",
    breakRemaining: Math.max(0, Number(state.breakRemaining) || 0),
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
