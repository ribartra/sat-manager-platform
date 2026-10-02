import prisma from "@/lib/prisma";
import { parseSnapshot, stringifySnapshot } from "@/lib/attempt-snapshots";

/**
 * Immutable exam snapshot (RNF-17). Taken when a FullPracticeTestAttempt starts and stored in
 * FullPracticeTestAttempt.testSnapshot: the player, submit grading and both results pages read
 * the exam from it, so editing the exam (modules, order, pretest flags) or its questions (stem,
 * options, answer key, explanation) never changes an attempt that already started.
 * Attempts from before snapshots existed fall back to the live rows (and were backfilled once,
 * flagged `backfilled: true`, see scripts/backfill-fpt-snapshots.ts).
 */

export const FULL_TEST_SNAPSHOT_VERSION = 1;

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

export interface FullTestSnapshotModule {
  id: string;
  name: string;
  section: string;
  order: number;
  timeLimit: number;
  questions: { questionId: string; order: number; isPretest: boolean; question: FullTestSnapshotQuestion }[];
}

export interface FullTestSnapshot {
  version: number;
  takenAt: string;
  backfilled?: boolean;
  testId: string;
  modules: FullTestSnapshotModule[];
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

export function snapshotModules(modules: LiveModule[]): FullTestSnapshotModule[] {
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
        .map((item) => ({
          questionId: item.questionId,
          order: item.order,
          isPretest: item.isPretest,
          question: {
            id: item.question.id,
            stem: item.question.stem,
            stimulus: item.question.stimulus,
            type: item.question.type,
            difficulty: item.question.difficulty,
            correctAnswer: item.question.correctAnswer,
            explanation: item.question.explanation,
            imageUrl: item.question.imageUrl,
            supportsGraph: item.question.supportsGraph,
            topic: {
              id: item.question.topic.id,
              name: item.question.topic.name,
              domain: { id: item.question.topic.domain.id, name: item.question.topic.domain.name },
            },
            options: [...item.question.options]
              .sort((a, b) => a.label.localeCompare(b.label))
              .map((option) => ({ id: option.id, label: option.label, text: option.text, imageUrl: option.imageUrl })),
          },
        })),
    }));
}

export function buildFullTestSnapshot(testId: string, modules: LiveModule[], opts: { backfilled?: boolean } = {}) {
  const snapshot: FullTestSnapshot = {
    version: FULL_TEST_SNAPSHOT_VERSION,
    takenAt: new Date().toISOString(),
    ...(opts.backfilled ? { backfilled: true } : {}),
    testId,
    modules: snapshotModules(modules),
  };
  return stringifySnapshot(snapshot);
}

export async function loadLiveFullTestModules(testId: string) {
  const modules = await prisma.fullPracticeTestModule.findMany({
    where: { testId },
    include: fullTestModulesInclude,
    orderBy: { order: "asc" },
  });
  return snapshotModules(modules);
}

/** Snapshot modules, or null when the attempt has none (legacy). Synchronous, for list views. */
export function snapshotModulesOf(testSnapshot: string | null | undefined) {
  const snapshot = parseSnapshot<FullTestSnapshot>(testSnapshot);
  return snapshot?.modules?.length ? snapshot.modules : null;
}

/**
 * The exam as the attempt saw it: the stored snapshot, or (legacy attempts without one) the
 * live exam rows in the same shape.
 */
export async function fullTestModulesForAttempt(attempt: { testId: string; testSnapshot: string | null }) {
  return snapshotModulesOf(attempt.testSnapshot) ?? loadLiveFullTestModules(attempt.testId);
}
