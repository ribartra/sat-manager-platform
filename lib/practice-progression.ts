import prisma from "@/lib/prisma";
import { notifyUser } from "@/lib/notifications";

const DIFFICULTY_ORDER = ["EASY", "MEDIUM", "HARD"];

interface ProgressionInput {
  studentId: string;
  practiceSetId: string;
  scorePercent: number;
}

async function ensureUnlockedAssignment(studentId: string, practiceSetId: string, reason: string) {
  const existing = await prisma.assignment.findFirst({
    where: { studentId, practiceSetId },
    include: { practiceSet: true },
  });

  if (existing?.locked) {
    await prisma.auditLog.create({
      data: {
        userId: studentId,
        action: "AUTO_UNLOCK_SKIPPED_MANUAL_LOCK",
        targetType: "Assignment",
        targetId: existing.id,
        metadata: JSON.stringify({ practiceSetId, reason }),
      },
    });
    return;
  }

  if (existing?.unlockAt && existing.unlockAt > new Date()) {
    await prisma.auditLog.create({
      data: {
        userId: studentId,
        action: "AUTO_UNLOCK_SKIPPED_SCHEDULED_LOCK",
        targetType: "Assignment",
        targetId: existing.id,
        metadata: JSON.stringify({ practiceSetId, unlockAt: existing.unlockAt, reason }),
      },
    });
    return;
  }

  if (existing) {
    if (existing.status === "COMPLETED") return;
    await prisma.assignment.update({
      where: { id: existing.id },
      data: { locked: false, unlockAt: null },
    });
    await notifyUser(studentId, "Practice set unlocked", existing.practiceSet.name, "/student");
    await prisma.auditLog.create({
      data: {
        userId: studentId,
        action: "AUTO_UNLOCK_ASSIGNMENT",
        targetType: "Assignment",
        targetId: existing.id,
        metadata: JSON.stringify({ practiceSetId, reason }),
      },
    });
    return;
  }

  const practiceSet = await prisma.practiceSet.findUnique({
    where: { id: practiceSetId },
    select: { name: true },
  });
  const assignment = await prisma.assignment.create({
    data: {
      studentId,
      practiceSetId,
      assignedById: null,
      locked: false,
      status: "PENDING",
    },
  });
  await notifyUser(studentId, "Practice set unlocked", practiceSet?.name ?? "A practice set was unlocked.", "/student");
  await prisma.auditLog.create({
    data: {
      userId: studentId,
      action: "AUTO_CREATE_ASSIGNMENT",
      targetType: "Assignment",
      targetId: assignment.id,
      metadata: JSON.stringify({ practiceSetId, reason }),
    },
  });
}

export async function applyPracticeProgression({ studentId, practiceSetId, scorePercent }: ProgressionInput) {
  const current = await prisma.practiceSet.findUnique({
    where: { id: practiceSetId },
    select: { id: true, topicId: true, difficulty: true, createdAt: true, name: true },
  });
  if (!current) return;

  if (scorePercent >= 70) {
    const sameLevelSets = await prisma.practiceSet.findMany({
      where: {
        topicId: current.topicId,
        difficulty: current.difficulty,
        status: "PUBLISHED",
      },
      orderBy: [{ createdAt: "asc" }, { name: "asc" }],
      select: { id: true },
    });
    const currentIndex = sameLevelSets.findIndex((practiceSet) => practiceSet.id === current.id);
    const nextSameLevel = currentIndex >= 0 ? sameLevelSets[currentIndex + 1] : null;
    if (nextSameLevel) {
      await ensureUnlockedAssignment(studentId, nextSameLevel.id, "SAME_LEVEL_70");
    }
  }

  if (scorePercent >= 75) {
    const currentDifficultyIndex = DIFFICULTY_ORDER.indexOf(current.difficulty);
    const nextDifficulty = DIFFICULTY_ORDER[currentDifficultyIndex + 1];
    if (!nextDifficulty) return;

    const nextDifficultySet = await prisma.practiceSet.findFirst({
      where: {
        topicId: current.topicId,
        difficulty: nextDifficulty,
        status: "PUBLISHED",
      },
      orderBy: [{ createdAt: "asc" }, { name: "asc" }],
      select: { id: true },
    });
    if (nextDifficultySet) {
      await ensureUnlockedAssignment(studentId, nextDifficultySet.id, "NEXT_DIFFICULTY_75");
    }
  }
}
