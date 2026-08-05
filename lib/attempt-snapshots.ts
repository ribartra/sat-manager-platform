interface SnapshotOption {
  label: string;
  text: string;
  imageUrl?: string | null;
}

interface SnapshotQuestion {
  id: string;
  stem: string;
  stimulus: string | null;
  type: string;
  difficulty: string;
  correctAnswer: string;
  explanation: string | null;
  imageUrl?: string | null;
  supportsGraph?: boolean;
  order?: number;
  options?: SnapshotOption[];
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
}

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

export type QuestionSnapshot = SnapshotQuestion;
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

export function buildQuestionSnapshot(item: {
  order?: number;
  question: {
    id: string;
    stem: string;
    stimulus: string | null;
    type: string;
    difficulty: string;
    correctAnswer: string;
    explanation: string | null;
    imageUrl?: string | null;
    supportsGraph?: boolean;
    options?: SnapshotOption[];
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
  };
}): QuestionSnapshot {
  return {
    id: item.question.id,
    stem: item.question.stem,
    stimulus: item.question.stimulus,
    type: item.question.type,
    difficulty: item.question.difficulty,
    correctAnswer: item.question.correctAnswer,
    explanation: item.question.explanation,
    imageUrl: item.question.imageUrl ?? null,
    supportsGraph: item.question.supportsGraph ?? false,
    order: item.order,
    options: item.question.options?.map((option) => ({
      label: option.label,
      text: option.text,
      imageUrl: option.imageUrl ?? null,
    })),
    topic: item.question.topic,
  };
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
