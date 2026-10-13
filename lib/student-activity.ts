import prisma from "@/lib/prisma";

/**
 * Latest finished work per student, across practice sets AND Full Practice Tests.
 * Teacher views use it for "Last activity" so the value doesn't depend on the selected tab.
 */
export async function lastSubmissionByStudent(studentIds: string[]): Promise<Map<string, Date>> {
  const result = new Map<string, Date>();
  if (studentIds.length === 0) return result;
  const [practice, exams] = await Promise.all([
    prisma.attempt.groupBy({
      by: ["studentId"],
      where: { studentId: { in: studentIds }, status: "SUBMITTED" },
      _max: { submittedAt: true },
    }),
    prisma.fullPracticeTestAttempt.groupBy({
      by: ["studentId"],
      where: { studentId: { in: studentIds }, status: "SUBMITTED" },
      _max: { submittedAt: true },
    }),
  ]);
  for (const row of [...practice, ...exams]) {
    const at = row._max.submittedAt;
    if (!at) continue;
    const current = result.get(row.studentId);
    if (!current || at > current) result.set(row.studentId, at);
  }
  return result;
}
