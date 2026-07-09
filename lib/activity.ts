import prisma from "@/lib/prisma";

export async function markUserActive(userId: string, at = new Date()) {
  try {
    await prisma.$executeRaw`UPDATE "User" SET "lastActiveAt" = ${at} WHERE "id" = ${userId}`;
  } catch (error) {
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
