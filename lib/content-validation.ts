const QUESTION_TYPES = new Set(["MC", "NUMERIC"]);
const DIFFICULTIES = new Set(["EASY", "MEDIUM", "HARD"]);
const QUESTION_STATUSES = new Set(["DRAFT", "PUBLISHED", "ARCHIVED"]);
const PRACTICE_SET_STATUSES = new Set(["DRAFT", "PUBLISHED", "BLOCKED", "ARCHIVED"]);
const EXPLANATION_VISIBILITIES = new Set(["IMMEDIATE", "AFTER_FINISH", "HIDDEN"]);
const MC_LABELS = ["A", "B", "C", "D"];

interface QuestionPayload {
  topicId?: string;
  difficulty?: string;
  type?: string;
  stem?: string;
  explanation?: string | null;
  correctAnswer?: string;
  status?: string;
  options?: { label: string; text: string; imageUrl?: string | null }[];
}

interface PracticeSetPayload {
  name?: string;
  topicId?: string;
  difficulty?: string;
  status?: string;
  explanationVisibility?: string;
  questionIds?: string[];
}

export function validateQuestionPayload(payload: QuestionPayload) {
  const errors: string[] = [];
  const status = payload.status || "DRAFT";
  const type = payload.type || "MC";

  if (!QUESTION_STATUSES.has(status)) errors.push("Invalid question status.");
  if (!QUESTION_TYPES.has(type)) errors.push("Invalid question type.");
  if (payload.difficulty && !DIFFICULTIES.has(payload.difficulty)) errors.push("Invalid difficulty.");

  if (status === "PUBLISHED") {
    if (!payload.topicId) errors.push("Topic is required to publish.");
    if (!payload.difficulty) errors.push("Difficulty is required to publish.");
    if (!payload.stem?.trim()) errors.push("Question stem is required to publish.");
    if (!payload.correctAnswer?.trim()) errors.push("Correct answer is required to publish.");
    if (!payload.explanation?.trim()) errors.push("Explanation is required to publish.");

    if (type === "MC") {
      const options = payload.options ?? [];
      const byLabel = new Map(options.map((option) => [option.label, option.text?.trim()]));
      for (const label of MC_LABELS) {
        if (!byLabel.get(label)) errors.push(`Option ${label} is required to publish.`);
      }
      if (payload.correctAnswer && !MC_LABELS.includes(payload.correctAnswer)) {
        errors.push("Correct answer for multiple choice must be A, B, C or D.");
      }
    }
  }

  return errors;
}

export function validatePracticeSetPayload(payload: PracticeSetPayload) {
  const errors: string[] = [];
  const status = payload.status || "DRAFT";

  if (!PRACTICE_SET_STATUSES.has(status)) errors.push("Invalid Practice Set status.");
  if (payload.difficulty && !DIFFICULTIES.has(payload.difficulty)) errors.push("Invalid difficulty.");
  if (payload.explanationVisibility && !EXPLANATION_VISIBILITIES.has(payload.explanationVisibility)) {
    errors.push("Invalid explanation visibility.");
  }

  if (status === "PUBLISHED") {
    if (!payload.name?.trim()) errors.push("Name is required to publish.");
    if (!payload.topicId) errors.push("Topic is required to publish.");
    if (!payload.difficulty) errors.push("Difficulty is required to publish.");
    if (!payload.explanationVisibility) errors.push("Explanation visibility is required to publish.");
    if (!payload.questionIds?.length) errors.push("At least one published question is required to publish.");
  }

  if (payload.questionIds?.length) {
    const unique = new Set(payload.questionIds);
    if (unique.size !== payload.questionIds.length) errors.push("Practice Set cannot contain duplicate questions.");
  }

  return errors;
}
