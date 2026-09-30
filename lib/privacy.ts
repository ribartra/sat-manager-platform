import prisma from "@/lib/prisma";
import { deleteAvatar } from "@/lib/storage";
import { forgetSessionState } from "@/lib/session-state";

/**
 * Data-subject requests (RNF-12), run by an admin on request of the person or their parent.
 * - exportUserData: everything the platform stores about one account, as JSON.
 * - anonymizeUser: removes the personal data but keeps attempts and scores (RNF-14 forbids
 *   losing academic history), so reports and the teacher's aggregates stay consistent.
 */
export async function exportUserData(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true, name: true, email: true, phone: true, role: true, birthDate: true, startDate: true,
      avatarUrl: true, active: true, validationStatus: true, createdAt: true, updatedAt: true, lastActiveAt: true,
    },
  });
  if (!user) return null;

  const [
    programEnrollments, groups, parentLinks, childLinks, assignments, attempts,
    fullTestAssignments, fullTestAttempts, unlockRequests, notifications, activity,
  ] = await Promise.all([
    prisma.programEnrollment.findMany({ where: { studentId: userId }, include: { program: { select: { name: true } } } }),
    prisma.groupMembership.findMany({ where: { userId }, include: { group: { select: { name: true } } } }),
    prisma.parentStudent.findMany({ where: { parentId: userId }, include: { student: { select: { name: true, email: true } } } }),
    prisma.parentStudent.findMany({ where: { studentId: userId }, include: { parent: { select: { name: true, email: true } } } }),
    prisma.assignment.findMany({ where: { studentId: userId }, include: { practiceSet: { select: { name: true } } } }),
    prisma.attempt.findMany({
      where: { studentId: userId },
      include: {
        answers: {
          select: {
            questionId: true, answer: true, isCorrect: true, timeSpent: true,
            markedForReview: true, note: true, eliminatedOptions: true, checkedAt: true,
          },
        },
      },
      orderBy: { startedAt: "asc" },
    }),
    prisma.fullPracticeTestAssignment.findMany({ where: { studentId: userId }, include: { test: { select: { name: true } } } }),
    prisma.fullPracticeTestAttempt.findMany({
      where: { studentId: userId },
      include: {
        test: { select: { name: true } },
        answers: {
          select: {
            moduleId: true, questionId: true, answer: true, isCorrect: true, timeSpent: true,
            markedForReview: true, note: true, eliminatedOptions: true,
          },
        },
        pauses: true,
      },
      orderBy: { startedAt: "asc" },
    }),
    prisma.unlockRequest.findMany({ where: { studentId: userId } }),
    prisma.notification.findMany({ where: { userId }, orderBy: { createdAt: "asc" } }),
    prisma.auditLog.findMany({
      where: { OR: [{ userId }, { targetId: userId }] },
      select: { action: true, targetType: true, targetId: true, createdAt: true, userId: true },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  return {
    exportedAt: new Date().toISOString(),
    format: "sat-platform-user-export/v1",
    user,
    programEnrollments,
    groups,
    linkedStudents: parentLinks,
    linkedParents: childLinks,
    practice: { assignments, attempts, unlockRequests },
    fullPracticeTests: { assignments: fullTestAssignments, attempts: fullTestAttempts },
    notifications,
    activity,
  };
}

export async function anonymizeUser(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, avatarUrl: true, email: true } });
  if (!user) return null;

  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: {
        name: "Deleted user",
        email: `deleted+${userId}@invalid.local`,
        phone: null,
        passwordHash: null,
        birthDate: null,
        avatarUrl: null,
        active: false,
        sessionVersion: { increment: 1 },
      },
    }),
    // Free-text written by the student may contain personal information.
    prisma.attemptAnswer.updateMany({ where: { attempt: { studentId: userId } }, data: { note: null } }),
    prisma.fullPracticeTestAnswer.updateMany({ where: { attempt: { studentId: userId } }, data: { note: null } }),
    prisma.notification.deleteMany({ where: { userId } }),
    prisma.passwordResetToken.deleteMany({ where: { userId } }),
    prisma.groupMembership.deleteMany({ where: { userId } }),
    // Invitations keep the consent record (date, used) but lose the identifying fields.
    prisma.inviteToken.updateMany({
      where: { email: user.email },
      data: { email: `deleted+${userId}@invalid.local`, name: "Deleted user", phone: null, parentConsentIp: null },
    }),
    prisma.inviteToken.updateMany({
      where: { parentEmail: user.email },
      data: { parentEmail: null, parentName: null, parentPhone: null, parentConsentIp: null },
    }),
  ]);
  forgetSessionState(userId);
  if (user.avatarUrl) await deleteAvatar(user.avatarUrl);
  return { id: userId };
}
