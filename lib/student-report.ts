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

export type SkillMatrixRow = {
  topicId: string;
  domainId: string;
  label: string;
  cells: Record<string, { correct: number; total: number; tries: number; percent: number; attemptId: string }>;
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
  /** The last attempt of each skill × level, lowest first (PDF "Skills to work on next"). */
  weakSkills: WeakSkill[];
  /**
   * Skill × difficulty, skills in alphabetical order: each cell is the most recent counted attempt of
   * that skill and level (attempt level, never pooled); `tries` counts the counted attempts.
   */
  skillMatrix: SkillMatrixRow[];
  /** Easy / Medium / Hard: the most recent counted attempt at each level (null = none yet). */
  difficultySummary: Record<string, AttemptRef | null>;
  /** The lowest last attempt among the sets (skill + level of that set), or null. */
  weakestSkill: (AttemptRef & { topicId: string; label: string; difficulty: string }) | null;
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
      attemptNumber: attempt.attemptNumber,
      assignmentId: attempt.assignmentId,
      difficulty: attempt.assignment?.practiceSet.difficulty ?? null,
    };
  };
  const attempts = historyAttempts.filter((attempt) => attempt.status === "SUBMITTED");
  const rowsByAttempt = attempts.map(rowsForAttempt);
  const scoredAttempts: ReportAttempt[] = attempts.map((attempt, index) => scoreAttempt(attempt, rowsByAttempt[index] ?? []));
  const attemptHistory: ReportAttempt[] = historyAttempts.map((attempt) =>
    attempt.status === "SUBMITTED" ? scoredAttempts.find((scored) => scored.id === attempt.id)! : scoreAttempt(attempt, rowsForAttempt(attempt)),
  );

  // Attempt level only (product rule: no averages across Tests or across the sets of a Section).
  // Every figure below is ONE attempt's result. `attempts` / `scoredAttempts` are newest first.
  const setOf = (index: number) => attempts[index].assignment?.practiceSet ?? null;
  const latestIndexBySet = new Map<string, number>();
  const latestIndexByCell = new Map<string, number>();
  const triesByCell = new Map<string, number>();
  attempts.forEach((attempt, index) => {
    // An attempt with no questions left after the skill/level filters is not part of this view.
    if (!scoredAttempts[index].total) return;
    const set = setOf(index);
    const setKey = attempt.assignmentId ?? attempt.id;
    if (!latestIndexBySet.has(setKey)) latestIndexBySet.set(setKey, index);
    if (!set) return;
    const cell = `${set.topicId}:${set.difficulty}`;
    if (!latestIndexByCell.has(cell)) latestIndexByCell.set(cell, index);
    triesByCell.set(cell, (triesByCell.get(cell) ?? 0) + 1);
  });
  const attemptRef = (index: number) => {
    const scored = scoredAttempts[index];
    return { attemptId: scored.id, setName: shortSetName(scored.name), submittedAt: scored.submittedAt, correct: scored.correct, total: scored.total, percent: scored.total ? scored.percent : null };
  };
  // Easy / Medium / Hard: the most recent attempt at each level.
  const difficultySummary = Object.fromEntries(
    ["EASY", "MEDIUM", "HARD"].map((level) => {
      const index = attempts.findIndex((_, i) => setOf(i)?.difficulty === level && scoredAttempts[i].total > 0);
      return [level, index >= 0 ? attemptRef(index) : null];
    }),
  ) as PracticeReport["difficultySummary"];
  // Weakest skill: the lowest last attempt among the sets.
  const weakestIndex = [...latestIndexBySet.values()]
    .filter((index) => setOf(index) && scoredAttempts[index].percent !== null)
    .sort((a, b) => (scoredAttempts[a].percent ?? 0) - (scoredAttempts[b].percent ?? 0))[0];
  // Skills to work on next (PDF): the last attempt of each skill × level, lowest first.
  const weakest = [...latestIndexByCell.entries()]
    .map(([key, index]) => {
      const scored = scoredAttempts[index];
      const set = setOf(index)!;
      const current = currentTopic.get(set.topicId);
      return [key, {
        topicId: set.topicId,
        domainId: current?.domainId ?? "",
        label: current?.name ?? shortSetName(scored.name),
        difficulty: set.difficulty,
        correct: scored.correct,
        total: scored.total,
        avgTime: scored.total && scored.totalTime ? Math.round(scored.totalTime / scored.total) : null,
      }] as const;
    })
    .sort(([, a], [, b]) => scorePercent(a.correct, a.total) - scorePercent(b.correct, b.total) || b.total - a.total)
    .slice(0, 12);
  const weakTopicIds = [...new Set(weakest.map(([, bucket]) => bucket.topicId))];
  const setsForWeakSkills = weakTopicIds.length
    ? await prisma.practiceSet.findMany({
        // Assignable only from a program the student is enrolled in (program = tenant).
        where: { topicId: { in: weakTopicIds }, status: "PUBLISHED", program: { deletedAt: null, enrollments: { some: { studentId, active: true, status: "APPROVED" } } } },
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
      avgTime: bucket.avgTime,
      recommendation: recommendationFor(percent),
      assignableIds: assignable.map((set) => set.id),
      pendingCount: sets.length - assignable.length,
    };
  });

  // Skill x difficulty matrix (skills A–Z): each cell is the most recent attempt of that skill and level.
  const cellSkills = [...new Map([...latestIndexByCell.values()].map((index) => {
    const topicId = setOf(index)!.topicId;
    const current = currentTopic.get(topicId);
    return [topicId, { id: topicId, name: current?.name ?? shortSetName(scoredAttempts[index].name), domainId: current?.domainId ?? "", domainName: current?.domain.name ?? "" }];
  })).values()].sort((x, y) => x.name.localeCompare(y.name, "en", { numeric: true, sensitivity: "base" }));
  const skillMatrix: SkillMatrixRow[] = cellSkills.map((skill) => ({
    topicId: skill.id,
    domainId: skill.domainId,
    label: skill.name,
    cells: Object.fromEntries(
      [...latestIndexByCell.entries()]
        .filter(([cell]) => cell.startsWith(`${skill.id}:`))
        .map(([cell, index]) => {
          const scored = scoredAttempts[index];
          return [
            cell.slice(skill.id.length + 1),
            { correct: scored.correct, total: scored.total, tries: triesByCell.get(cell) ?? 1, percent: scorePercent(scored.correct, scored.total), attemptId: scored.id },
          ];
        }),
    ),
  }));


  return {
    practiceArea,
    areaLabel: practiceAreaLabel(practiceArea),
    kpis: {
      attempts: scoredAttempts.length,
      totalTime: sumAttemptElapsedTime(scoredAttempts),
      pending: assignments.length,
    },
    weakSkills,
    skillMatrix,
    difficultySummary,
    weakestSkill:
      weakestIndex !== undefined
        ? {
            topicId: setOf(weakestIndex)!.topicId,
            label: currentTopic.get(setOf(weakestIndex)!.topicId)?.name ?? shortSetName(scoredAttempts[weakestIndex].name),
            difficulty: setOf(weakestIndex)!.difficulty,
            ...attemptRef(weakestIndex),
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
