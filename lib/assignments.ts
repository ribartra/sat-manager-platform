import prisma from "@/lib/prisma";
import { withSqliteRetry } from "@/lib/sqlite-retry";

export async function markOverdueAssignments(now = new Date()) {
  await withSqliteRetry(() => prisma.assignment.updateMany({
      where: {
        dueDate: { lt: now },
        status: { in: ["PENDING", "IN_PROGRESS"] },
      },
      data: { status: "OVERDUE" },
    }),
  );
}

export async function releaseScheduledUnlocks(now = new Date()) {
  await withSqliteRetry(() => prisma.assignment.updateMany({
      where: {
        locked: true,
        unlockAt: { lte: now },
      },
      data: { locked: false, unlockAt: null },
    }),
  );
}

export async function refreshAssignmentStates(now = new Date()) {
  // Keep SQLite writes sequential; concurrent updates can contend on the shared WAL file.
  await markOverdueAssignments(now);
  await releaseScheduledUnlocks(now);
}
