import { isAnswerCorrect } from "@/lib/answer-grading";
import { resolveQuestionType } from "@/lib/question-type";
import { sectionScore } from "@/lib/full-test-scoring";
import { completedModulesOf } from "@/lib/full-test-progress";
import { MODULE_KEYS, type ModuleKey } from "@/lib/test-module-keys";
import type { FullTestSnapshotModule } from "@/lib/full-test-snapshot";

/**
 * View model for a Test (Full Practice Test) and one attempt: per-module status and results, and
 * the SAT section scores. Section scores (200–800) are shown only when both modules of the section
 * are submitted; the total (400–1600) only when all 4 are. Partial results are never estimated.
 */

export type SectionCode = "RW" | "MATH";
export type ModuleState = "todo" | "progress" | "done";
/** Status of a practice set or a Test for the student: Not started / In progress / Completed. */
export type WorkState = ModuleState;

export interface ModuleView {
  index: number;
  key: ModuleKey;
  name: string;
  /** "R&W 1", "R&W 2", "Math 1", "Math 2" */
  short: string;
  section: SectionCode;
  /** Module 1 is Standard, Module 2 is Harder. */
  tier: "Standard" | "Harder";
  questionCount: number;
  minutes: number;
  state: ModuleState;
  right: number;
  wrong: number;
  blank: number;
  /** % correct, only for submitted modules. */
  pct: number | null;
}

export interface SectionView {
  section: SectionCode;
  label: string;
  modulesDone: number;
  modulesTotal: number;
  complete: boolean;
  /** Scaled 200–800, only when complete. */
  score: number | null;
  right: number;
  counted: number;
}

export interface TestAttemptView {
  modules: ModuleView[];
  sections: { RW: SectionView; MATH: SectionView };
  /** 400–1600, only when every module is done. */
  total: number | null;
  modulesDone: number;
  nextModule: ModuleView | null;
}

type ModuleLike = Pick<FullTestSnapshotModule, "name" | "section" | "timeLimit"> & {
  questions: { questionId: string; isPretest?: boolean; question?: { correctAnswer: string; type: string; options: { label: string; text: string; imageUrl?: string | null }[] } }[];
};

export function sectionLabel(section: SectionCode) {
  return section === "MATH" ? "Math" : "Reading & Writing";
}

function moduleMeta(modules: ModuleLike[], index: number) {
  const testModule = modules[index];
  const section: SectionCode = testModule.section === "MATH" ? "MATH" : "RW";
  const position = modules.slice(0, index + 1).filter((m) => (m.section === "MATH" ? "MATH" : "RW") === section).length;
  return {
    index,
    key: MODULE_KEYS[index] ?? MODULE_KEYS[0],
    name: testModule.name,
    short: `${section === "MATH" ? "Math" : "R&W"} ${position}`,
    section,
    tier: position === 1 ? ("Standard" as const) : ("Harder" as const),
    questionCount: testModule.questions.length,
    minutes: Math.round(testModule.timeLimit / 60),
  };
}

/** Modules of a Test before any attempt (all "todo"). */
export function moduleViewsForTest(modules: ModuleLike[]): ModuleView[] {
  return modules.map((_, index) => ({ ...moduleMeta(modules, index), state: "todo", right: 0, wrong: 0, blank: 0, pct: null }));
}

/**
 * One attempt's view. `answers` are the stored FullPracticeTestAnswer rows. For a submitted attempt
 * every module is done and stored `isCorrect` is used; for an open attempt only modules in
 * completedModules are done and they are graded here against the attempt snapshot.
 */
export function buildTestAttemptView(input: {
  modules: ModuleLike[];
  status: string;
  moduleTimerState: string | null;
  answers: { questionId: string; answer: string | null; isCorrect: boolean | null }[];
  rwScore?: number | null;
  mathScore?: number | null;
  totalScore?: number | null;
  excludePretest?: boolean;
}): TestAttemptView {
  const { modules } = input;
  const submitted = input.status !== "IN_PROGRESS";
  const completed = new Set(submitted ? modules.map((_, i) => i) : completedModulesOf(input.moduleTimerState, modules.length));
  const byQuestion = new Map(input.answers.map((a) => [a.questionId, a]));

  const sectionCounts = { RW: { right: 0, counted: 0 }, MATH: { right: 0, counted: 0 } };
  const views: ModuleView[] = modules.map((testModule, index) => {
    const meta = moduleMeta(modules, index);
    const done = completed.has(index);
    const touched = testModule.questions.some((q) => (byQuestion.get(q.questionId)?.answer ?? "") !== "");
    let right = 0;
    let blank = 0;
    if (done) {
      for (const item of testModule.questions) {
        const row = byQuestion.get(item.questionId);
        const answer = row?.answer ?? "";
        if (!answer) blank += 1;
        const correct = submitted && row?.isCorrect !== null && row?.isCorrect !== undefined
          ? Boolean(row.isCorrect)
          : Boolean(answer) && item.question
            ? isAnswerCorrect(answer, item.question.correctAnswer, resolveQuestionType(item.question.type, item.question.options))
            : false;
        if (correct) right += 1;
        if (!input.excludePretest || !item.isPretest) {
          sectionCounts[meta.section].counted += 1;
          if (correct) sectionCounts[meta.section].right += 1;
        }
      }
    }
    const n = testModule.questions.length;
    return {
      ...meta,
      state: done ? "done" : touched ? "progress" : "todo",
      right,
      wrong: done ? n - right - blank : 0,
      blank,
      pct: done && n ? Math.round((right / n) * 100) : null,
    };
  });

  const section = (code: SectionCode): SectionView => {
    const mods = views.filter((v) => v.section === code);
    const modulesDone = mods.filter((v) => v.state === "done").length;
    const complete = mods.length > 0 && modulesDone === mods.length;
    const stored = code === "RW" ? input.rwScore : input.mathScore;
    return {
      section: code,
      label: sectionLabel(code),
      modulesDone,
      modulesTotal: mods.length,
      complete,
      score: complete ? (submitted && stored !== null && stored !== undefined ? stored : sectionScore(sectionCounts[code].right, sectionCounts[code].counted)) : null,
      right: sectionCounts[code].right,
      counted: sectionCounts[code].counted,
    };
  };
  const sections = { RW: section("RW"), MATH: section("MATH") };
  const modulesDone = views.filter((v) => v.state === "done").length;
  const total = modulesDone === views.length && sections.RW.score !== null && sections.MATH.score !== null
    ? (submitted && input.totalScore !== null && input.totalScore !== undefined ? input.totalScore : sections.RW.score + sections.MATH.score)
    : null;
  // Continue where the student was: an open module first, then the first not started.
  const nextModule = views.find((v) => v.state === "progress") ?? views.find((v) => v.state === "todo") ?? null;
  return { modules: views, sections, total, modulesDone, nextModule };
}
