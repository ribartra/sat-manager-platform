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
  type MockSectionMetric,
  type ProgressMetric,
} from "@/lib/progress-analytics";
import { practiceAreaLabel, type PracticeAreaCode } from "@/lib/practice-area";
import { progressDateWhere } from "@/lib/progress-filters";
import { domainRank } from "@/lib/taxonomy-order";

const DIFFICULTY_LEVELS = ["EASY", "MEDIUM", "HARD"] as const;

export type ReportFilters = { topic?: string; difficulty?: string; from?: string; to?: string };

/**
 * One skill × level result: the last counted attempt of EACH practice set of that cell, summed and
 * weighted by questions (CB 8/10 + Cook 1/2 = 9/12 = 75%). `tries` counts every counted attempt.
 */
export type LevelResult = {
  correct: number;
  total: number;
  percent: number;
  tries: number;
  /** Practice sets with a counted attempt in this cell. */
  sets: number;
  lastAt: Date | null;
  /** The most recent of those attempts (link target). */
  latestAttemptId: string;
};

export type SkillResultRow = {
  topicId: string;
  domainId: string;
  domainName: string;
  label: string;
  /** EASY / MEDIUM / HARD → result over every source. */
  levels: Partial<Record<string, LevelResult>>;
};

/** One attempt's result (the only level the student profile reports at). */
export type AttemptRef = { attemptId: string; setName: string; submittedAt: Date | null; correct: number; total: number; percent: number | null };

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
  /** Practice only: try number within its assignment and the set's difficulty. */
  attemptNumber?: number;
  assignmentId?: string | null;
  difficulty?: string | null;
  /** Practice only: skill and source of the set (attempt accordions: skill → source → sets). */
  skillId?: string | null;
  skillName?: string | null;
  sourceName?: string | null;
  sourceOrder?: number | null;
};

export type PracticeReport = {
  practiceArea: PracticeAreaCode;
  areaLabel: string;
  /** Counts and sums only (attempt level: no pooled % across sets). */
  kpis: {
    attempts: number;
    totalTime: number;
    pending: number;
  };
  /**
   * Skill × difficulty results (domains in official order, skills A–Z): see LevelResult — the last
   * counted attempt of each set, weighted by questions, over every source.
   */
  skillResults: SkillResultRow[];
  /** The skill × level with the lowest weighted result, or null. */
  weakestSkill: { topicId: string; label: string; difficulty: string; correct: number; total: number; percent: number; attemptId: string } | null;
  /** Number of practice sets with a counted attempt. */
  latestSetCount: number;
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
            practiceSet: {
              include: {
                source: { select: { id: true, name: true, sortOrder: true } },
                questions: { include: { question: { include: { topic: true } } } },
              },
            },
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
      attemptNumber: attempt.attemptNumber,
      assignmentId: attempt.assignmentId,
      difficulty: attempt.assignment?.practiceSet.difficulty ?? null,
      skillId: attempt.assignment?.practiceSet.topicId ?? snapshot?.topic?.id ?? null,
      skillName:
        currentTopic.get(attempt.assignment?.practiceSet.topicId ?? "")?.name ?? snapshot?.topic?.name ?? null,
      sourceName: attempt.assignment?.practiceSet.source?.name ?? null,
      sourceOrder: attempt.assignment?.practiceSet.source?.sortOrder ?? null,
    };
  };
  const attempts = historyAttempts.filter((attempt) => attempt.status === "SUBMITTED");
  const rowsByAttempt = attempts.map(rowsForAttempt);
  const scoredAttempts: ReportAttempt[] = attempts.map((attempt, index) => scoreAttempt(attempt, rowsByAttempt[index] ?? []));
  const attemptHistory: ReportAttempt[] = historyAttempts.map((attempt) =>
    attempt.status === "SUBMITTED" ? scoredAttempts.find((scored) => scored.id === attempt.id)! : scoreAttempt(attempt, rowsForAttempt(attempt)),
  );

  // Skill results (SAT-001): per skill × level, the last counted attempt of EACH set, summed and
  // weighted by questions across sets and sources. Attempts stay identifiable in the history lists.
  // `attempts` / `scoredAttempts` are newest first.
  const setOf = (index: number) => attempts[index].assignment?.practiceSet ?? null;
  const latestIndexBySet = new Map<string, number>();
  const triesByCell = new Map<string, number>();
  attempts.forEach((attempt, index) => {
    // An attempt with no questions left after the skill/level filters is not part of this view.
    if (!scoredAttempts[index].total) return;
    const set = setOf(index);
    const setKey = attempt.assignmentId ?? attempt.id;
    if (!latestIndexBySet.has(setKey)) latestIndexBySet.set(setKey, index);
    if (!set) return;
    const cell = `${set.topicId}:${set.difficulty}`;
    triesByCell.set(cell, (triesByCell.get(cell) ?? 0) + 1);
  });
  type Acc = { correct: number; total: number; sets: number; lastAt: Date | null; latestAttemptId: string };
  const add = (map: Map<string, Acc>, key: string, index: number) => {
    const scored = scoredAttempts[index];
    const acc = map.get(key);
    if (!acc) {
      map.set(key, { correct: scored.correct, total: scored.total, sets: 1, lastAt: scored.submittedAt, latestAttemptId: scored.id });
      return;
    }
    acc.correct += scored.correct;
    acc.total += scored.total;
    acc.sets += 1;
    // Newest first: the first one added is the latest; keep it unless it had no date.
    if (!acc.lastAt && scored.submittedAt) {
      acc.lastAt = scored.submittedAt;
      acc.latestAttemptId = scored.id;
    }
  };
  const byCell = new Map<string, Acc>();
  const skillsSeen = new Map<string, { domainId: string; domainName: string; label: string }>();
  // Map iteration follows insertion = newest-first attempt order.
  for (const index of [...latestIndexBySet.values()].sort((a, b) => a - b)) {
    const set = setOf(index);
    if (!set) continue;
    const current = currentTopic.get(set.topicId);
    skillsSeen.set(set.topicId, {
      domainId: current?.domainId ?? "",
      domainName: current?.domain.name ?? "",
      label: current?.name ?? shortSetName(scoredAttempts[index].name),
    });
    add(byCell, `${set.topicId}:${set.difficulty}`, index);
  }
  const levelResult = (acc: Acc | undefined, triesKey: string): LevelResult | undefined =>
    acc ? { ...acc, percent: scorePercent(acc.correct, acc.total), tries: triesByCell.get(triesKey) ?? acc.sets } : undefined;
  const levelsFor = (topic: string) =>
    Object.fromEntries(
      DIFFICULTY_LEVELS.flatMap((level) => {
        const key = `${topic}:${level}`;
        const result = levelResult(byCell.get(key), key);
        return result ? [[level, result]] : [];
      }),
    );
  const skillResults: SkillResultRow[] = [...skillsSeen.entries()]
    .map(([topic, skill]) => ({
      topicId: topic,
      ...skill,
      levels: levelsFor(topic),
    }))
    .sort((x, y) => domainRank(x.domainId) - domainRank(y.domainId) || x.label.localeCompare(y.label, "en", { numeric: true, sensitivity: "base" }));
  // Weakest skill: the skill × level with the lowest weighted result.
  const weakest = skillResults
    .flatMap((row) => Object.entries(row.levels).map(([level, result]) => ({ row, level, result: result! })))
    .sort((a, b) => a.result.percent - b.result.percent || b.result.total - a.result.total)[0];

  return {
    practiceArea,
    areaLabel: practiceAreaLabel(practiceArea),
    kpis: {
      attempts: scoredAttempts.length,
      totalTime: sumAttemptElapsedTime(scoredAttempts),
      pending: assignments.length,
    },
    skillResults,
    weakestSkill: weakest
      ? {
          topicId: weakest.row.topicId,
          label: weakest.row.label,
          difficulty: weakest.level,
          correct: weakest.result.correct,
          total: weakest.result.total,
          percent: weakest.result.percent,
          attemptId: weakest.result.latestAttemptId,
        }
      : null,
    latestSetCount: latestIndexBySet.size,
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
  // One chart point per try: a retaken Test gets "· try N" so its points are not two identical labels.
  const chronological = [...examAttempts].reverse();
  const triesPerTest = new Map<string, number>();
  for (const exam of chronological) triesPerTest.set(exam.testId, (triesPerTest.get(exam.testId) ?? 0) + 1);
  const trySeen = new Map<string, number>();
  const seriesLabel = (exam: (typeof examAttempts)[number]) => {
    const n = (trySeen.get(exam.testId) ?? 0) + 1;
    trySeen.set(exam.testId, n);
    return (triesPerTest.get(exam.testId) ?? 1) > 1 ? `${exam.test.name} · try ${n}` : exam.test.name;
  };
  return {
    kpis: {
      exams: examAttempts.length,
      latestTotal: latest?.totalScore ?? null,
      latestRw: latest?.rwScore ?? null,
      latestMath: latest?.mathScore ?? null,
      pending: examAssignments.length,
    },
    scoreSeries: chronological.map((exam) => ({
      attempts: 1,
      label: seriesLabel(exam),
      submittedAt: exam.submittedAt?.toISOString() ?? null,
      mathScore: exam.mathScore,
      rwScore: exam.rwScore,
      totalScore: exam.totalScore,
      timeSeconds: exam.answers.reduce((sum, a) => sum + (a.timeSpent ?? 0), 0) || null,
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
