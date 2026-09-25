import { PageShell, PageHeader, PageContent, PracticeAreaTabs } from "@/components/sat";
import Link from "next/link";
import { notFound } from "next/navigation";
import prisma from "@/lib/prisma";
import { requireTeacherOrAdmin } from "@/lib/rbac";
import { studentAccessWhereFor } from "@/lib/program-scope";
import { formatTime, scorePercent } from "@/lib/utils";
import { scoreBandTextClass } from "@/lib/score-band";
import { Card } from "@/components/ui/card";
import { AnalyticsStudentFilter } from "./analytics-student-filter";
import { DifficultyAccuracyChart, MockSectionChart, TopicDifficultyChart } from "@/components/progress-charts";
import { aggregateDifficultyMetrics, aggregateTopicDifficultyMetrics } from "@/lib/progress-analytics";
import {
  activeAreaTab,
  practiceAreaFromTab,
  practiceAreaLabel,
} from "@/lib/practice-area";

interface PageProps {
  searchParams: Promise<{ studentId?: string; area?: string }>;
}

interface Bucket {
  key: string;
  label: string;
  section: string;
  difficulty: string;
  correct: number;
  total: number;
  totalTime: number;
  timed: number;
}

export default async function TeacherAnalyticsPage({ searchParams }: PageProps) {
  const session = await requireTeacherOrAdmin();
  if (!session) notFound();
  const params = await searchParams;
  const area = activeAreaTab(params.area, "math");
  const practiceArea = practiceAreaFromTab(area);
  const studentScope = studentAccessWhereFor(session.user);

  const students = await prisma.user.findMany({
    where: studentScope,
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
  const selectedStudentId =
    params.studentId && students.some((student) => student.id === params.studentId)
      ? params.studentId
      : students[0]?.id;

  const answers =
    selectedStudentId && practiceArea
      ? await prisma.attemptAnswer.findMany({
          where: {
            attempt: { studentId: selectedStudentId, status: "SUBMITTED" },
            question: { topic: { domain: { practiceArea } } },
          },
          include: {
            question: {
              include: {
                topic: { include: { domain: { include: { section: true } } } },
              },
            },
            attempt: {
              select: {
                id: true,
                submittedAt: true,
                totalTime: true,
                assignment: { select: { practiceSet: { select: { name: true } } } },
              },
            },
          },
          orderBy: { attempt: { submittedAt: "desc" } },
        })
      : [];

  const examAttempts =
    selectedStudentId && area === "mocks"
      ? await prisma.fullPracticeTestAttempt.findMany({
          where: { studentId: selectedStudentId, status: "SUBMITTED" },
          include: {
            answers: true,
            test: {
              include: {
                modules: {
                  include: { questions: { include: { question: { include: { topic: true } } } } },
                },
              },
            },
          },
          orderBy: { submittedAt: "asc" },
          take: 20,
        })
      : [];
  const buckets = new Map<string, Bucket>();
  const progressRows: Array<{ topic: string; difficulty: string; correct: boolean; timeSeconds: number; attemptId: string }> = [];

  for (const answer of answers) {
    const areaLabel = practiceAreaLabel(answer.question.topic.domain.practiceArea);
    const subtopic = answer.question.topic.name;
    progressRows.push({
      topic: answer.question.topic.name,
      difficulty: answer.question.difficulty,
      correct: Boolean(answer.isCorrect),
      timeSeconds: answer.timeSpent ?? 0,
      attemptId: answer.attempt.id,
    });
    const key = `${areaLabel}:${subtopic}:${answer.question.difficulty}`;
    const bucket = buckets.get(key) ?? {
      key,
      label: subtopic,
      section: areaLabel,
      difficulty: answer.question.difficulty,
      correct: 0,
      total: 0,
      totalTime: 0,
      timed: 0,
    };
    bucket.total += 1;
    if (answer.isCorrect) bucket.correct += 1;
    if (answer.timeSpent) {
      bucket.totalTime += answer.timeSpent;
      bucket.timed += 1;
    }
    buckets.set(key, bucket);
  }

  const weakSubtopics = [...buckets.values()]
    .filter((bucket) => bucket.total > 0)
    .sort((a, b) => scorePercent(a.correct, a.total) - scorePercent(b.correct, b.total) || b.total - a.total)
    .slice(0, 12);
  const correct = answers.filter((answer) => answer.isCorrect).length;
  const avgAccuracy = answers.length ? scorePercent(correct, answers.length) : null;
  const attemptCount = new Set(answers.map((answer) => answer.attempt.id)).size;
  const timedAnswers = answers.filter((answer) => answer.timeSpent);
  const avgResponseTime = timedAnswers.length
    ? Math.round(timedAnswers.reduce((sum, answer) => sum + (answer.timeSpent ?? 0), 0) / timedAnswers.length)
    : null;
  const difficultyMetrics = aggregateDifficultyMetrics(progressRows);
  const topicDifficultyMetrics = aggregateTopicDifficultyMetrics(progressRows);
  const mockProgressRows = examAttempts.flatMap((exam) => {
    const questions = new Map(
      exam.test.modules.flatMap((module) => module.questions).map((item) => [item.questionId, item.question]),
    );
    return exam.answers.map((answer) => {
      const question = questions.get(answer.questionId);
      return {
        topic: question?.topic.name ?? "Unclassified topic",
        difficulty: question?.difficulty ?? "UNSPECIFIED",
        correct: Boolean(answer.isCorrect),
        timeSeconds: answer.timeSpent ?? 0,
        attemptId: exam.id,
      };
    });
  });
  const mockDifficultyMetrics = aggregateDifficultyMetrics(mockProgressRows);
  const mockTopicDifficultyMetrics = aggregateTopicDifficultyMetrics(mockProgressRows);

  return (
    <PageShell width="wide">
      <PageHeader
        title="Student Analytics"
        description="Individual progress by Math, Reading, Writing, or Full Practice Tests."
        actions={
          <div className="flex flex-wrap items-end gap-2">
            <AnalyticsStudentFilter
              students={students.map((student) => ({ id: student.id, name: student.name }))}
              selectedStudentId={selectedStudentId ?? ""}
              area={area}
            />
            <Link
              href="/teacher/compare"
              className="rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-blue-600 hover:bg-gray-50"
            >
              Compare students
            </Link>
          </div>
        }
      />
      <PageContent>
      <PracticeAreaTabs
        basePath="/teacher/analytics"
        active={area}
        preserve={{ studentId: selectedStudentId }}
      />

      {area === "mocks" ? (
        <MocksAnalyticsPanel
          examAttempts={examAttempts}
          difficultyMetrics={mockDifficultyMetrics}
          topicDifficultyMetrics={mockTopicDifficultyMetrics}
        />
      ) : (
        <>
          <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
            <Metric label="Questions answered" value={answers.length.toString()} />
            <Metric
              label="Accuracy"
              value={avgAccuracy !== null ? `${avgAccuracy}%` : "-"}
              valueClassName={avgAccuracy !== null ? scoreBandTextClass(avgAccuracy) : undefined}
              sub={answers.length ? `${correct} of ${answers.length} correct` : undefined}
            />
            <Metric label="Practice attempts" value={attemptCount.toString()} />
            <Metric label="Avg response time" value={avgResponseTime !== null ? formatTime(avgResponseTime) : "-"} />
          </div>

          <div className="mb-6">
            <DifficultyAccuracyChart metrics={difficultyMetrics} />
          </div>
          <div className="mb-8">
            <TopicDifficultyChart metrics={topicDifficultyMetrics} />
          </div>

          <section className="mb-8">
            <div className="mb-3">
              <h2 className="text-base font-semibold text-gray-900">Skill performance by difficulty</h2>
              <p className="mt-0.5 text-xs text-gray-500">Lowest-accuracy skills for this student, ranked by difficulty.</p>
            </div>
            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
              <table className="w-full min-w-[44rem] text-sm">
                <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                  <tr>
                    <th className="px-4 py-3 text-left">Skill</th>
                    <th className="px-4 py-3 text-left">Area</th>
                    <th className="px-4 py-3 text-left">Difficulty</th>
                    <th className="px-4 py-3 text-right">Accuracy</th>
                    <th className="px-4 py-3 text-right">Avg time</th>
                    <th className="px-4 py-3 text-left">Reinforcement</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {weakSubtopics.map((bucket) => {
                    const pct = scorePercent(bucket.correct, bucket.total);
                    return (
                      <tr key={bucket.key}>
                        <td className="px-4 py-3 font-medium text-gray-800">{bucket.label}</td>
                        <td className="px-4 py-3 text-gray-500">{bucket.section}</td>
                        <td className="px-4 py-3 text-gray-500">{bucket.difficulty}</td>
                        <td className={`px-4 py-3 text-right font-medium ${scoreBandTextClass(pct)}`}>{pct}% ({bucket.correct}/{bucket.total})</td>
                        <td className="px-4 py-3 text-right text-gray-500">{bucket.timed ? formatTime(Math.round(bucket.totalTime / bucket.timed)) : "-"}</td>
                        <td className="px-4 py-3 text-gray-600">{recommendation(bucket.label, pct)}</td>
                        <td className="px-4 py-3 text-right">
                          {selectedStudentId && (
                            <Link href={`/teacher/students/${selectedStudentId}/assign`} className="whitespace-nowrap text-xs font-medium text-blue-600 hover:underline">
                              Assign practice
                            </Link>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              </div>
              {weakSubtopics.length === 0 && (
                <p className="py-10 text-center text-sm text-gray-500">
                  No submitted {practiceAreaLabel(practiceArea).toLowerCase()} answers for this student yet.
                </p>
              )}
            </Card>
          </section>
        </>
      )}

      </PageContent>
    </PageShell>
  );
}

function MocksAnalyticsPanel({
  examAttempts,
  difficultyMetrics,
  topicDifficultyMetrics,
}: {
  examAttempts: Array<{
    id: string;
    test: { name: string; modules: Array<{ questions: Array<{ questionId: string; question: { difficulty: string; topic: { name: string } } }> }> };
    answers: Array<{ questionId: string; isCorrect: boolean | null; timeSpent: number | null }>;
    submittedAt: Date | null;
    mathScore: number | null;
    rwScore: number | null;
    totalScore: number | null;
  }>;
  difficultyMetrics: ReturnType<typeof aggregateDifficultyMetrics>;
  topicDifficultyMetrics: ReturnType<typeof aggregateTopicDifficultyMetrics>;
}) {
  return (
    <>
      <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-3">
        <Metric label="Exams completed" value={examAttempts.length.toString()} />
        <Metric
          label="Latest total"
          value={examAttempts.length ? String(examAttempts[examAttempts.length - 1]?.totalScore ?? "-") : "-"}
          valueClassName="text-[var(--sat-area-mocks)]"
        />
        <Metric label="Assessment type" value="Full Practice Tests" />
      </div>
      <div className="mb-8">
        <MockSectionChart
          metrics={examAttempts.map((exam) => ({
            attempts: 1,
            label: exam.test.name,
            submittedAt: exam.submittedAt?.toISOString() ?? null,
            mathScore: exam.mathScore,
            rwScore: exam.rwScore,
            totalScore: exam.totalScore,
          }))}
        />
      </div>
      <div className="mb-6">
        <DifficultyAccuracyChart metrics={difficultyMetrics} />
      </div>
      <div className="mb-8">
        <TopicDifficultyChart metrics={topicDifficultyMetrics} />
      </div>
      {examAttempts.length === 0 && (
        <Card padding="lg" className="py-12 text-center text-sm text-gray-400">
          No submitted Full Practice Tests for this student yet.
        </Card>
      )}
    </>
  );
}

function Metric({ label, value, valueClassName, sub }: { label: string; value: string; valueClassName?: string; sub?: string }) {
  return (
    <Card padding="md">
      <p className="text-xs font-medium uppercase text-gray-500">{label}</p>
      <p className={`mt-1 truncate text-2xl font-semibold ${valueClassName ?? "text-gray-900"}`}>{value}</p>
      {sub ? <p className="mt-0.5 text-xs text-gray-500">{sub}</p> : null}
    </Card>
  );
}

function recommendation(label: string, pct: number) {
  if (pct < 50) return `Re-teach ${label} and assign Easy targeted practice.`;
  if (pct < 75) return `Review mistakes in ${label} before moving difficulty.`;
  return `Monitor ${label}; assign a short reinforcement set.`;
}
