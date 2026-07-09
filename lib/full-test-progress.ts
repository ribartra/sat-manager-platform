import prisma from "@/lib/prisma";

export async function getFullTestTimerState(attemptId: string) {
  try {
    const rows = await prisma.$queryRaw<Array<{ moduleTimerState: string | null }>>`
      SELECT "moduleTimerState" FROM "FullPracticeTestAttempt" WHERE "id" = ${attemptId}
    `;
    const raw = rows[0]?.moduleTimerState;
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map((value) => Number(value) || 0) : null;
  } catch {
    return null;
  }
}

export async function saveFullTestTimerState(attemptId: string, moduleTimerState: unknown) {
  if (!Array.isArray(moduleTimerState)) return;
  const normalized = moduleTimerState.map((value) => Math.max(0, Number(value) || 0));
  await prisma.$executeRaw`
    UPDATE "FullPracticeTestAttempt"
    SET "moduleTimerState" = ${JSON.stringify(normalized)}
    WHERE "id" = ${attemptId}
  `;
}
