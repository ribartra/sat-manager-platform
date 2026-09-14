export type Difficulty = "EASY" | "MEDIUM" | "HARD";

export type ProgressMetric = {
  label: string;
  difficulty: string;
  correct: number;
  total: number;
  timeSeconds: number;
};

export type MockSectionMetric = {
  label: string;
  submittedAt: string | null;
  mathScore: number | null;
  rwScore: number | null;
  totalScore: number | null;
};

export const DIFFICULTY_ORDER: Difficulty[] = ["EASY", "MEDIUM", "HARD"];

export function metricAccuracy(metric: Pick<ProgressMetric, "correct" | "total">): number {
  return metric.total > 0 ? Math.round((metric.correct / metric.total) * 100) : 0;
}

export function sortDifficultyMetrics(metrics: ProgressMetric[]) {
  return [...metrics].sort(
    (a, b) =>
      DIFFICULTY_ORDER.indexOf(a.difficulty as Difficulty) - DIFFICULTY_ORDER.indexOf(b.difficulty as Difficulty) ||
      a.label.localeCompare(b.label),
  );
}

export function aggregateDifficultyMetrics(
  rows: Array<{ difficulty: string | null | undefined; correct: boolean; timeSeconds?: number | null }>,
): ProgressMetric[] {
  const map = new Map<string, ProgressMetric>();
  for (const row of rows) {
    const difficulty = row.difficulty || "UNSPECIFIED";
    const metric = map.get(difficulty) ?? { label: difficulty, difficulty, correct: 0, total: 0, timeSeconds: 0 };
    metric.total += 1;
    if (row.correct) metric.correct += 1;
    metric.timeSeconds += row.timeSeconds ?? 0;
    map.set(difficulty, metric);
  }
  return sortDifficultyMetrics([...map.values()]);
}

export function aggregateTopicDifficultyMetrics(
  rows: Array<{
    topic: string | null | undefined;
    difficulty: string | null | undefined;
    correct: boolean;
    timeSeconds?: number | null;
  }>,
): ProgressMetric[] {
  const map = new Map<string, ProgressMetric>();
  for (const row of rows) {
    const label = row.topic || "Unclassified topic";
    const difficulty = row.difficulty || "UNSPECIFIED";
    const key = `${label}\u0000${difficulty}`;
    const metric = map.get(key) ?? { label, difficulty, correct: 0, total: 0, timeSeconds: 0 };
    metric.total += 1;
    if (row.correct) metric.correct += 1;
    metric.timeSeconds += row.timeSeconds ?? 0;
    map.set(key, metric);
  }
  return [...map.values()].sort(
    (a, b) => a.label.localeCompare(b.label) || DIFFICULTY_ORDER.indexOf(a.difficulty as Difficulty) - DIFFICULTY_ORDER.indexOf(b.difficulty as Difficulty),
  );
}

export function narrativeForAccuracy(accuracy: number | null, label: string): string {
  if (accuracy === null) return `There is not enough submitted activity in ${label} yet.`;
  if (accuracy >= 80) return `${label} is a current strength. Keep practicing to maintain consistency.`;
  if (accuracy >= 60) return `${label} is developing. Reviewing missed questions should improve consistency.`;
  return `${label} needs focused reinforcement. Review explanations and practice the foundational topics again.`;
}
