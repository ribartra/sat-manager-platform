import { PageShell, PracticeAreaTabs } from "@/components/sat";
import prisma from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";
import { formatDate, formatTime, scorePercent } from "@/lib/utils";
import { scoreBandTextClass, scoreBandBarClass } from "@/lib/score-band";
import { parseSnapshot, PracticeSetSnapshot, QuestionSnapshot } from "@/lib/attempt-snapshots";
import { auth } from "@/lib/auth";
import { studentAccessWhereFor } from "@/lib/program-scope";
import { QuestionMedia } from "@/components/question-media";
import { MathContent } from "@/components/math-content";
import { Card } from "@/components/ui/card";
import { DifficultyAccuracyChart, MockSectionChart, TopicDifficultyChart } from "@/components/progress-charts";
import { aggregateDifficultyMetrics, aggregateTopicDifficultyMetrics, type MockSectionMetric } from "@/lib/progress-analytics";
import {
  activeAreaTab,
  practiceAreaFromTab,
  practiceAreaLabel,
} from "@/lib/practice-area";

interface PageProps {
  params: Promise<{ studentId: string }>;
  searchParams: Promise<{ area?: string }>;
}

type TopicStat = { correct: number; total: number; time: number; attempts: number; attemptIds: Set<string> };

export default async function StudentReportPage({ params, searchParams }: PageProps) {
  const { studentId } = await params;
  const query = await searchParams;
  const area = activeAreaTab(query.area, "math");
  const practiceArea = practiceAreaFromTab(area);
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

  const examAttempts = await prisma.fullPracticeTestAttempt.findMany({
    where: { studentId, status: "SUBMITTED" },
    include: { test: { select: { name: true } } },
    orderBy: { submittedAt: "desc" },
  });

  const mockMetrics: MockSectionMetric[] = examAttempts.map((exam) => ({
    label: exam.test.name,
    submittedAt: exam.submittedAt?.toISOString() ?? null,
    mathScore: exam.mathScore,
    rwScore: exam.rwScore,
    totalScore: exam.totalScore,
  }));

  const pdfHref = `/api/reports/students/${studentId}/pdf?areas=mathematics,reading,writing`;

  if (area === "mocks") {
    return (
      <PageShell>
        <div className="mb-6 flex items-center justify-between">
          <div>
            <Link href={`/teacher/students/${studentId}`} className="text-sm text-blue-600 hover:underline">
              ← Student
            </Link>
            <h1 className="mt-2 text-xl font-semibold text-gray-900">Individual Report: {student.name}</h1>
          </div>
          <Link href={pdfHref} className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
            Download PDF
          </Link>
        </div>
        <PracticeAreaTabs basePath={`/teacher/students/${studentId}/report`} active={area} />
        <section>
          <h2 className="mb-4 text-lg font-semibold text-[var(--sat-area-mocks)]">Mocks</h2>
          <div className="mb-6 grid gap-4 md:grid-cols-3">
            <Card padding="md">
              <p className="text-2xl font-bold">{examAttempts.length}</p>
              <p className="text-xs text-gray-500">Completed mocks</p>
            </Card>
            <Card padding="md">
              <p className="text-2xl font-bold">{examAttempts[0]?.totalScore ?? "-"}</p>
              <p className="text-xs text-gray-500">Latest total score</p>
            </Card>
            <Card padding="md">
              <p className="text-2xl font-bold text-[var(--sat-area-mocks)]">Mocks</p>
              <p className="text-xs text-gray-500">Full Practice Tests only</p>
            </Card>
          </div>
          <div className="mb-6">
            <MockSectionChart metrics={mockMetrics} />
          </div>
          <Card padding="md">
            {examAttempts.length === 0 ? (
              <p className="text-sm text-gray-400">No submitted exams yet.</p>
            ) : (
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
                    {examAttempts.map((exam) => (
                      <tr key={exam.id}>
                        <td className="px-3 py-2 font-medium text-gray-800">{exam.test.name}</td>
                        <td className="px-3 py-2 text-gray-500">{exam.submittedAt ? formatDate(exam.submittedAt) : "-"}</td>
                        <td className="px-3 py-2 text-right font-semibold text-gray-900">{exam.totalScore ?? "—"}</td>
                        <td className="px-3 py-2 text-right text-gray-700">{exam.rwScore ?? "—"}</td>
                        <td className="px-3 py-2 text-right text-gray-700">{exam.mathScore ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </section>
      </PageShell>
    );
  }

  const attempts = await prisma.attempt.findMany({
    where: {
      studentId,
      status: "SUBMITTED",
      assignment: {
        practiceSet: {
          topic: { domain: { practiceArea: practiceArea! } },
        },
      },
    },
    include: {
      answers: { include: { question: { include: { topic: true } } } },
      assignment: { include: { practiceSet: { include: { topic: { include: { domain: { include: { section: true } } } } } } } },
    },
    orderBy: { submittedAt: "desc" },
  });

  const totalTime = attempts.reduce((sum, attempt) => sum + (attempt.totalTime ?? 0), 0);
  const scoredAttempts = attempts.map((attempt) => {
    const correct = attempt.answers.filter((answer) => answer.isCorrect).length;
    const total = attempt.answers.length;
    const snapshot = parseSnapshot<PracticeSetSnapshot>(attempt.practiceSetSnapshot);
    const score =
      typeof attempt.scorePercent === "number" ? attempt.scorePercent : scorePercent(correct, total);
    return {
      id: attempt.id,
      name: snapshot?.name ?? attempt.assignment?.practiceSet.name ?? "Practice Set",
      submittedAt: attempt.submittedAt,
      totalTime: attempt.totalTime ?? 0,
      correct,
      total,
      score,
    };
  });
  const avgScore = scoredAttempts.length
    ? Math.round(scoredAttempts.reduce((sum, attempt) => sum + attempt.score, 0) / scoredAttempts.length)
    : null;
  const lastValidAttempt = scoredAttempts[0] ?? null;
  const scoreTrend = [...scoredAttempts].reverse();
  const topicStats = new Map<string, TopicStat>();
  const difficultyStats = new Map<string, { correct: number; total: number; time: number }>();
  const progressRows: Array<{ topic: string; difficulty: string; correct: boolean; timeSeconds: number }> = [];
  const mediaQuestions = new Map<string, { stem: string; imageUrl: string; topic: string; difficulty: string }>();

  for (const attempt of attempts) {
    const topicsInAttempt = new Set<string>();
    for (const answer of attempt.answers) {
      const snapshot = parseSnapshot<QuestionSnapshot>(answer.questionSnapshot);
      const key = snapshot?.topic?.name ?? answer.question.topic.name;
      topicsInAttempt.add(key);
      const stat = topicStats.get(key) ?? { correct: 0, total: 0, time: 0, attempts: 0, attemptIds: new Set<string>() };
      stat.total += 1;
      if (answer.isCorrect) stat.correct += 1;
      stat.time += answer.timeSpent ?? 0;
      topicStats.set(key, stat);

      const difficulty = snapshot?.difficulty ?? answer.question.difficulty;
      progressRows.push({
        topic: key,
        difficulty,
        correct: Boolean(answer.isCorrect),
        timeSeconds: answer.timeSpent ?? 0,
      });
      const difficultyStat = difficultyStats.get(difficulty) ?? { correct: 0, total: 0, time: 0 };
      difficultyStat.total += 1;
      if (answer.isCorrect) difficultyStat.correct += 1;
      difficultyStat.time += answer.timeSpent ?? 0;
      difficultyStats.set(difficulty, difficultyStat);

      const imageUrl = snapshot?.imageUrl ?? answer.question.imageUrl;
      if (imageUrl && !mediaQuestions.has(imageUrl)) {
        mediaQuestions.set(imageUrl, {
          stem: snapshot?.stem ?? answer.question.stem,
          imageUrl,
          topic: key,
          difficulty,
        });
      }
    }
    for (const topic of topicsInAttempt) {
      const stat = topicStats.get(topic);
      if (!stat) continue;
      if (!stat.attemptIds.has(attempt.id)) {
        stat.attemptIds.add(attempt.id);
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
  const attemptSumByTopic = [...topicStats.values()].reduce((sum, stat) => sum + stat.attempts, 0);
  const areaTitle = practiceAreaLabel(practiceArea);

  return (
    <PageShell>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <Link href={`/teacher/students/${studentId}`} className="text-sm text-blue-600 hover:underline">
            ← Student
          </Link>
          <h1 className="mt-2 text-xl font-semibold text-gray-900">Individual Report: {student.name}</h1>
        </div>
        <Link href={pdfHref} className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
          Download PDF
        </Link>
      </div>

      <PracticeAreaTabs basePath={`/teacher/students/${studentId}/report`} active={area} />

      <section className="mb-10">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">Practice — {areaTitle}</h2>
        <div className="mb-6 grid gap-4 md:grid-cols-2 lg:grid-cols-5">
          <Card padding="md">
            <p className="text-2xl font-bold">{attempts.length}</p>
            <p className="text-xs text-gray-500">Completed attempts</p>
          </Card>
          <Card padding="md">
            <p className="text-2xl font-bold">{formatTime(totalTime)}</p>
            <p className="text-xs text-gray-500">Practice time</p>
          </Card>
          <Card padding="md">
            <p className="text-2xl font-bold">{topicStats.size}</p>
            <p className="text-xs text-gray-500">Skills practiced</p>
          </Card>
          <Card padding="md">
            <p className={`text-2xl font-bold ${scoreBandTextClass(avgScore)}`}>{avgScore !== null ? `${avgScore}%` : "-"}</p>
            <p className="text-xs text-gray-500">Average %</p>
          </Card>
          <Card padding="md">
            <p className={`text-2xl font-bold ${scoreBandTextClass(lastValidAttempt?.score)}`}>
              {lastValidAttempt ? `${lastValidAttempt.score}%` : "-"}
            </p>
            <p className="text-xs text-gray-500">Last valid %</p>
          </Card>
        </div>
        {attempts.length > 0 && attemptSumByTopic !== attempts.length && (
          <p className="mb-4 text-xs text-gray-500">
            Topic attempt counts ({attemptSumByTopic}) can exceed completed sets ({attempts.length}) when a set covers multiple skills.
          </p>
        )}

        <div className="mb-6 grid gap-6 lg:grid-cols-2">
          <DifficultyAccuracyChart metrics={difficultyMetrics} />
          <TopicDifficultyChart metrics={topicDifficultyMetrics} />
        </div>

        <div className="mb-6 grid gap-6 lg:grid-cols-2">
          <ProgressPanel title="Progress by Skill" stats={topicStats} showAttempts />
          <ProgressPanel title="Progress by Difficulty" stats={difficultyStats} />
        </div>

        {weakTopics.length > 0 && (
          <Card variant="warning" padding="md" className="mb-6">
            <h3 className="mb-3 text-sm font-semibold text-amber-900">Weak Skills</h3>
            <div className="grid gap-3 md:grid-cols-3">
              {weakTopics.map((topic) => (
                <div key={topic.topic} className="rounded-md border border-amber-100 bg-white px-3 py-2">
                  <p className="text-sm font-medium text-gray-900">{topic.topic}</p>
                  <p className={`mt-1 text-xs font-semibold ${scoreBandTextClass(topic.score)}`}>
                    {topic.correct}/{topic.total} correct · {topic.score}% · {topic.attempts} attempt{topic.attempts === 1 ? "" : "s"}
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
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-900">Score Progress Over Time (%)</h3>
            {scoreTrend.length > 1 && (
              <span className="text-xs text-gray-500">
                {scoreTrend[0].score}% to {scoreTrend[scoreTrend.length - 1].score}%
              </span>
            )}
          </div>
          {scoreTrend.length > 0 ? (
            <div className="space-y-3">
              <div className="flex h-40 items-end gap-2 border-b border-l border-gray-200 px-2 pt-3">
                {scoreTrend.map((attempt, index) => (
                  <div key={attempt.id} className="flex min-w-10 flex-1 flex-col items-center justify-end gap-1">
                    <div className={`text-[10px] font-medium ${scoreBandTextClass(attempt.score)}`}>{attempt.score}%</div>
                    <div
                      className={`w-full rounded-t ${scoreBandBarClass(attempt.score)}`}
                      style={{ height: `${Math.max(attempt.score, 4)}%` }}
                      title={`${attempt.name}: ${attempt.score}%`}
                    />
                    <div className="text-[10px] text-gray-400">#{index + 1}</div>
                  </div>
                ))}
              </div>
              <div className="grid gap-2 md:grid-cols-2">
                {scoreTrend.map((attempt, index) => (
                  <div key={attempt.id} className="flex items-center justify-between rounded-md bg-gray-50 px-3 py-2 text-xs">
                    <span className="truncate text-gray-700">
                      #{index + 1} {attempt.name}
                    </span>
                    <span className={`shrink-0 font-medium ${scoreBandTextClass(attempt.score)}`}>
                      {attempt.score}% {attempt.submittedAt ? `on ${formatDate(attempt.submittedAt)}` : ""}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-400">No submitted {areaTitle.toLowerCase()} practice attempts yet.</p>
          )}
        </Card>

        <Card padding="md" className="mb-6">
          <h3 className="mb-3 text-sm font-semibold text-gray-900">Recent Practice Attempts</h3>
          <div className="overflow-hidden rounded-md border border-gray-100">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-left text-xs font-medium text-gray-500">
                  <th className="px-3 py-2">Practice Set</th>
                  <th className="px-3 py-2">Date</th>
                  <th className="px-3 py-2 text-right">Score</th>
                  <th className="px-3 py-2 text-right">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {scoredAttempts.slice(0, 8).map((attempt) => (
                  <tr key={attempt.id}>
                    <td className="px-3 py-2 font-medium text-gray-800">{attempt.name}</td>
                    <td className="px-3 py-2 text-gray-500">{attempt.submittedAt ? formatDate(attempt.submittedAt) : "-"}</td>
                    <td className={`px-3 py-2 text-right font-medium ${scoreBandTextClass(attempt.score)}`}>
                      {attempt.correct}/{attempt.total} · {attempt.score}%
                    </td>
                    <td className="px-3 py-2 text-right text-gray-500">{formatTime(attempt.totalTime)}</td>
                  </tr>
                ))}
                {scoredAttempts.length === 0 && (
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

        {mediaQuestions.size > 0 && (
          <Card padding="md">
            <h3 className="mb-3 text-sm font-semibold text-gray-900">Question Media Referenced</h3>
            <div className="grid gap-4 md:grid-cols-2">
              {[...mediaQuestions.values()].slice(0, 6).map((question) => (
                <div key={question.imageUrl} className="rounded-md border border-gray-100 p-3">
                  <QuestionMedia imageUrl={question.imageUrl} alt={question.stem} />
                  <MathContent content={question.stem} className="mt-2 max-h-24 overflow-auto text-xs text-gray-700" />
                  <p className="mt-1 text-xs text-gray-400">
                    {question.topic} · {question.difficulty}
                  </p>
                </div>
              ))}
            </div>
          </Card>
        )}
      </section>
    </PageShell>
  );
}

function ProgressPanel({
  title,
  stats,
  showAttempts = false,
}: {
  title: string;
  stats: Map<string, { correct: number; total: number; time: number; attempts?: number }>;
  showAttempts?: boolean;
}) {
  return (
    <Card padding="md">
      <h3 className="mb-3 text-sm font-semibold text-gray-900">{title}</h3>
      <div className="space-y-3">
        {[...stats.entries()].map(([label, stat]) => {
          const pct = scorePercent(stat.correct, stat.total);
          return (
            <div key={label}>
              <div className="mb-1 flex items-center justify-between text-sm">
                <span className="font-medium text-gray-800">{label}</span>
                <span className={scoreBandTextClass(pct)}>
                  {stat.correct}/{stat.total} · {pct}% · {formatTime(stat.time)}
                  {showAttempts && typeof stat.attempts === "number" ? ` · ${stat.attempts} attempt${stat.attempts === 1 ? "" : "s"}` : ""}
                </span>
              </div>
              <div className="h-2 rounded-full bg-gray-100">
                <div className={`h-2 rounded-full ${scoreBandBarClass(pct)}`} style={{ width: `${pct}%` }} />
              </div>
            </div>
          );
        })}
        {stats.size === 0 && <p className="text-sm text-gray-400">No submitted attempts yet.</p>}
      </div>
    </Card>
  );
}
