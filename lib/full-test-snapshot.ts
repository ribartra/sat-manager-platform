import prisma from "@/lib/prisma";
import { parseSnapshot, stringifySnapshot } from "@/lib/attempt-snapshots";

/**
 * Exam structure of an attempt (RNF-17). Taken when a FullPracticeTestAttempt starts and stored in
 * FullPracticeTestAttempt.testSnapshot: which modules, in which order, which questions (ids, order,
 * pretest flags). It never stores question content: the stem, options, answer key and explanation
 * always come from the live bank question (a fixed key re-grades submitted attempts, see
 * lib/attempt-regrade.ts), so editing the exam's structure never changes an attempt that started,
 * while fixing a question reaches every attempt.
 * Version 1 snapshots (they also copied the question content) are read as structure only.
 */

export const FULL_TEST_SNAPSHOT_VERSION = 2;

/** Prisma include that loads everything the snapshot needs. */
export const fullTestModulesInclude = {
  questions: {
    include: {
      question: {
        include: {
          topic: { include: { domain: true } },
          options: { orderBy: { label: "asc" as const } },
        },
      },
    },
    orderBy: { order: "asc" as const },
  },
} as const;

export interface FullTestSnapshotOption {
  id: string;
  label: string;
  text: string;
  imageUrl: string | null;
}

export interface FullTestSnapshotQuestion {
  id: string;
  stem: string;
  stimulus: string | null;
  type: string;
  difficulty: string;
  correctAnswer: string;
  explanation: string | null;
  imageUrl: string | null;
  supportsGraph: boolean;
  topic: { id: string; name: string; domain: { id: string; name: string } };
  options: FullTestSnapshotOption[];
}

/** A module as the attempt saw it, with the live question content (fullTestModulesForAttempt). */
export interface FullTestSnapshotModule extends FullTestStructureModule {
  questions: (FullTestStructureItem & { question: FullTestSnapshotQuestion })[];
}

export interface FullTestStructureItem {
  questionId: string;
  order: number;
  isPretest: boolean;
}

/** What testSnapshot stores per module: no question content. */
export interface FullTestStructureModule {
  id: string;
  name: string;
  section: string;
  order: number;
  timeLimit: number;
  questions: FullTestStructureItem[];
}

export interface FullTestSnapshot {
  version: number;
  takenAt: string;
  testId: string;
  modules: FullTestStructureModule[];
}

type LiveModule = {
  id: string;
  name: string;
  section: string;
  order: number;
  timeLimit: number;
  questions: {
    questionId: string;
    order: number;
    isPretest: boolean;
    question: {
      id: string;
      stem: string;
      stimulus: string | null;
      type: string;
      difficulty: string;
      correctAnswer: string;
      explanation: string | null;
      imageUrl: string | null;
      supportsGraph: boolean;
      topic: { id: string; name: string; domain: { id: string; name: string } };
      options: { id: string; label: string; text: string; imageUrl: string | null }[];
    };
  }[];
};

const questionContentInclude = {
  topic: { include: { domain: true } },
  options: { orderBy: { label: "asc" as const } },
} as const;

type LiveQuestion = LiveModule["questions"][number]["question"];

function questionContent(question: LiveQuestion): FullTestSnapshotQuestion {
  return {
    id: question.id,
    stem: question.stem,
    stimulus: question.stimulus,
    type: question.type,
    difficulty: question.difficulty,
    correctAnswer: question.correctAnswer,
    explanation: question.explanation,
    imageUrl: question.imageUrl,
    supportsGraph: question.supportsGraph,
    topic: { id: question.topic.id, name: question.topic.name, domain: { id: question.topic.domain.id, name: question.topic.domain.name } },
    options: [...question.options]
      .sort((a, b) => a.label.localeCompare(b.label))
      .map((option) => ({ id: option.id, label: option.label, text: option.text, imageUrl: option.imageUrl })),
  };
}

/** The exam's structure (modules, order, question ids, pretest flags), without question content. */
export function structureOf(
  modules: { id: string; name: string; section: string; order: number; timeLimit: number; questions: FullTestStructureItem[] }[],
): FullTestStructureModule[] {
  return [...modules]
    .sort((a, b) => a.order - b.order)
    .map((module) => ({
      id: module.id,
      name: module.name,
      section: module.section,
      order: module.order,
      timeLimit: module.timeLimit,
      questions: [...module.questions]
        .sort((a, b) => a.order - b.order)
        .map((item) => ({ questionId: item.questionId, order: item.order, isPretest: item.isPretest })),
    }));
}

export function buildFullTestSnapshot(testId: string, modules: FullTestStructureModule[]) {
  const snapshot: FullTestSnapshot = {
    version: FULL_TEST_SNAPSHOT_VERSION,
    takenAt: new Date().toISOString(),
    testId,
    modules: structureOf(modules),
  };
  return stringifySnapshot(snapshot);
}

/** Structure stored in the attempt, or null when the attempt has none (legacy). Synchronous, for list views. */
export function snapshotModulesOf(testSnapshot: string | null | undefined): FullTestStructureModule[] | null {
  const snapshot = parseSnapshot<FullTestSnapshot>(testSnapshot);
  return snapshot?.modules?.length ? structureOf(snapshot.modules) : null;
}

/**
 * The exam of an attempt: its stored structure (or, legacy attempts without one, the live exam's)
 * filled with the live content of each question (text, options, answer key, explanation, images).
 */
export async function fullTestModulesForAttempt(attempt: { testId: string; testSnapshot: string | null }): Promise<FullTestSnapshotModule[]> {
  const structure =
    snapshotModulesOf(attempt.testSnapshot) ??
    structureOf(
      await prisma.fullPracticeTestModule.findMany({
        where: { testId: attempt.testId },
        include: { questions: { select: { questionId: true, order: true, isPretest: true } } },
      }),
    );
  const ids = [...new Set(structure.flatMap((module) => module.questions.map((item) => item.questionId)))];
  const rows = ids.length ? await prisma.question.findMany({ where: { id: { in: ids } }, include: questionContentInclude }) : [];
  const questions = new Map(rows.map((row) => [row.id, questionContent(row)]));
  // Questions used by an attempt cannot be deleted (archived instead); a missing one is skipped.
  return structure.map((module) => ({
    ...module,
    questions: module.questions.flatMap((item) => {
      const question = questions.get(item.questionId);
      return question ? [{ ...item, question }] : [];
    }),
  }));
}
