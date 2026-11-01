import prisma from "@/lib/prisma";
import { claimWriteSlot, releaseWriteSlot } from "@/lib/write-throttle";

/** "Last active" is shown by the day: one stamp a minute per user is plenty. */
const ACTIVE_STAMP_INTERVAL_MS = 60_000;

/**
 * Stamps User.lastActiveAt. Routine calls (autosave, login) write at most once a minute per user;
 * a call with an explicit time (submit) always writes.
 */
export async function markUserActive(userId: string, at?: Date) {
  const key = `active:${userId}`;
  if (!at && !claimWriteSlot(key, ACTIVE_STAMP_INTERVAL_MS)) return;
  try {
    await prisma.$executeRaw`UPDATE "User" SET "lastActiveAt" = ${at ?? new Date()} WHERE "id" = ${userId}`;
  } catch (error) {
    releaseWriteSlot(key);
    console.warn("Unable to update lastActiveAt.", error);
  }
}

export async function getStudentLastActiveMap() {
  let rows: Array<{ id: string; lastActiveAt: Date | string | null }> = [];
  try {
    rows = await prisma.$queryRaw<Array<{ id: string; lastActiveAt: Date | string | null }>>`
      SELECT "id", "lastActiveAt" FROM "User" WHERE "role" = 'STUDENT'
    `;
  } catch (error) {
    console.warn("Unable to read lastActiveAt.", error);
  }

  return new Map(
    rows.map((row) => [
      row.id,
      row.lastActiveAt ? new Date(row.lastActiveAt) : null,
    ])
  );
}
