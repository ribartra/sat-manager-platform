export type ResolvedQuestionType = "MC" | "NUMERIC";

export interface QuestionOptionContent {
  text?: string | null;
  imageUrl?: string | null;
}

function hasUsableOption(option: QuestionOptionContent) {
  // Option images produced by ingestion are not answer content in the player.
  return Boolean(option.text?.trim());
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
  return type === "MC" ? "Answer choices" : "Numeric answer";
}
