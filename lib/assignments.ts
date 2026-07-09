import prisma from "@/lib/prisma";

export async function markOverdueAssignments(now = new Date()) {
  await prisma.assignment.updateMany({
    where: {
      dueDate: { lt: now },
      status: { in: ["PENDING", "IN_PROGRESS"] },
    },
    data: { status: "OVERDUE" },
  });
}

export async function releaseScheduledUnlocks(now = new Date()) {
  await prisma.assignment.updateMany({
    where: {
      locked: true,
      unlockAt: { lte: now },
    },
    data: { locked: false, unlockAt: null },
  });
}

export async function refreshAssignmentStates(now = new Date()) {
  await Promise.all([
    markOverdueAssignments(now),
    releaseScheduledUnlocks(now),
  ]);
}
