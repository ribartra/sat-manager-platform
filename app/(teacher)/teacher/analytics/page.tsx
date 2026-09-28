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
import { ProgressFilters } from "@/components/progress-filters";
import { TopicDifficultyTrend } from "@/components/topic-difficulty-trend";
import { MockSectionChart } from "@/components/progress-charts";
import { PerformanceBreakdown } from "@/components/performance-breakdown";
import { aggregateDifficultyMetrics, aggregateTopicDifficultyMetrics, aggregateTopicDifficultyTrend } from "@/lib/progress-analytics";
import {
  practiceAreaFromTab,
  practiceAreaLabel,
} from "@/lib/practice-area";
import { buildProgressHref, progressDateWhere, progressFiltersFromParams } from "@/lib/progress-filters";
import { refreshAssignmentStates } from "@/lib/assignments";

interface PageProps {
  searchParams: Promise<{ studentId?: string; area?: string; topic?: string; difficulty?: string; from?: string; to?: string }>;
}

interface Bucket {
  key: string;
  label: string;
  topicId: string;
  domainId: string;
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
  const filters = progressFiltersFromParams(params);
  const area = filters.area;
  const practiceArea = practiceAreaFromTab(area);
  const topicId = filters.topic ?? "";
  const difficulty = filters.difficulty ?? "";
  const dateFilter = progressDateWhere(filters);
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

  const topics = practiceArea
    ? await prisma.topic.findMany({ where: { domain: { practiceArea } }, select: { id: true, name: true }, orderBy: { name: "asc" } })
    : [];
  const practiceAttempts = selectedStudentId && practiceArea
    ? await prisma.attempt.findMany({
        where: {
          studentId: selectedStudentId,
          status: "SUBMITTED",
          ...dateFilter,
          assignment: { practiceSet: { topic: { domain: { practiceArea } } } },
        },
        include: {
          answers: { include: { question: { include: { topic: { include: { domain: { include: { section: true } } } } } } } },
          assignment: {
            include: {
              practiceSet: {
                include: {
                  questions: { include: { question: { include: { topic: { include: { domain: { include: { section: true } } } } } } } },
                },
              },
            },
          },
        },
        orderBy: { submittedAt: "desc" },
      })
    : [];

  const progressRows = practiceAttempts.flatMap((attempt) => {
    const answersByQuestion = new Map(attempt.answers.map((answer) => [answer.questionId, answer]));
    const questions = attempt.assignment?.practiceSet.questions ?? [];
    const sources = questions.length
      ? questions.map((item) => ({ question: item.question, answer: answersByQuestion.get(item.questionId) }))
      : attempt.answers.map((answer) => ({ question: answer.question, answer }));
    return sources
      .filter(({ question }) => (!topicId || question.topicId === topicId) && (!difficulty || question.difficulty === difficulty))
      .map(({ question, answer }) => ({
        topic: question.topic.name,
        topicId: question.topicId,
        domainId: question.topic.domainId,
        difficulty: question.difficulty,
        correct: answer?.isCorrect === true,
        timeSeconds: answer?.timeSpent ?? 0,
        attemptId: attempt.id,
        attemptLabel: attempt.assignment?.practiceSet.name ?? "Practice set",
        submittedAt: attempt.submittedAt,
      }));
  });

  const examAttempts =
    selectedStudentId && area === "mocks"
      ? await prisma.fullPracticeTestAttempt.findMany({
          where: { studentId: selectedStudentId, status: "SUBMITTED", ...dateFilter },
          include: {
            answers: true,
            test: {
              include: {
                modules: {
                  include: { questions: { include: { question: { include: { topic: true } } } } },
                  orderBy: { order: "asc" },
                },
              },
            },
          },
          orderBy: { submittedAt: "asc" },
          take: 20,
        })
      : [];
  const buckets = new Map<string, Bucket>();
  for (const row of progressRows) {
    const areaLabel = practiceAreaLabel(practiceArea);
    const subtopic = row.topic;
    const key = `${areaLabel}:${subtopic}:${row.difficulty}`;
    const bucket = buckets.get(key) ?? {
      key,
      label: subtopic,
      topicId: row.topicId,
      domainId: row.domainId,
      section: areaLabel,
      difficulty: row.difficulty,
      correct: 0,
      total: 0,
      totalTime: 0,
      timed: 0,
    };
    bucket.total += 1;
    if (row.correct) bucket.correct += 1;
    if (row.timeSeconds) {
      bucket.totalTime += row.timeSeconds;
      bucket.timed += 1;
    }
    buckets.set(key, bucket);
  }

  const weakSubtopics = [...buckets.values()]
    .filter((bucket) => bucket.total > 0)
    .sort((a, b) => scorePercent(a.correct, a.total) - scorePercent(b.correct, b.total) || b.total - a.total)
    .slice(0, 12);

  // "Assign practice" only where assigning makes sense for this student: a published set of that
  // skill + difficulty that is unassigned, completed (retake) or overdue. Sets still pending or in
  // progress are shown as such instead (assigning again would only update their settings).
  if (selectedStudentId && weakSubtopics.length > 0) await refreshAssignmentStates();
  const weakTopicIds = [...new Set(weakSubtopics.map((bucket) => bucket.topicId))];
  const setsForWeakSkills = selectedStudentId && weakTopicIds.length > 0
    ? await prisma.practiceSet.findMany({
        where: { topicId: { in: weakTopicIds }, status: "PUBLISHED" },
        select: {
          id: true,
          topicId: true,
          difficulty: true,
          assignments: { where: { studentId: selectedStudentId }, select: { status: true } },
        },
        orderBy: { createdAt: "asc" },
      })
    : [];
  const assignOptionFor = (bucket: Bucket) => {
    const sets = setsForWeakSkills.filter((set) => set.topicId === bucket.topicId && set.difficulty === bucket.difficulty);
    const assignable = sets.filter((set) => !set.assignments[0] || ["COMPLETED", "OVERDUE"].includes(set.assignments[0].status));
    return { assignableIds: assignable.map((set) => set.id), pendingCount: sets.length - assignable.length };
  };
  const correct = progressRows.filter((row) => row.correct).length;
  const avgAccuracy = progressRows.length ? scorePercent(correct, progressRows.length) : null;
  const attemptCount = new Set(progressRows.map((row) => row.attemptId)).size;
  const timedAnswers = progressRows.filter((row) => row.timeSeconds);
  const avgResponseTime = timedAnswers.length
    ? Math.round(timedAnswers.reduce((sum, row) => sum + row.timeSeconds, 0) / timedAnswers.length)
    : null;
  const difficultyMetrics = aggregateDifficultyMetrics(progressRows);
  const topicDifficultyMetrics = aggregateTopicDifficultyMetrics(progressRows);
  const trendAttempts = practiceAttempts
    .filter((attempt) => new Set(progressRows.map((row) => row.attemptId)).has(attempt.id))
    .map((attempt) => ({ id: attempt.id, label: attempt.assignment?.practiceSet.name ?? "Practice set", submittedAt: attempt.submittedAt }));
  const topicTrend = aggregateTopicDifficultyTrend(
    progressRows.map((row) => ({ topic: row.topic, difficulty: row.difficulty, correct: row.correct, attemptId: row.attemptId })),
    trendAttempts,
  );
  const trendTopics = Object.keys(topicTrend);
  const mockProgressRows = examAttempts.flatMap((exam) => {
    return exam.test.modules.flatMap((module) => {
      const answersByQuestion = new Map(exam.answers.map((answer) => [answer.questionId, answer]));
      const section = module.section === "RW" ? "Reading & Writing" : "Math";
      return module.questions.map((item) => {
        const answer = answersByQuestion.get(item.questionId);
        return {
          topic: section,
          difficulty: module.name,
          correct: answer?.isCorrect === true,
          timeSeconds: answer?.timeSpent ?? 0,
          attemptId: exam.id,
          attemptLabel: exam.test.name,
          submittedAt: exam.submittedAt,
        };
      });
    });
  });
  const mockModuleMetrics = aggregateDifficultyMetrics(mockProgressRows);
  const mockSectionModuleMetrics = aggregateTopicDifficultyMetrics(mockProgressRows);
  const mockModules = [...new Set(mockProgressRows.map((row) => row.difficulty))];

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
              preserve={{ topic: filters.topic, difficulty: filters.difficulty, from: filters.from, to: filters.to }}
            />
            <Link
              href={buildProgressHref("/teacher/compare", filters)}
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
        preserve={{ studentId: selectedStudentId, difficulty: filters.difficulty, from: filters.from, to: filters.to }}
      />
      <p className="mb-3 text-xs text-gray-500">Roster-wide signal · filtered to the selected student, area and progress dimensions.</p>
      <ProgressFilters action="/teacher/analytics" filters={{ ...filters, studentId: selectedStudentId }} topics={topics} />

      {area === "mocks" ? (
        <MocksAnalyticsPanel
          examAttempts={examAttempts}
          moduleMetrics={mockModuleMetrics}
          sectionModuleMetrics={mockSectionModuleMetrics}
          modules={mockModules}
        />
      ) : (
        <>
          <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
            <Metric label="Questions" value={progressRows.length.toString()} />
            <Metric
              label="Accuracy"
              value={avgAccuracy !== null ? `${avgAccuracy}%` : "-"}
              valueClassName={avgAccuracy !== null ? scoreBandTextClass(avgAccuracy) : undefined}
              sub={progressRows.length ? `${correct} correct of ${progressRows.length} questions` : undefined}
            />
            <Metric label="Practice attempts" value={attemptCount.toString()} />
            <Metric label="Avg question time" value={avgResponseTime !== null ? formatTime(avgResponseTime) : "-"} />
          </div>

          <div className="mb-8">
            <PerformanceBreakdown
              title="Performance by skill and difficulty"
              rowLabel="Skill"
              dimensionLabel="difficulty"
              dimensions={difficulty ? [difficulty] : ["EASY", "MEDIUM", "HARD"]}
              summaryMetrics={difficultyMetrics}
              detailMetrics={topicDifficultyMetrics}
            />
          </div>

          {topicId && difficulty && trendTopics.length > 0 && trendAttempts.length > 0 && (
            <div className="mb-8">
              <TopicDifficultyTrend
                topics={trendTopics}
                pointsByTopic={topicTrend}
                selectedTopic={topics.find((topic) => topic.id === topicId)?.name ?? trendTopics[0]}
                selectedDifficulty={difficulty}
              />
            </div>
          )}

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
                    <th className="px-4 py-3 text-right">Avg question time</th>
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
                          {selectedStudentId && (() => {
                            const option = assignOptionFor(bucket);
                            if (option.assignableIds.length > 0) {
                              const href = buildProgressHref(`/teacher/students/${selectedStudentId}/assign`, filters, {
                                topic: bucket.topicId,
                                difficulty: bucket.difficulty,
                              });
                              const extra = new URLSearchParams({ domain: bucket.domainId, sets: option.assignableIds.join(",") });
                              return (
                                <Link href={`${href}${href.includes("?") ? "&" : "?"}${extra.toString()}`} className="whitespace-nowrap text-xs font-medium text-blue-600 hover:underline">
                                  Assign practice
                                </Link>
                              );
                            }
                            if (option.pendingCount > 0) {
                              return (
                                <Link href={`/teacher/students/${selectedStudentId}`} className="whitespace-nowrap text-xs text-gray-400 hover:underline" title="Already assigned and not finished yet">
                                  Pending ({option.pendingCount})
                                </Link>
                              );
                            }
                            return null;
                          })()}
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
  moduleMetrics,
  sectionModuleMetrics,
  modules,
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
  moduleMetrics: ReturnType<typeof aggregateDifficultyMetrics>;
  sectionModuleMetrics: ReturnType<typeof aggregateTopicDifficultyMetrics>;
  modules: string[];
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
      <div className="mb-8">
        <PerformanceBreakdown
          title="Performance by section and module"
          rowLabel="Section"
          dimensionLabel="module"
          dimensions={modules}
          summaryMetrics={moduleMetrics}
          detailMetrics={sectionModuleMetrics}
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
