export type ResolvedQuestionType = "MC" | "NUMERIC";

export interface QuestionOptionContent {
  text?: string | null;
  imageUrl?: string | null;
}

/**
 * An option is answer content when it has text, or when it is an image-only choice (e.g. "which graph…"
 * questions whose four choices are graphs). Spurious ingestion images were removed from the bank, and an
 * option that has text keeps showing only its text.
 */
export function isAnswerOption(option: QuestionOptionContent) {
  return Boolean(option.text?.trim() || option.imageUrl?.trim());
}

function hasUsableOption(option: QuestionOptionContent) {
  return isAnswerOption(option);
}

/**
 * Resolve the response control from the content that is actually available.
 * Legacy MC questions without alternatives must behave as numeric questions
 * in both the player and server-side grading.
 */
export function resolveQuestionType(
  storedType: string,
  options?: QuestionOptionContent[] | null,
): ResolvedQuestionType {
  if (storedType !== "MC") return "NUMERIC";
  const usableOptions = (options ?? []).filter(hasUsableOption);
  return usableOptions.length >= 2 ? "MC" : "NUMERIC";
}

export function questionResponseLabel(type: ResolvedQuestionType) {
  return type === "MC" ? "Choose one" : "Type your answer";
}
