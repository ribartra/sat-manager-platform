export type Difficulty = "EASY" | "MEDIUM" | "HARD";

export type ProgressMetric = {
  label: string;
  difficulty: string;
  correct: number;
  total: number;
  attempts: number;
  timeSeconds: number;
  attemptDetails: ProgressAttemptDetail[];
};

export type ProgressAttemptDetail = {
  attemptId: string;
  label: string;
  submittedAt: string | null;
  correct: number;
  total: number;
};

type ProgressRow = {
  difficulty: string | null | undefined;
  correct: boolean;
  timeSeconds?: number | null;
  attemptId?: string;
  attemptLabel?: string;
  submittedAt?: Date | string | null;
};

type TopicProgressRow = ProgressRow & { topic: string | null | undefined };
type InternalProgressMetric = Omit<ProgressMetric, "attemptDetails"> & {
  attemptIds: Set<string>;
  details: Map<string, ProgressAttemptDetail>;
};

export type MockSectionMetric = {
  label: string;
  submittedAt: string | null;
  mathScore: number | null;
  rwScore: number | null;
  totalScore: number | null;
  attempts: number;
};

export type TopicTrendPoint = {
  attemptLabel: string;
  submittedAt: string | null;
  easy: number | null;
  medium: number | null;
  hard: number | null;
};

export const DIFFICULTY_ORDER: Difficulty[] = ["EASY", "MEDIUM", "HARD"];

export function metricAccuracy(metric: Pick<ProgressMetric, "correct" | "total">): number {
  return metric.total > 0 ? Math.round((metric.correct / metric.total) * 100) : 0;
}

export function sortDifficultyMetrics(metrics: ProgressMetric[]) {
  return [...metrics].sort(
    (a, b) =>
      (DIFFICULTY_ORDER.indexOf(a.difficulty as Difficulty) < 0 ? DIFFICULTY_ORDER.length : DIFFICULTY_ORDER.indexOf(a.difficulty as Difficulty)) -
        (DIFFICULTY_ORDER.indexOf(b.difficulty as Difficulty) < 0 ? DIFFICULTY_ORDER.length : DIFFICULTY_ORDER.indexOf(b.difficulty as Difficulty)) ||
      a.label.localeCompare(b.label),
  );
}

export function aggregateDifficultyMetrics(
  rows: ProgressRow[],
): ProgressMetric[] {
  const map = new Map<string, InternalProgressMetric>();
  for (const row of rows) {
    const difficulty = row.difficulty || "UNSPECIFIED";
    const metric = map.get(difficulty) ?? {
      label: difficulty,
      difficulty,
      correct: 0,
      total: 0,
      attempts: 0,
      timeSeconds: 0,
      attemptIds: new Set<string>(),
      details: new Map<string, ProgressAttemptDetail>(),
    };
    metric.total += 1;
    if (row.correct) metric.correct += 1;
    metric.timeSeconds += row.timeSeconds ?? 0;
    if (row.attemptId) {
      metric.attemptIds.add(row.attemptId);
      const detail = metric.details.get(row.attemptId) ?? {
        attemptId: row.attemptId,
        label: row.attemptLabel ?? "Submitted attempt",
        submittedAt: row.submittedAt ? new Date(row.submittedAt).toISOString() : null,
        correct: 0,
        total: 0,
      };
      detail.total += 1;
      if (row.correct) detail.correct += 1;
      metric.details.set(row.attemptId, detail);
    }
    map.set(difficulty, metric);
  }
  return sortDifficultyMetrics([...map.values()].map(({ attemptIds, details, ...metric }) => ({
    ...metric,
    attempts: attemptIds.size,
    attemptDetails: sortAttemptDetails(details),
  })));
}

export function aggregateTopicDifficultyMetrics(
  rows: TopicProgressRow[],
): ProgressMetric[] {
  const map = new Map<string, InternalProgressMetric>();
  for (const row of rows) {
    const label = row.topic || "Unclassified topic";
    const difficulty = row.difficulty || "UNSPECIFIED";
    const key = `${label}\u0000${difficulty}`;
    const metric = map.get(key) ?? {
      label,
      difficulty,
      correct: 0,
      total: 0,
      attempts: 0,
      timeSeconds: 0,
      attemptIds: new Set<string>(),
      details: new Map<string, ProgressAttemptDetail>(),
    };
    metric.total += 1;
    if (row.correct) metric.correct += 1;
    metric.timeSeconds += row.timeSeconds ?? 0;
    if (row.attemptId) {
      metric.attemptIds.add(row.attemptId);
      const detail = metric.details.get(row.attemptId) ?? {
        attemptId: row.attemptId,
        label: row.attemptLabel ?? "Submitted attempt",
        submittedAt: row.submittedAt ? new Date(row.submittedAt).toISOString() : null,
        correct: 0,
        total: 0,
      };
      detail.total += 1;
      if (row.correct) detail.correct += 1;
      metric.details.set(row.attemptId, detail);
    }
    map.set(key, metric);
  }
  return [...map.values()].map(({ attemptIds, details, ...metric }) => ({
    ...metric,
    attempts: attemptIds.size,
    attemptDetails: sortAttemptDetails(details),
  })).sort(
    (a, b) => {
      const aOrder = DIFFICULTY_ORDER.indexOf(a.difficulty as Difficulty);
      const bOrder = DIFFICULTY_ORDER.indexOf(b.difficulty as Difficulty);
      return a.label.localeCompare(b.label) || (aOrder < 0 ? DIFFICULTY_ORDER.length : aOrder) - (bOrder < 0 ? DIFFICULTY_ORDER.length : bOrder);
    },
  );
}

function sortAttemptDetails(details: Map<string, ProgressAttemptDetail>): ProgressAttemptDetail[] {
  return [...details.values()].sort((a, b) => {
    const aTime = a.submittedAt ? new Date(a.submittedAt).getTime() : 0;
    const bTime = b.submittedAt ? new Date(b.submittedAt).getTime() : 0;
    return bTime - aTime || a.label.localeCompare(b.label);
  });
}

export function aggregateTopicDifficultyTrend(
  rows: Array<{ topic: string; difficulty: string; correct: boolean; attemptId: string }>,
  attempts: Array<{ id: string; label: string; submittedAt: Date | string | null }>,
): Record<string, TopicTrendPoint[]> {
  const topics = new Set(rows.map((row) => row.topic));
  const orderedAttempts = [...attempts].sort((a, b) => {
    const aTime = a.submittedAt ? new Date(a.submittedAt).getTime() : 0;
    const bTime = b.submittedAt ? new Date(b.submittedAt).getTime() : 0;
    return aTime - bTime;
  });

  return Object.fromEntries([...topics].sort((a, b) => a.localeCompare(b)).map((topic) => {
    const points = orderedAttempts.map((attempt) => {
      const counts: Record<string, { correct: number; total: number }> = {};
      for (const row of rows) {
        if (row.topic !== topic || row.attemptId !== attempt.id) continue;
        const stat = counts[row.difficulty] ?? { correct: 0, total: 0 };
        stat.total += 1;
        if (row.correct) stat.correct += 1;
        counts[row.difficulty] = stat;
      }
      const accuracy = (difficulty: string) => {
        const stat = counts[difficulty];
        return stat?.total ? Math.round((stat.correct / stat.total) * 100) : null;
      };
      return {
        attemptLabel: attempt.label,
        submittedAt: attempt.submittedAt ? new Date(attempt.submittedAt).toISOString() : null,
        easy: accuracy("EASY"),
        medium: accuracy("MEDIUM"),
        hard: accuracy("HARD"),
      };
    });
    return [topic, points];
  }));
}

export function narrativeForAccuracy(accuracy: number | null, label: string): string {
  if (accuracy === null) return `There is not enough submitted activity in ${label} yet.`;
  if (accuracy >= 80) return `${label} is a current strength. Keep practicing to maintain consistency.`;
  if (accuracy >= 60) return `${label} is developing. Reviewing missed questions should improve consistency.`;
  return `${label} needs focused reinforcement. Review explanations and practice the foundational topics again.`;
}
