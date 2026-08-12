import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { averageScaledScores, resolvePracticeSetAttemptScore } from "@/lib/practice-set-scoring";

export default async function ParentDashboardPage() {
  const session = await auth();
  const links = await prisma.parentStudent.findMany({
    where: { parentId: session!.user.id },
    include: {
      student: {
        include: {
          attempts: {
            where: { status: "SUBMITTED" },
            include: {
              answers: true,
              assignment: {
                include: { practiceSet: { include: { topic: { include: { domain: { include: { section: true } } } } } } },
              },
            },
            orderBy: { submittedAt: "desc" },
            take: 10,
          },
        },
      },
    },
  });

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="mb-6 text-xl font-semibold text-gray-900">Student Progress</h1>
      <div className="grid grid-cols-2 gap-4">
        {await Promise.all(
          links.map(async (link) => {
            const attempts = link.student.attempts;
            const scored = await Promise.all(
              attempts.map(async (a) => {
                const correct = a.answers.filter((ans) => ans.isCorrect).length;
                return resolvePracticeSetAttemptScore({
                  scorePercent: a.scorePercent,
                  scaledScore: a.scaledScore,
                  scoreSection: a.scoreSection,
                  correct,
                  total: a.answers.length,
                  section: a.assignment?.practiceSet.topic.domain.section ?? null,
                });
              }),
            );
            const avgPct = scored.length
              ? Math.round(scored.reduce((sum, row) => sum + row.scorePercent, 0) / scored.length)
              : null;
            const rwAvg = averageScaledScores(scored.filter((row) => row.scoreSection === "RW").map((row) => row.scaledScore));
            const mathAvg = averageScaledScores(scored.filter((row) => row.scoreSection === "MATH").map((row) => row.scaledScore));
            return (
              <Card key={link.studentId} padding="md">
                <h2 className="text-base font-semibold text-gray-900">{link.student.name}</h2>
                <p className="mt-2 text-sm text-gray-600">Recent attempts: {attempts.length}</p>
                <p className="text-sm text-gray-600">Average %: {avgPct !== null ? `${avgPct}%` : "—"}</p>
                <p className="text-sm text-gray-600">SAT R&amp;W avg: {rwAvg ?? "—"}</p>
                <p className="text-sm text-gray-600">SAT Math avg: {mathAvg ?? "—"}</p>
              </Card>
            );
          }),
        )}
      </div>
    </div>
  );
}
