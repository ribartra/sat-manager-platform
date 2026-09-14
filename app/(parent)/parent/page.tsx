import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { EmptyState, PageContent, PageHeader, PageShell } from "@/components/sat";
import { scoreBandTextClass } from "@/lib/score-band";

export default async function ParentDashboardPage() {
  const session = await auth();
  const links = await prisma.parentStudent.findMany({
    where: { parentId: session!.user.id },
    include: {
      student: {
        include: {
          attempts: {
            where: { status: "SUBMITTED" },
            include: { answers: true },
            orderBy: { submittedAt: "desc" },
            take: 10,
          },
        },
      },
    },
  });

  return (
    <PageShell width="default">
      <PageHeader title="Student Progress" />
      <PageContent>
        {links.length === 0 ? (
          <EmptyState
            title="No students linked yet"
            description="When a teacher links your account to a student, their progress will appear here."
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 @md:grid-cols-2">
            {links.map((link) => {
              const attempts = link.student.attempts;
              const pcts = attempts.map((a) => {
                if (typeof a.scorePercent === "number") return a.scorePercent;
                const correct = a.answers.filter((ans) => ans.isCorrect).length;
                return a.answers.length ? Math.round((correct / a.answers.length) * 100) : 0;
              });
              const avgPct = pcts.length ? Math.round(pcts.reduce((sum, p) => sum + p, 0) / pcts.length) : null;
              return (
                <Card key={link.studentId} padding="md">
                  <h2 className="text-base font-semibold text-foreground">{link.student.name}</h2>
                  <p className="mt-2 text-sm text-muted-foreground">Recent attempts: {attempts.length}</p>
                  <p className={`text-sm font-medium ${scoreBandTextClass(avgPct)}`}>
                    Average %: {avgPct !== null ? `${avgPct}%` : "—"}
                  </p>
                </Card>
              );
            })}
          </div>
        )}
      </PageContent>
    </PageShell>
  );
}
