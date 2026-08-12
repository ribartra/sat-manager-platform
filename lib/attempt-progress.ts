/**
 * Progress helpers for Practice Set and Full Practice Test attempts.
 * % = answered / total (non-empty answer). Position uses persisted indices.
 */

export function countAnswered(answers: Record<string, string | null | undefined> | { answer?: string | null }[]): number {
  if (Array.isArray(answers)) {
    return answers.filter((row) => Boolean((row.answer ?? "").toString().trim())).length;
  }
  return Object.values(answers).filter((value) => Boolean((value ?? "").toString().trim())).length;
}

export function progressPercent(answered: number, total: number): number {
  if (!total) return 0;
  return Math.max(0, Math.min(100, Math.round((answered / total) * 100)));
}

export type PracticeProgress = {
  answered: number;
  total: number;
  percent: number;
  positionLabel: string | null;
};

export function practiceAttemptProgress(input: {
  totalQuestions: number;
  answers: { answer?: string | null }[];
  currentQuestion: number;
  status: string;
}): PracticeProgress {
  const answered = countAnswered(input.answers);
  const total = input.totalQuestions;
  const percent = progressPercent(answered, total);
  const positionLabel =
    input.status === "IN_PROGRESS"
      ? `Question ${Math.min(input.currentQuestion + 1, Math.max(total, 1))} of ${total}`
      : null;
  return { answered, total, percent, positionLabel };
}

export type FullTestModuleProgress = {
  moduleIndex: number;
  name: string;
  section: string;
  answered: number;
  total: number;
  percent: number;
};

export type FullTestProgress = {
  answered: number;
  total: number;
  percent: number;
  positionLabel: string | null;
  modules: FullTestModuleProgress[];
};

export function fullTestAttemptProgress(input: {
  modules: { name: string; section: string; questionIds: string[] }[];
  answers: { questionId: string; answer?: string | null }[];
  currentModule: number;
  currentQuestion: number;
  status: string;
  phase?: "MODULE" | "BREAK";
}): FullTestProgress {
  const answerByQuestion = new Map(input.answers.map((row) => [row.questionId, row.answer ?? ""]));
  const modules: FullTestModuleProgress[] = input.modules.map((module, moduleIndex) => {
    const answered = module.questionIds.filter((id) => Boolean((answerByQuestion.get(id) ?? "").trim())).length;
    const total = module.questionIds.length;
    return {
      moduleIndex,
      name: module.name,
      section: module.section,
      answered,
      total,
      percent: progressPercent(answered, total),
    };
  });
  const answered = modules.reduce((sum, module) => sum + module.answered, 0);
  const total = modules.reduce((sum, module) => sum + module.total, 0);
  const current = modules[input.currentModule];
  let positionLabel: string | null = null;
  if (input.status === "IN_PROGRESS") {
    if (input.phase === "BREAK") {
      positionLabel = "Break between R&W and Math";
    } else if (current) {
      positionLabel = `${current.name} · Question ${Math.min(input.currentQuestion + 1, Math.max(current.total, 1))} of ${current.total}`;
    }
  }
  return {
    answered,
    total,
    percent: progressPercent(answered, total),
    positionLabel,
    modules,
  };
}
