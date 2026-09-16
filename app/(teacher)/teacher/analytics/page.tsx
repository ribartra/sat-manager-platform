import { PageShell, PageHeader, PageContent, PracticeAreaTabs } from "@/components/sat";
import Link from "next/link";
import { notFound } from "next/navigation";
import prisma from "@/lib/prisma";
import { requireTeacherOrAdmin } from "@/lib/rbac";
import { studentAccessWhereFor } from "@/lib/program-scope";
import { formatDate, formatTime, scorePercent } from "@/lib/utils";
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
    select: { id: true, name: true, lastActiveAt: true },
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
                subskill: true,
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

  const selectedStudent = students.find((student) => student.id === selectedStudentId);
  const examAttempts =
    selectedStudentId && area === "mocks"
      ? await prisma.fullPracticeTestAttempt.findMany({
          where: { studentId: selectedStudentId, status: "SUBMITTED" },
          include: { test: { select: { name: true } } },
          orderBy: { submittedAt: "asc" },
          take: 20,
        })
      : [];
  const nowMs = new Date().getTime();
  const staleStudents = students.filter((student) => {
    if (!student.lastActiveAt) return true;
    return nowMs - student.lastActiveAt.getTime() >= 5 * 24 * 60 * 60 * 1000;
  });
  const buckets = new Map<string, Bucket>();
  const progressRows: Array<{ topic: string; difficulty: string; correct: boolean; timeSeconds: number }> = [];

  for (const answer of answers) {
    const areaLabel = practiceAreaLabel(answer.question.topic.domain.practiceArea);
    const subtopic = answer.question.subskill?.name ?? answer.question.topic.name;
    progressRows.push({
      topic: answer.question.topic.name,
      difficulty: answer.question.difficulty,
      correct: Boolean(answer.isCorrect),
      timeSeconds: answer.timeSpent ?? 0,
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
  const difficultyMetrics = aggregateDifficultyMetrics(progressRows);
  const topicDifficultyMetrics = aggregateTopicDifficultyMetrics(progressRows);

  return (
    <PageShell>
      <PageHeader
        title="Student Analytics"
        description="Individual progress by Math, Reading, Writing, or Mocks."
        actions={
          <AnalyticsStudentFilter
            students={students.map((student) => ({ id: student.id, name: student.name }))}
            selectedStudentId={selectedStudentId ?? ""}
            area={area}
          />
        }
      />
      <PageContent>
      <PracticeAreaTabs
        basePath="/teacher/analytics"
        active={area}
        preserve={{ studentId: selectedStudentId }}
      />

      {area === "mocks" ? (
        <MocksAnalyticsPanel examAttempts={examAttempts} selectedStudentName={selectedStudent?.name} />
      ) : (
        <>
          <div className="mb-6 grid grid-cols-4 gap-4">
            <Metric label="Student" value={selectedStudent?.name ?? "-"} />
            <Metric label="Answers" value={answers.length.toString()} />
            <Metric
              label="Average Accuracy"
              value={avgAccuracy !== null ? `${avgAccuracy}%` : "-"}
              valueClassName={avgAccuracy !== null ? scoreBandTextClass(avgAccuracy) : undefined}
            />
            <Metric label="Inactive 5+ Days" value={staleStudents.length.toString()} />
          </div>

          <div className="mb-8 grid gap-6 lg:grid-cols-2">
            <DifficultyAccuracyChart metrics={difficultyMetrics} />
            <TopicDifficultyChart metrics={topicDifficultyMetrics} />
          </div>

          <section className="mb-8">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-semibold text-gray-900">Skills With Most Errors</h2>
              <Link href="/teacher/compare" className="text-sm text-blue-600 hover:underline">Compare students</Link>
            </div>
            <Card className="overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                  <tr>
                    <th className="px-4 py-3 text-left">Skill</th>
                    <th className="px-4 py-3 text-left">Area</th>
                    <th className="px-4 py-3 text-left">Difficulty</th>
                    <th className="px-4 py-3 text-right">Accuracy</th>
                    <th className="px-4 py-3 text-right">Avg Time</th>
                    <th className="px-4 py-3 text-left">Reinforcement</th>
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
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {weakSubtopics.length === 0 && (
                <p className="py-10 text-center text-sm text-gray-400">
                  No submitted {practiceAreaLabel(practiceArea).toLowerCase()} answers for this student yet.
                </p>
              )}
            </Card>
          </section>

          <section>
            <h2 className="mb-3 text-base font-semibold text-gray-900">Students inactive for 5+ days</h2>
            <Card>
              {staleStudents.slice(0, 12).map((student) => (
                <div key={student.id} className="flex items-center justify-between border-b border-gray-100 px-4 py-3 text-sm last:border-b-0">
                  <span className="font-medium text-gray-800">{student.name}</span>
                  <span className="text-gray-500">{student.lastActiveAt ? formatDate(student.lastActiveAt) : "No activity"}</span>
                </div>
              ))}
              {staleStudents.length === 0 && <p className="p-6 text-center text-sm text-gray-400">All students have recent activity.</p>}
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
  selectedStudentName,
}: {
  examAttempts: Array<{
    id: string;
    test: { name: string };
    submittedAt: Date | null;
    mathScore: number | null;
    rwScore: number | null;
    totalScore: number | null;
  }>;
  selectedStudentName?: string;
}) {
  return (
    <>
      <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
        <Metric label="Student" value={selectedStudentName ?? "-"} />
        <Metric label="Mocks completed" value={examAttempts.length.toString()} />
        <Metric
          label="Latest total"
          value={examAttempts.length ? String(examAttempts[examAttempts.length - 1]?.totalScore ?? "-") : "-"}
        />
        <Metric label="Area" value="Mocks" valueClassName="text-[var(--sat-area-mocks)]" />
      </div>
      <div className="mb-8">
        <MockSectionChart
          metrics={examAttempts.map((exam) => ({
            label: exam.test.name,
            submittedAt: exam.submittedAt?.toISOString() ?? null,
            mathScore: exam.mathScore,
            rwScore: exam.rwScore,
            totalScore: exam.totalScore,
          }))}
        />
      </div>
      {examAttempts.length === 0 && (
        <Card padding="lg" className="py-12 text-center text-sm text-gray-400">
          No submitted Full Practice Tests for this student yet.
        </Card>
      )}
    </>
  );
}

function Metric({ label, value, valueClassName }: { label: string; value: string; valueClassName?: string }) {
  return (
    <Card padding="md">
      <p className="text-xs font-medium uppercase text-gray-400">{label}</p>
      <p className={`mt-1 truncate text-2xl font-semibold ${valueClassName ?? "text-gray-900"}`}>{value}</p>
    </Card>
  );
}

function recommendation(label: string, pct: number) {
  if (pct < 50) return `Re-teach ${label} and assign Easy targeted practice.`;
  if (pct < 75) return `Review mistakes in ${label} before moving difficulty.`;
  return `Monitor ${label}; assign a short reinforcement set.`;
}
