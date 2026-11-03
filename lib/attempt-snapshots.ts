/**
 * Practice attempt structure: the set as the attempt saw it (question order, explanation visibility,
 * name). Attempts never copy question content: results and grading read the current question, and a
 * fixed answer key re-grades submitted attempts (lib/attempt-regrade.ts).
 */
interface SnapshotPracticeSet {
  id: string;
  name: string;
  difficulty: string;
  explanationVisibility: string;
  topic?: {
    id: string;
    name: string;
    domain?: {
      id: string;
      name: string;
      section?: {
        id: string;
        name: string;
        label: string;
      };
    };
  };
  questions?: { id: string; order: number }[];
}

export type PracticeSetSnapshot = SnapshotPracticeSet;

export function stringifySnapshot(value: unknown) {
  return JSON.stringify(value);
}

export function parseSnapshot<T>(value: string | null | undefined): T | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

export function buildPracticeSetSnapshot(practiceSet: {
  id: string;
  name: string;
  difficulty: string;
  explanationVisibility: string;
  topic?: SnapshotPracticeSet["topic"];
  questions?: { questionId: string; order: number }[];
}): PracticeSetSnapshot {
  return {
    id: practiceSet.id,
    name: practiceSet.name,
    difficulty: practiceSet.difficulty,
    explanationVisibility: practiceSet.explanationVisibility,
    topic: practiceSet.topic,
    questions: practiceSet.questions?.map((item) => ({
      id: item.questionId,
      order: item.order,
    })),
  };
}
