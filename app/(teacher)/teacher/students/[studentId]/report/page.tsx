import { PageShell, PracticeAreaTabs } from "@/components/sat";
import prisma from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";
import { formatDate, formatTime, scorePercent } from "@/lib/utils";
import { scoreBandTextClass } from "@/lib/score-band";
import { parseSnapshot, PracticeSetSnapshot, QuestionSnapshot } from "@/lib/attempt-snapshots";
import { auth } from "@/lib/auth";
import { studentAccessWhereFor } from "@/lib/program-scope";
import { Card } from "@/components/ui/card";
import { MockSectionChart } from "@/components/progress-charts";
import { PerformanceBreakdown } from "@/components/performance-breakdown";
import { ProgressFilters } from "@/components/progress-filters";
import { TopicDifficultyTrend } from "@/components/topic-difficulty-trend";
import { aggregateDifficultyMetrics, aggregateTopicDifficultyMetrics, type MockSectionMetric } from "@/lib/progress-analytics";
import { sumAttemptElapsedTime, summarizeAllQuestionAnswers } from "@/lib/weighted-score";
import { aggregateTopicDifficultyTrend } from "@/lib/progress-analytics";
import { buildProgressHref, progressDateWhere, progressFiltersFromParams } from "@/lib/progress-filters";
import {
  practiceAreaFromTab,
  practiceAreaLabel,
} from "@/lib/practice-area";

interface PageProps {
  params: Promise<{ studentId: string }>;
  searchParams: Promise<{ area?: string; topic?: string; difficulty?: string; from?: string; to?: string }>;
}

type TopicStat = { correct: number; total: number; attempts: number; attemptIds: Set<string> };
type ReportQuestionRow = {
  questionId: string;
  topicId: string;
  topicName: string;
  difficulty: string;
  answer: string | null;
  isCorrect: boolean;
  attemptId: string;
  imageUrl: string | null;
  stem: string;
};

export default async function StudentReportPage({ params, searchParams }: PageProps) {
  const { studentId } = await params;
  const query = await searchParams;
  const filters = progressFiltersFromParams(query);
  const area = filters.area;
  const practiceArea = practiceAreaFromTab(area);
  const topicId = filters.topic ?? "";
  const difficulty = filters.difficulty ?? "";
  const dateFilter = progressDateWhere(filters);
  const session = await auth();
  const studentWhere = session
    ? studentAccessWhereFor(session.user)
    : { role: "STUDENT", active: true, validationStatus: "APPROVED" };
  const student = await prisma.user.findFirst({
    where: {
      id: studentId,
      ...studentWhere,
    },
  });
  if (!student) notFound();

  const topics = practiceArea
    ? await prisma.topic.findMany({
        where: { domain: { practiceArea } },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      })
    : [];

  const examAttempts = await prisma.fullPracticeTestAttempt.findMany({
    where: { studentId, status: "SUBMITTED", ...dateFilter },
    include: {
      answers: true,
      test: {
        include: {
          modules: {
            include: {
              questions: {
                include: {
                  question: { include: { topic: { include: { domain: true } } } },
                },
              },
            },
            orderBy: { order: "asc" },
          },
        },
      },
    },
    orderBy: { submittedAt: "desc" },
  });

  const mockMetrics: MockSectionMetric[] = examAttempts.map((exam) => ({
    attempts: 1,
    label: exam.test.name,
    submittedAt: exam.submittedAt?.toISOString() ?? null,
    mathScore: exam.mathScore,
    rwScore: exam.rwScore,
    totalScore: exam.totalScore,
  }));
  const mockProgressRows = examAttempts.flatMap((exam) =>
    exam.test.modules.flatMap((module) => {
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
    }),
  );
  const mockModuleMetrics = aggregateDifficultyMetrics(mockProgressRows);
  const mockSectionModuleMetrics = aggregateTopicDifficultyMetrics(mockProgressRows);
  const mockModules = [...new Set(mockProgressRows.map((row) => row.difficulty))];
  const pdfParams = new URLSearchParams({
    areas: area === "math" ? "mathematics" : area === "reading" || area === "writing" ? area : "mathematics,reading,writing",
  });
  for (const key of ["topic", "difficulty", "from", "to"] as const) {
    if (filters[key]) pdfParams.set(key, filters[key]!);
  }
  const pdfHref = `/api/reports/students/${studentId}/pdf?${pdfParams.toString()}`;

  if (area === "mocks") {
    return (
      <PageShell>
        <div className="mb-6 flex items-center justify-between">
          <div>
            <Link href={buildProgressHref(`/teacher/students/${studentId}`, filters)} className="text-sm text-blue-600 hover:underline">
              ← Student
            </Link>
            <h1 className="mt-2 text-xl font-semibold text-gray-900">Individual Report: {student.name}</h1>
          </div>
          <Link href={pdfHref} className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
            Download PDF
          </Link>
        </div>
        <PracticeAreaTabs basePath={`/teacher/students/${studentId}/report`} active={area} preserve={{ difficulty: filters.difficulty, from: filters.from, to: filters.to }} />
        <ProgressFilters action={`/teacher/students/${studentId}/report`} filters={filters} topics={[]} />
        <section>
          <h2 className="mb-4 text-lg font-semibold text-[var(--sat-area-mocks)]">Full Practice Tests</h2>
          <div className="mb-6 grid gap-4 md:grid-cols-3">
            <Card padding="md">
              <p className="text-2xl font-bold">{examAttempts.length}</p>
              <p className="text-xs text-gray-500">Completed exams</p>
            </Card>
            <Card padding="md">
              <p className="text-2xl font-bold">{examAttempts[0]?.totalScore ?? "-"}</p>
              <p className="text-xs text-gray-500">Latest total score</p>
            </Card>
            <Card padding="md">
              <p className="text-2xl font-bold text-[var(--sat-area-mocks)]">FPT</p>
              <p className="text-xs text-gray-500">R&amp;W and Math scores only</p>
            </Card>
          </div>
          <div className="mb-6">
            <MockSectionChart metrics={mockMetrics} />
          </div>
          <div className="mb-6">
            <PerformanceBreakdown
              title="Performance by section and module"
              rowLabel="Section"
              dimensionLabel="module"
              dimensions={mockModules}
              summaryMetrics={mockModuleMetrics}
              detailMetrics={mockSectionModuleMetrics}
            />
          </div>
          <Card padding="md">
            <div className="overflow-hidden rounded-md border border-gray-100">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-left text-xs font-medium text-gray-500">
                    <th className="px-3 py-2">Exam</th>
                    <th className="px-3 py-2">Date</th>
                    <th className="px-3 py-2 text-right">SAT Total</th>
                    <th className="px-3 py-2 text-right">R&amp;W</th>
                    <th className="px-3 py-2 text-right">Math</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {examAttempts.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-3 py-6 text-center text-sm text-gray-400">
                        No submitted exams yet.
                      </td>
                    </tr>
                  ) : (
                    examAttempts.map((exam) => (
                      <tr key={exam.id}>
                        <td className="px-3 py-2 font-medium text-gray-800">{exam.test.name}</td>
                        <td className="px-3 py-2 text-gray-500">{exam.submittedAt ? formatDate(exam.submittedAt) : "-"}</td>
                        <td className="px-3 py-2 text-right font-semibold text-gray-900">{exam.totalScore ?? "—"}</td>
                        <td className="px-3 py-2 text-right text-gray-700">{exam.rwScore ?? "—"}</td>
                        <td className="px-3 py-2 text-right text-gray-700">{exam.mathScore ?? "—"}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </section>
      </PageShell>
    );
  }

  const attempts = await prisma.attempt.findMany({
    where: {
      studentId,
      status: "SUBMITTED",
      ...dateFilter,
      assignment: {
        practiceSet: {
          topic: { domain: { practiceArea: practiceArea! } },
        },
      },
    },
    include: {
      answers: { include: { question: { include: { topic: true } } } },
      assignment: {
        include: {
          practiceSet: {
            include: {
              topic: { include: { domain: { include: { section: true } } } },
              questions: { include: { question: { include: { topic: true } } } },
            },
          },
        },
      },
    },
    orderBy: { submittedAt: "desc" },
  });

  const buildQuestionRows = (attempt: (typeof attempts)[number]): ReportQuestionRow[] => {
    const answersByQuestion = new Map(attempt.answers.map((answer) => [answer.questionId, answer]));
    const practiceQuestions = attempt.assignment?.practiceSet.questions ?? [];
    const questionSources = practiceQuestions.length
      ? practiceQuestions.map((item) => ({ questionId: item.questionId, question: item.question, answer: answersByQuestion.get(item.questionId) }))
      : attempt.answers.map((answer) => ({ questionId: answer.questionId, question: answer.question, answer }));

    return questionSources.map(({ questionId, question, answer }) => {
      const snapshot = parseSnapshot<QuestionSnapshot>(answer?.questionSnapshot);
      return {
        questionId,
        topicId: snapshot?.topic?.id ?? question.topicId,
        topicName: snapshot?.topic?.name ?? question.topic.name,
        difficulty: snapshot?.difficulty ?? question.difficulty,
        answer: answer?.answer ?? null,
        isCorrect: answer?.isCorrect === true,
        attemptId: attempt.id,
        imageUrl: snapshot?.imageUrl ?? question.imageUrl ?? null,
        stem: snapshot?.stem ?? question.stem,
      };
    });
  };
  const questionRowsByAttempt = attempts.map(buildQuestionRows);
  const questionMatchesFilters = (row: ReportQuestionRow) =>
    (!topicId || row.topicId === topicId) &&
    (!difficulty || row.difficulty === difficulty);
  const matchingQuestionRows = questionRowsByAttempt.map((rows) => rows.filter(questionMatchesFilters));
  const scoredAttempts = attempts.map((attempt, index) => {
    const rows = matchingQuestionRows[index] ?? [];
    const score = summarizeAllQuestionAnswers(rows);
    const snapshot = parseSnapshot<PracticeSetSnapshot>(attempt.practiceSetSnapshot);
    return {
      id: attempt.id,
      name: snapshot?.name ?? attempt.assignment?.practiceSet.name ?? "Practice Set",
      submittedAt: attempt.submittedAt,
      totalTime: attempt.totalTime ?? 0,
      correct: score.correct,
      total: score.total,
      score: score.percent,
    };
  });
  const visibleAttempts = scoredAttempts;
  const elapsedTime = sumAttemptElapsedTime(visibleAttempts);
  const topicStats = new Map<string, TopicStat>();
  const attemptDetailById = new Map(scoredAttempts.map((attempt) => [attempt.id, attempt]));
  const progressRows: Array<{ topic: string; difficulty: string; correct: boolean; attemptId: string; attemptLabel: string; submittedAt: Date | null }> = [];

  for (const rows of matchingQuestionRows) {
    const topicsInAttempt = new Set<string>();
    for (const row of rows) {
      const key = row.topicName;
      topicsInAttempt.add(key);
      const stat = topicStats.get(key) ?? { correct: 0, total: 0, attempts: 0, attemptIds: new Set<string>() };
      stat.total += 1;
      if (row.isCorrect) stat.correct += 1;
      topicStats.set(key, stat);

      progressRows.push({
        topic: key,
        difficulty: row.difficulty,
        correct: row.isCorrect,
        attemptId: row.attemptId,
        attemptLabel: attemptDetailById.get(row.attemptId)?.name ?? "Practice set",
        submittedAt: attemptDetailById.get(row.attemptId)?.submittedAt ?? null,
      });
    }
    for (const topic of topicsInAttempt) {
      const stat = topicStats.get(topic);
      if (!stat) continue;
      const attemptId = rows[0]?.attemptId;
      if (attemptId && !stat.attemptIds.has(attemptId)) {
        stat.attemptIds.add(attemptId);
        stat.attempts += 1;
      }
    }
  }
  const weakTopics = [...topicStats.entries()]
    .map(([topic, stat]) => ({ topic, ...stat, score: scorePercent(stat.correct, stat.total) }))
    .sort((a, b) => a.score - b.score)
    .slice(0, 3);
  const teacherComments = attempts
    .filter((attempt) => attempt.teacherComment)
    .map((attempt) => {
      const snapshot = parseSnapshot<PracticeSetSnapshot>(attempt.practiceSetSnapshot);
      return {
        id: attempt.id,
        practiceSetName: snapshot?.name ?? attempt.assignment?.practiceSet.name ?? "Practice Set",
        submittedAt: attempt.submittedAt,
        comment: attempt.teacherComment!,
      };
    });
  const difficultyMetrics = aggregateDifficultyMetrics(progressRows);
  const topicDifficultyMetrics = aggregateTopicDifficultyMetrics(progressRows);
  const trendAttempts = scoredAttempts
    .filter((attempt) => attempt.total > 0)
    .map((attempt) => ({ id: attempt.id, label: attempt.name, submittedAt: attempt.submittedAt }));
  const topicTrend = aggregateTopicDifficultyTrend(
    progressRows.map((row) => ({ topic: row.topic, difficulty: row.difficulty, correct: row.correct, attemptId: row.attemptId })),
    trendAttempts,
  );
  const trendTopics = Object.keys(topicTrend);
  const areaTitle = practiceAreaLabel(practiceArea);
  const overallScore = summarizeAllQuestionAnswers(matchingQuestionRows.flat());

  return (
    <PageShell>
      <div className="mb-6 flex items-center justify-between">
        <div>
            <Link href={buildProgressHref(`/teacher/students/${studentId}`, filters)} className="text-sm text-blue-600 hover:underline">
            ← Student
          </Link>
          <h1 className="mt-2 text-xl font-semibold text-gray-900">Individual Report: {student.name}</h1>
        </div>
        <Link href={pdfHref} className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
          Download PDF
        </Link>
      </div>

        <PracticeAreaTabs basePath={`/teacher/students/${studentId}/report`} active={area} preserve={{ difficulty: filters.difficulty, from: filters.from, to: filters.to }} />
      <ProgressFilters action={`/teacher/students/${studentId}/report`} filters={filters} topics={topics} />

      <section className="mb-10">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">Practice — {areaTitle}</h2>
        <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
          <Card padding="md">
            <p className="text-2xl font-bold">{visibleAttempts.length}</p>
            <p className="text-xs text-gray-500">Submitted attempts</p>
          </Card>
          <Card padding="md">
            <p className="text-2xl font-bold">{formatTime(elapsedTime)}</p>
            <p className="text-xs text-gray-500">Total time</p>
          </Card>
          <Card padding="md">
            <p className={`text-2xl font-bold ${scoreBandTextClass(overallScore.percent)}`}>{overallScore.percent === null ? "—" : `${overallScore.percent}%`}</p>
            <p className="text-xs text-gray-500">Average score · {overallScore.correct} correct of {overallScore.total} questions</p>
          </Card>
          <Card padding="md">
            <p className="text-2xl font-bold">{topicStats.size}</p>
            <p className="text-xs text-gray-500">Skills practiced</p>
          </Card>
        </div>

        <div className="mb-6">
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
          <div className="mb-6">
            <TopicDifficultyTrend
              topics={trendTopics}
              pointsByTopic={topicTrend}
              selectedTopic={topics.find((topic) => topic.id === topicId)?.name ?? trendTopics[0]}
              selectedDifficulty={difficulty}
            />
          </div>
        )}

        {weakTopics.length > 0 && (
          <Card variant="warning" padding="md" className="mb-6">
            <h3 className="mb-3 text-sm font-semibold text-amber-900">Weak Skills</h3>
            <div className="grid gap-3 md:grid-cols-3">
              {weakTopics.map((topic) => (
                <div key={topic.topic} className="rounded-md border border-amber-100 bg-white px-3 py-2">
                  <p className="text-sm font-medium text-gray-900">{topic.topic}</p>
                  <p className={`mt-1 text-xs font-semibold ${scoreBandTextClass(topic.score)}`}>
                    {topic.score}% accuracy · {topic.correct} correct of {topic.total} questions
                  </p>
                  <p className="mt-2 text-xs text-amber-800">
                    Assign targeted practice and review missed explanations before advancing difficulty.
                  </p>
                </div>
              ))}
            </div>
          </Card>
        )}

        <Card padding="md" className="mb-6">
          <h3 className="mb-3 text-sm font-semibold text-gray-900">Recent Practice Attempts</h3>
          <div className="overflow-hidden rounded-md border border-gray-100">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-left text-xs font-medium text-gray-500">
                  <th className="px-3 py-2">Practice Set</th>
                  <th className="px-3 py-2">Date</th>
                  <th className="px-3 py-2 text-right">Score</th>
                  <th className="px-3 py-2 text-right">Elapsed</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {visibleAttempts.slice(0, 8).map((attempt) => (
                  <tr key={attempt.id}>
                    <td className="px-3 py-2 font-medium text-gray-800">{attempt.name}</td>
                    <td className="px-3 py-2 text-gray-500">{attempt.submittedAt ? formatDate(attempt.submittedAt) : "-"}</td>
                    <td className={`px-3 py-2 text-right font-medium ${attempt.score !== null ? scoreBandTextClass(attempt.score) : "text-gray-500"}`}>
                      {attempt.score !== null ? `${attempt.score}% · ${attempt.correct} correct of ${attempt.total} questions` : "—"}
                    </td>
                    <td className="px-3 py-2 text-right text-gray-500">{formatTime(attempt.totalTime)}</td>
                  </tr>
                ))}
                {visibleAttempts.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-3 py-3 text-sm text-gray-400">
                      No submitted attempts yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>

        {teacherComments.length > 0 && (
          <Card padding="md" className="mb-6">
            <h3 className="mb-3 text-sm font-semibold text-gray-900">Teacher Comments</h3>
            <div className="space-y-3">
              {teacherComments.map((entry) => (
                <div key={entry.id} className="rounded-md border border-gray-100 bg-gray-50 px-3 py-2">
                  <div className="mb-1 flex items-center justify-between gap-3 text-xs text-gray-500">
                    <span className="font-medium text-gray-700">{entry.practiceSetName}</span>
                    <span>{entry.submittedAt ? formatDate(entry.submittedAt) : "-"}</span>
                  </div>
                  <p className="text-sm text-gray-800">{entry.comment}</p>
                </div>
              ))}
            </div>
          </Card>
        )}

      </section>
    </PageShell>
  );
}
