import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { EmptyState, PageContent, PageHeader, PageShell, PracticeSetAttemptsAccordion, SkillResults } from "@/components/sat";
import { loadPracticeReport } from "@/lib/student-report";
import type { PracticeAreaCode } from "@/lib/practice-area";
import { practiceSetGroups, practiceSetTitle, type GroupableSet } from "@/lib/attempt-groups";
import { summarizeAllQuestionAnswers } from "@/lib/weighted-score";

const AREAS: PracticeAreaCode[] = ["MATH", "READING", "WRITING"];

/**
 * Parent home: each linked student's results by skill (same SkillResults as the teacher and the
 * student: last attempt of each set, weighted by questions) and practice sets with the LAST attempt
 * of each (same accordion).
 */
export default async function ParentDashboardPage() {
  const session = await auth();
  const links = await prisma.parentStudent.findMany({
    where: { parentId: session!.user.id },
    include: {
      student: {
        include: {
          attempts: {
            where: { status: "SUBMITTED", assignmentId: { not: null } },
            include: {
              answers: { select: { answer: true, isCorrect: true } },
              assignment: { select: { practiceSet: { select: { name: true, difficulty: true, topicId: true, topic: { select: { name: true } }, source: { select: { name: true, sortOrder: true } }, _count: { select: { questions: true } } } } } },
            },
            orderBy: { submittedAt: "desc" },
          },
        },
      },
    },
  });
  // Results by skill per area, per linked student (only areas with results are shown).
  const reports = new Map(
    await Promise.all(
      links.map(async (link) => [link.studentId, (await Promise.all(AREAS.map((area) => loadPracticeReport(link.studentId, area, {})))).filter((r) => r.skillResults.length > 0)] as const),
    ),
  );

  return (
    <PageShell width="default">
      <PageHeader title="Your student's progress" />
      <PageContent>
        {links.length === 0 ? (
          <EmptyState
            title="No students yet"
            description="When a teacher links your account to a student, you'll see their progress here."
          />
        ) : (
          <div className="space-y-4">
            {links.map((link) => {
              const attempts = link.student.attempts;
              const sets = new Map<string, GroupableSet>();
              for (const attempt of attempts) {
                const practiceSet = attempt.assignment!.practiceSet;
                const key = attempt.assignmentId!;
                const set =
                  sets.get(key) ??
                  sets
                    .set(key, {
                      key,
                      title: practiceSetTitle(practiceSet.name, practiceSet.difficulty),
                      tries: [],
                      // Skill → source → sets, like the teacher and student views.
                      skillId: practiceSet.topicId,
                      skillName: practiceSet.topic.name,
                      sourceName: practiceSet.source?.name ?? null,
                      sourceOrder: practiceSet.source?.sortOrder ?? null,
                    })
                    .get(key)!;
                const score = summarizeAllQuestionAnswers(attempt.answers);
                const total = Math.max(score.total, practiceSet._count.questions);
                set.tries.push({
                  id: attempt.id,
                  tryNumber: attempt.attemptNumber,
                  submittedAt: attempt.submittedAt,
                  correct: score.correct,
                  total,
                  pct: attempt.scorePercent ?? (total ? Math.round((score.correct / total) * 100) : null),
                  time: attempt.totalTime,
                  status: attempt.status,
                });
              }
              const groups = practiceSetGroups([...sets.values()]);
              return (
                <Card key={link.studentId} padding="md">
                  <h2 className="text-base font-semibold text-foreground">{link.student.name}</h2>
                  <p className="mb-3 mt-1 text-sm text-muted-foreground">
                    {groups.length} practice set{groups.length === 1 ? "" : "s"} finished · each row shows the last attempt
                  </p>
                  {groups.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No practice finished yet.</p>
                  ) : (
                    <div className="space-y-5">
                      {(reports.get(link.studentId) ?? []).map((report) => (
                        <SkillResults key={report.practiceArea} report={report} id={`skills-${link.studentId}-${report.practiceArea}`} />
                      ))}
                      <PracticeSetAttemptsAccordion sets={groups} />
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </PageContent>
    </PageShell>
  );
}
