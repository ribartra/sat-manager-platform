// Student progress report data, shared by the teacher student page and the PDF report
// (/api/reports/students/[id]/pdf) so both show exactly the same numbers.
// Taxonomy note: the Topic table is the SKILL level (Section → Domain → Skill).
import prisma from "@/lib/prisma";
import { snapshotModulesOf } from "@/lib/full-test-snapshot";
import { scorePercent } from "@/lib/utils";
import { difficultyLabel } from "@/lib/domain-meta";
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
import { compareSkills, domainRank } from "@/lib/taxonomy-order";

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
  /** SUBMITTED, or INVALIDATED in the history lists (never in scores/KPIs). */
  status: string;
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
  /** Domain → skill labels in the official order (Skills Tracker), for grouped matrices. */
  skillGroups: Array<{ label: string; rows: string[] }>;
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
  /** Submitted + invalidated attempts, newest first, for the history list only. */
  attemptHistory: ReportAttempt[];
  comments: ReportAttempt[];
  pendingExamCount: number;
  /** Finished Full Practice Tests (any date). Their results live only in the Full Practice Tests tab. */
  completedExamCount: number;
  latestExam: { name: string; totalScore: number | null; submittedAt: Date | null } | null;
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
  /** Submitted + invalidated exams, newest first, for the history list only (not in the PDF). */
  examHistory: Array<{ id: string; status: string; name: string; submittedAt: Date | null; totalScore: number | null; rwScore: number | null; mathScore: number | null }>;
  activeExams: Array<{ id: string; name: string; status: string; dueDate: Date | null; openAttemptId: string | null; openAttemptStartedAt: Date | null }>;
};

export function recommendationFor(pct: number) {
  if (pct < 50) return "Needs review with the teacher, then easier practice.";
  if (pct < 75) return "Go over mistakes before trying harder questions.";
  return "Doing well. A short refresher is enough.";
}

/** "Advanced Math - Nonlinear Functions - EASY" -> "Nonlinear Functions (Easy)" (the area implies the domain). */
export function shortSetName(name: string) {
  const parts = name.split(" - ").map((part) => part.trim()).filter(Boolean);
  if (parts.length < 3) return name;
  // Several sets of one skill and level end in "#n": "… - Boundaries - HARD - #1" → "Boundaries (Hard) #1".
  const numbered = /^#\d+$/.test(parts[parts.length - 1]) && parts.length >= 4 ? parts.pop() : null;
  const last = parts[parts.length - 1].toUpperCase();
  if (!["EASY", "MEDIUM", "HARD"].includes(last)) return [...parts.slice(1), ...(numbered ? [numbered] : [])].join(" · ");
  if (numbered) return `${parts.slice(1, -1).join(" - ")} (${difficultyLabel(last)}) ${numbered}`;
  return `${parts.slice(1, -1).join(" - ")} (${difficultyLabel(last)})`;
}

const OPEN_STATUSES = ["PENDING", "IN_PROGRESS", "OVERDUE"];

export async function loadPracticeReport(studentId: string, practiceArea: PracticeAreaCode, filters: ReportFilters): Promise<PracticeReport> {
  const topicId = filters.topic ?? "";
  const difficulty = filters.difficulty ?? "";
  const dateFilter = progressDateWhere(filters);

  const [historyAttempts, assignments, pendingExamCount, areaTopics, completedExamCount, latestExamRow] = await Promise.all([
    // Invalidated attempts are loaded only for the history list; every score uses SUBMITTED.
    prisma.attempt.findMany({
      where: {
        studentId,
        status: { in: ["SUBMITTED", "INVALIDATED"] },
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
    prisma.topic.findMany({
      where: { domain: { practiceArea } },
      select: { id: true, name: true, domainId: true, domain: { select: { name: true } } },
    }),
    prisma.fullPracticeTestAttempt.count({ where: { studentId, status: "SUBMITTED" } }),
    prisma.fullPracticeTestAttempt.findFirst({
      where: { studentId, status: "SUBMITTED" },
      orderBy: { submittedAt: "desc" },
      select: { totalScore: true, submittedAt: true, test: { select: { name: true } } },
    }),
  ]);
  // Current skill name/domain by id: attempts keep a snapshot of the old names, but a renamed or
  // moved skill must be reported under its current name and domain (one row, not two).
  const currentTopic = new Map(areaTopics.map((topic) => [topic.id, topic]));

  // Question rows use the attempt snapshot (what the student actually saw), filtered by skill/difficulty.
  const rowsForAttempt = (attempt: (typeof historyAttempts)[number]) => {
    const answersByQuestion = new Map(attempt.answers.map((answer) => [answer.questionId, answer]));
    const setQuestions = attempt.assignment?.practiceSet.questions ?? [];
    const sources = setQuestions.length
      ? setQuestions.map((item) => ({ question: item.question, answer: answersByQuestion.get(item.questionId) }))
      : attempt.answers.map((answer) => ({ question: answer.question, answer }));
    return sources
      .map(({ question, answer }) => {
        const snapshot = parseSnapshot<QuestionSnapshot>(answer?.questionSnapshot);
        const topicId = snapshot?.topic?.id ?? question.topicId;
        const current = currentTopic.get(topicId);
        return {
          topicId,
          topicName: current?.name ?? snapshot?.topic?.name ?? question.topic.name,
          domainId: current?.domainId ?? question.topic.domainId,
          domainName: current?.domain.name ?? "",
          difficulty: snapshot?.difficulty ?? question.difficulty,
          answer: answer?.answer ?? null,
          isCorrect: answer?.isCorrect === true,
          timeSeconds: answer?.timeSpent ?? 0,
          attemptId: attempt.id,
        };
      })
      .filter((row) => (!topicId || row.topicId === topicId) && (!difficulty || row.difficulty === difficulty));
  };
  const scoreAttempt = (attempt: (typeof historyAttempts)[number], rows: ReturnType<typeof rowsForAttempt>): ReportAttempt => {
    const score = summarizeAllQuestionAnswers(rows);
    const snapshot = parseSnapshot<PracticeSetSnapshot>(attempt.practiceSetSnapshot);
    return {
      id: attempt.id,
      status: attempt.status,
      name: snapshot?.name ?? attempt.assignment?.practiceSet.name ?? "Practice Set",
      submittedAt: attempt.submittedAt,
      totalTime: attempt.totalTime ?? 0,
      correct: score.correct,
      total: score.total,
      percent: rows.some(isAnsweredAnswer) ? score.percent : null,
      teacherComment: attempt.teacherComment,
    };
  };
  const attempts = historyAttempts.filter((attempt) => attempt.status === "SUBMITTED");
  const rowsByAttempt = attempts.map(rowsForAttempt);
  const allRows = rowsByAttempt.flat();
  const scoredAttempts: ReportAttempt[] = attempts.map((attempt, index) => scoreAttempt(attempt, rowsByAttempt[index] ?? []));
  const attemptHistory: ReportAttempt[] = historyAttempts.map((attempt) =>
    attempt.status === "SUBMITTED" ? scoredAttempts.find((scored) => scored.id === attempt.id)! : scoreAttempt(attempt, rowsForAttempt(attempt)),
  );
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

  // Domain → skills in official order (only skills with data).
  const skillsWithData = [...new Map(allRows.map((row) => [row.topicId, { id: row.topicId, name: row.topicName, domainId: row.domainId, domainName: row.domainName }])).values()]
    .sort((a, b) => domainRank(a.domainId) - domainRank(b.domainId) || compareSkills(a, b));
  const skillGroups: Array<{ label: string; rows: string[] }> = [];
  for (const skill of skillsWithData) {
    const label = skill.domainName || "Other";
    const group = skillGroups.find((entry) => entry.label === label) ?? (skillGroups.push({ label, rows: [] }), skillGroups[skillGroups.length - 1]);
    if (!group.rows.includes(skill.name)) group.rows.push(skill.name);
  }

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
    skillGroups,
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
    attemptHistory,
    comments: scoredAttempts.filter((attempt) => attempt.teacherComment),
    pendingExamCount,
    completedExamCount,
    latestExam: latestExamRow
      ? { name: latestExamRow.test.name, totalScore: latestExamRow.totalScore, submittedAt: latestExamRow.submittedAt }
      : null,
  };
}

/**
 * Full Practice Test report. With `attemptId` it describes that single exam (KPIs, module and
 * section metrics of that attempt only; no pending exams), e.g. for a per-exam PDF.
 */
export async function loadMockReport(studentId: string, filters: ReportFilters, options: { attemptId?: string } = {}): Promise<MockReport> {
  const dateFilter = progressDateWhere(filters);
  const single = Boolean(options.attemptId);
  const [examAttempts, examAssignments, invalidatedExams] = await Promise.all([
    prisma.fullPracticeTestAttempt.findMany({
      where: { studentId, status: "SUBMITTED", ...(single ? { id: options.attemptId } : dateFilter) },
      include: {
        answers: true,
        test: { include: { modules: { include: { questions: { select: { questionId: true } } }, orderBy: { order: "asc" } } } },
      },
      orderBy: { submittedAt: "desc" },
    }),
    prisma.fullPracticeTestAssignment.findMany({
      where: { studentId, status: { in: OPEN_STATUSES }, ...(single ? { id: "__none__" } : {}) },
      include: {
        test: { select: { name: true } },
        // The open attempt (if any), so a teacher can restart it with the current exam content.
        attempts: { where: { status: "IN_PROGRESS" }, select: { id: true, startedAt: true }, orderBy: { startedAt: "desc" }, take: 1 },
      },
      orderBy: { createdAt: "desc" },
    }),
    single
      ? Promise.resolve([])
      : prisma.fullPracticeTestAttempt.findMany({
          where: { studentId, status: "INVALIDATED", ...dateFilter },
          select: { id: true, status: true, startedAt: true, submittedAt: true, totalScore: true, rwScore: true, mathScore: true, test: { select: { name: true } } },
        }),
  ]);
  const rows = examAttempts.flatMap((exam) => {
    const answersByQuestion = new Map(exam.answers.map((answer) => [answer.questionId, answer]));
    // Exam structure as the attempt saw it (RNF-17 snapshot); legacy attempts use the live exam.
    const modules = snapshotModulesOf(exam.testSnapshot) ?? exam.test.modules;
    return modules.flatMap((module) =>
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
    examHistory: [
      ...examAttempts.map((exam) => ({ ...exam, sortAt: exam.submittedAt ?? exam.startedAt })),
      ...invalidatedExams.map((exam) => ({ ...exam, sortAt: exam.submittedAt ?? exam.startedAt })),
    ]
      .sort((a, b) => b.sortAt.getTime() - a.sortAt.getTime())
      .map((exam) => ({
        id: exam.id,
        status: exam.status,
        name: exam.test.name,
        submittedAt: exam.submittedAt,
        totalScore: exam.totalScore,
        rwScore: exam.rwScore,
        mathScore: exam.mathScore,
      })),
    activeExams: examAssignments.map((a) => ({
      id: a.id,
      name: a.test.name,
      status: a.status,
      dueDate: a.dueDate,
      openAttemptId: a.attempts[0]?.id ?? null,
      openAttemptStartedAt: a.attempts[0]?.startedAt ?? null,
    })),
  };
}

function moduleColumn(moduleName: string) {
  const match = /module\s*(\d+)/i.exec(moduleName);
  return match ? `Module ${match[1]}` : moduleName;
}

/**
 * Section x module table for Full Practice Tests: rows are the sections, columns "Module 1",
 * "Module 2" (no always-empty cells). Same correct/total as sectionModuleMetrics; only the column
 * key changes (the module number instead of its full name). Shared by the student page and the PDF.
 */
export function moduleTableOf(sectionModuleMetrics: ProgressMetric[]) {
  const merged = new Map<string, ProgressMetric>();
  for (const metric of sectionModuleMetrics) {
    const column = moduleColumn(metric.difficulty);
    const key = `${metric.label}\u0000${column}`;
    const existing = merged.get(key);
    merged.set(key, existing
      ? { ...existing, correct: existing.correct + metric.correct, total: existing.total + metric.total }
      : { ...metric, difficulty: column });
  }
  const detail = [...merged.values()];
  const columns = [...new Set(detail.map((metric) => metric.difficulty))].sort((a, b) => a.localeCompare(b, "en", { numeric: true }));
  return { columns, detail };
}
