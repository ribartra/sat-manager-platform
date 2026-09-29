// Student progress report data, shared by the teacher student page and the PDF report
// (/api/reports/students/[id]/pdf) so both show exactly the same numbers.
// Taxonomy note: the Topic table is the SKILL level (Section → Domain → Skill).
import prisma from "@/lib/prisma";
import { scorePercent } from "@/lib/utils";
import { parseSnapshot, type PracticeSetSnapshot, type QuestionSnapshot } from "@/lib/attempt-snapshots";
import { isAnsweredAnswer, sumAttemptElapsedTime, summarizeAllQuestionAnswers } from "@/lib/weighted-score";
import {
  aggregateDifficultyMetrics,
  aggregateTopicDifficultyMetrics,
  aggregateTopicDifficultyTrend,
  type MockSectionMetric,
  type ProgressMetric,
  type TopicTrendPoint,
} from "@/lib/progress-analytics";
import { practiceAreaLabel, type PracticeAreaCode } from "@/lib/practice-area";
import { progressDateWhere } from "@/lib/progress-filters";

export type ReportFilters = { topic?: string; difficulty?: string; from?: string; to?: string };

export type WeakSkill = {
  key: string;
  topicId: string;
  domainId: string;
  label: string;
  difficulty: string;
  correct: number;
  total: number;
  percent: number;
  avgTime: number | null;
  recommendation: string;
  /** Published sets of this skill + difficulty that can be assigned (unassigned, completed or overdue). */
  assignableIds: string[];
  /** Sets of this skill + difficulty already assigned and not finished. */
  pendingCount: number;
};

export type ReportAttempt = {
  id: string;
  name: string;
  submittedAt: Date | null;
  totalTime: number;
  correct: number;
  total: number;
  percent: number | null;
  teacherComment: string | null;
};

export type PracticeReport = {
  practiceArea: PracticeAreaCode;
  areaLabel: string;
  kpis: {
    attempts: number;
    overall: { correct: number; total: number; percent: number | null };
    totalTime: number;
    avgQuestionTime: number | null;
    pending: number;
  };
  difficultyMetrics: ProgressMetric[];
  topicDifficultyMetrics: ProgressMetric[];
  weakSkills: WeakSkill[];
  trend: { topics: string[]; pointsByTopic: Record<string, TopicTrendPoint[]>; attemptCount: number };
  assignments: Array<{
    id: string;
    practiceSetId: string;
    name: string;
    topicId: string;
    difficulty: string;
    status: string;
    locked: boolean;
    dueDate: Date | null;
  }>;
  attempts: ReportAttempt[];
  comments: ReportAttempt[];
  pendingExamCount: number;
};

export type MockReport = {
  kpis: {
    exams: number;
    latestTotal: number | null;
    latestRw: number | null;
    latestMath: number | null;
    pending: number;
  };
  /** Oldest → newest, for the score chart. */
  scoreSeries: MockSectionMetric[];
  modules: string[];
  moduleMetrics: ProgressMetric[];
  sectionModuleMetrics: ProgressMetric[];
  /** Newest first. */
  exams: Array<{ id: string; name: string; submittedAt: Date | null; totalScore: number | null; rwScore: number | null; mathScore: number | null }>;
  activeExams: Array<{ id: string; name: string; status: string; dueDate: Date | null }>;
};

export function recommendationFor(pct: number) {
  if (pct < 50) return "Re-teach, then assign Easy targeted practice.";
  if (pct < 75) return "Review mistakes before moving up in difficulty.";
  return "Monitor; a short reinforcement set is enough.";
}

/** "Advanced Math - Nonlinear Functions - EASY" -> "Nonlinear Functions · EASY" (the area implies the domain). */
export function shortSetName(name: string) {
  const parts = name.split(" - ").map((part) => part.trim()).filter(Boolean);
  return parts.length >= 3 ? parts.slice(1).join(" · ") : name;
}

const OPEN_STATUSES = ["PENDING", "IN_PROGRESS", "OVERDUE"];

export async function loadPracticeReport(studentId: string, practiceArea: PracticeAreaCode, filters: ReportFilters): Promise<PracticeReport> {
  const topicId = filters.topic ?? "";
  const difficulty = filters.difficulty ?? "";
  const dateFilter = progressDateWhere(filters);

  const [attempts, assignments, pendingExamCount] = await Promise.all([
    prisma.attempt.findMany({
      where: {
        studentId,
        status: "SUBMITTED",
        ...dateFilter,
        assignment: { practiceSet: { topic: { domain: { practiceArea } } } },
      },
      include: {
        answers: { include: { question: { include: { topic: true } } } },
        assignment: {
          include: {
            practiceSet: { include: { questions: { include: { question: { include: { topic: true } } } } } },
          },
        },
      },
      orderBy: { submittedAt: "desc" },
    }),
    prisma.assignment.findMany({
      where: {
        studentId,
        status: { in: OPEN_STATUSES },
        practiceSet: {
          topic: { domain: { practiceArea } },
          ...(topicId ? { topicId } : {}),
          ...(difficulty ? { difficulty } : {}),
        },
      },
      include: { practiceSet: { select: { name: true, topicId: true, difficulty: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.fullPracticeTestAssignment.count({ where: { studentId, status: { in: OPEN_STATUSES } } }),
  ]);

  // Question rows use the attempt snapshot (what the student actually saw), filtered by skill/difficulty.
  const rowsByAttempt = attempts.map((attempt) => {
    const answersByQuestion = new Map(attempt.answers.map((answer) => [answer.questionId, answer]));
    const setQuestions = attempt.assignment?.practiceSet.questions ?? [];
    const sources = setQuestions.length
      ? setQuestions.map((item) => ({ question: item.question, answer: answersByQuestion.get(item.questionId) }))
      : attempt.answers.map((answer) => ({ question: answer.question, answer }));
    return sources
      .map(({ question, answer }) => {
        const snapshot = parseSnapshot<QuestionSnapshot>(answer?.questionSnapshot);
        return {
          topicId: snapshot?.topic?.id ?? question.topicId,
          topicName: snapshot?.topic?.name ?? question.topic.name,
          domainId: question.topic.domainId,
          difficulty: snapshot?.difficulty ?? question.difficulty,
          answer: answer?.answer ?? null,
          isCorrect: answer?.isCorrect === true,
          timeSeconds: answer?.timeSpent ?? 0,
          attemptId: attempt.id,
        };
      })
      .filter((row) => (!topicId || row.topicId === topicId) && (!difficulty || row.difficulty === difficulty));
  });
  const allRows = rowsByAttempt.flat();

  const scoredAttempts: ReportAttempt[] = attempts.map((attempt, index) => {
    const rows = rowsByAttempt[index] ?? [];
    const score = summarizeAllQuestionAnswers(rows);
    const snapshot = parseSnapshot<PracticeSetSnapshot>(attempt.practiceSetSnapshot);
    return {
      id: attempt.id,
      name: snapshot?.name ?? attempt.assignment?.practiceSet.name ?? "Practice Set",
      submittedAt: attempt.submittedAt,
      totalTime: attempt.totalTime ?? 0,
      correct: score.correct,
      total: score.total,
      percent: rows.some(isAnsweredAnswer) ? score.percent : null,
      teacherComment: attempt.teacherComment,
    };
  });
  const attemptById = new Map(scoredAttempts.map((attempt) => [attempt.id, attempt]));
  const overall = summarizeAllQuestionAnswers(allRows);
  const timedRows = allRows.filter((row) => row.timeSeconds);

  const progressRows = allRows.map((row) => ({
    topic: row.topicName,
    difficulty: row.difficulty,
    correct: row.isCorrect,
    timeSeconds: row.timeSeconds,
    attemptId: row.attemptId,
    attemptLabel: attemptById.get(row.attemptId)?.name ?? "Practice set",
    submittedAt: attemptById.get(row.attemptId)?.submittedAt ?? null,
  }));

  // Weakest skill x difficulty buckets.
  const buckets = new Map<string, { topicId: string; domainId: string; label: string; difficulty: string; correct: number; total: number; totalTime: number; timed: number }>();
  for (const row of allRows) {
    const key = `${row.topicId}:${row.difficulty}`;
    const bucket = buckets.get(key) ?? {
      topicId: row.topicId, domainId: row.domainId, label: row.topicName, difficulty: row.difficulty,
      correct: 0, total: 0, totalTime: 0, timed: 0,
    };
    bucket.total += 1;
    if (row.isCorrect) bucket.correct += 1;
    if (row.timeSeconds) {
      bucket.totalTime += row.timeSeconds;
      bucket.timed += 1;
    }
    buckets.set(key, bucket);
  }
  const weakest = [...buckets.entries()]
    .sort(([, a], [, b]) => scorePercent(a.correct, a.total) - scorePercent(b.correct, b.total) || b.total - a.total)
    .slice(0, 12);
  const weakTopicIds = [...new Set(weakest.map(([, bucket]) => bucket.topicId))];
  const setsForWeakSkills = weakTopicIds.length
    ? await prisma.practiceSet.findMany({
        where: { topicId: { in: weakTopicIds }, status: "PUBLISHED" },
        select: { id: true, topicId: true, difficulty: true, assignments: { where: { studentId }, select: { status: true } } },
        orderBy: { createdAt: "asc" },
      })
    : [];
  const weakSkills: WeakSkill[] = weakest.map(([key, bucket]) => {
    const sets = setsForWeakSkills.filter((set) => set.topicId === bucket.topicId && set.difficulty === bucket.difficulty);
    const assignable = sets.filter((set) => !set.assignments[0] || ["COMPLETED", "OVERDUE"].includes(set.assignments[0].status));
    const percent = scorePercent(bucket.correct, bucket.total);
    return {
      key,
      topicId: bucket.topicId,
      domainId: bucket.domainId,
      label: bucket.label,
      difficulty: bucket.difficulty,
      correct: bucket.correct,
      total: bucket.total,
      percent,
      avgTime: bucket.timed ? Math.round(bucket.totalTime / bucket.timed) : null,
      recommendation: recommendationFor(percent),
      assignableIds: assignable.map((set) => set.id),
      pendingCount: sets.length - assignable.length,
    };
  });

  const trendAttempts = scoredAttempts
    .filter((attempt) => attempt.total > 0)
    .map((attempt) => ({ id: attempt.id, label: attempt.name, submittedAt: attempt.submittedAt }));
  const pointsByTopic = aggregateTopicDifficultyTrend(
    progressRows.map((row) => ({ topic: row.topic, difficulty: row.difficulty, correct: row.correct, attemptId: row.attemptId })),
    trendAttempts,
  );

  return {
    practiceArea,
    areaLabel: practiceAreaLabel(practiceArea),
    kpis: {
      attempts: scoredAttempts.length,
      overall: { correct: overall.correct, total: overall.total, percent: overall.percent },
      totalTime: sumAttemptElapsedTime(scoredAttempts),
      avgQuestionTime: timedRows.length ? Math.round(timedRows.reduce((sum, row) => sum + row.timeSeconds, 0) / timedRows.length) : null,
      pending: assignments.length,
    },
    difficultyMetrics: aggregateDifficultyMetrics(progressRows),
    topicDifficultyMetrics: aggregateTopicDifficultyMetrics(progressRows),
    weakSkills,
    trend: { topics: Object.keys(pointsByTopic), pointsByTopic, attemptCount: trendAttempts.length },
    assignments: assignments.map((a) => ({
      id: a.id,
      practiceSetId: a.practiceSetId,
      name: a.practiceSet.name,
      topicId: a.practiceSet.topicId,
      difficulty: a.practiceSet.difficulty,
      status: a.status,
      locked: a.locked,
      dueDate: a.dueDate,
    })),
    attempts: scoredAttempts,
    comments: scoredAttempts.filter((attempt) => attempt.teacherComment),
    pendingExamCount,
  };
}

export async function loadMockReport(studentId: string, filters: ReportFilters): Promise<MockReport> {
  const dateFilter = progressDateWhere(filters);
  const [examAttempts, examAssignments] = await Promise.all([
    prisma.fullPracticeTestAttempt.findMany({
      where: { studentId, status: "SUBMITTED", ...dateFilter },
      include: {
        answers: true,
        test: { include: { modules: { include: { questions: { select: { questionId: true } } }, orderBy: { order: "asc" } } } },
      },
      orderBy: { submittedAt: "desc" },
    }),
    prisma.fullPracticeTestAssignment.findMany({
      where: { studentId, status: { in: OPEN_STATUSES } },
      include: { test: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
    }),
  ]);
  const rows = examAttempts.flatMap((exam) => {
    const answersByQuestion = new Map(exam.answers.map((answer) => [answer.questionId, answer]));
    return exam.test.modules.flatMap((module) =>
      module.questions.map((item) => {
        const answer = answersByQuestion.get(item.questionId);
        return {
          topic: module.section === "RW" ? "Reading & Writing" : "Math",
          difficulty: module.name,
          correct: answer?.isCorrect === true,
          timeSeconds: answer?.timeSpent ?? 0,
          attemptId: exam.id,
          attemptLabel: exam.test.name,
          submittedAt: exam.submittedAt,
        };
      }),
    );
  });
  const latest = examAttempts[0];
  return {
    kpis: {
      exams: examAttempts.length,
      latestTotal: latest?.totalScore ?? null,
      latestRw: latest?.rwScore ?? null,
      latestMath: latest?.mathScore ?? null,
      pending: examAssignments.length,
    },
    scoreSeries: [...examAttempts].reverse().map((exam) => ({
      attempts: 1,
      label: exam.test.name,
      submittedAt: exam.submittedAt?.toISOString() ?? null,
      mathScore: exam.mathScore,
      rwScore: exam.rwScore,
      totalScore: exam.totalScore,
    })),
    modules: [...new Set(rows.map((row) => row.difficulty))],
    moduleMetrics: aggregateDifficultyMetrics(rows),
    sectionModuleMetrics: aggregateTopicDifficultyMetrics(rows),
    exams: examAttempts.map((exam) => ({
      id: exam.id,
      name: exam.test.name,
      submittedAt: exam.submittedAt,
      totalScore: exam.totalScore,
      rwScore: exam.rwScore,
      mathScore: exam.mathScore,
    })),
    activeExams: examAssignments.map((a) => ({ id: a.id, name: a.test.name, status: a.status, dueDate: a.dueDate })),
  };
}
