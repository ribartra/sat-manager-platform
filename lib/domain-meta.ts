/**
 * Domain metadata for repeated SAT enums (labels, order, badge mapping).
 * UI should render from these helpers instead of hardcoding <option> lists.
 */

export type Difficulty = "EASY" | "MEDIUM" | "HARD";
export type QuestionType = "MC" | "NUMERIC";
export type QuestionStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";
export type PracticeSetStatus = "DRAFT" | "PUBLISHED" | "BLOCKED" | "ARCHIVED";
export type FullTestStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";
export type ExplanationVisibility = "IMMEDIATE" | "AFTER_FINISH" | "HIDDEN";
export type ContentStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";

export type BadgeVariant = "default" | "success" | "warning" | "danger" | "info" | "easy" | "medium" | "hard";

export type DomainMeta<T extends string> = {
  value: T;
  label: string;
  order: number;
  badge: BadgeVariant;
};

function sortedEntries<T extends string>(meta: Record<T, DomainMeta<T>>): DomainMeta<T>[] {
  return (Object.values(meta) as DomainMeta<T>[]).sort((a, b) => a.order - b.order);
}

export const difficultyMeta = {
  EASY: { value: "EASY", label: "Easy", order: 10, badge: "easy" },
  MEDIUM: { value: "MEDIUM", label: "Medium", order: 20, badge: "medium" },
  HARD: { value: "HARD", label: "Hard", order: 30, badge: "hard" },
} as const satisfies Record<Difficulty, DomainMeta<Difficulty>>;

export const questionTypeMeta = {
  MC: { value: "MC", label: "Multiple Choice (A/B/C/D)", order: 10, badge: "default" },
  NUMERIC: { value: "NUMERIC", label: "Numeric Input", order: 20, badge: "default" },
} as const satisfies Record<QuestionType, DomainMeta<QuestionType>>;

export const questionStatusMeta = {
  DRAFT: { value: "DRAFT", label: "Draft", order: 10, badge: "warning" },
  PUBLISHED: { value: "PUBLISHED", label: "Published", order: 20, badge: "success" },
  ARCHIVED: { value: "ARCHIVED", label: "Archived", order: 30, badge: "default" },
} as const satisfies Record<QuestionStatus, DomainMeta<QuestionStatus>>;

export const practiceSetStatusMeta = {
  DRAFT: { value: "DRAFT", label: "Draft", order: 10, badge: "warning" },
  PUBLISHED: { value: "PUBLISHED", label: "Published", order: 20, badge: "success" },
  BLOCKED: { value: "BLOCKED", label: "Blocked", order: 30, badge: "danger" },
  ARCHIVED: { value: "ARCHIVED", label: "Archived", order: 40, badge: "default" },
} as const satisfies Record<PracticeSetStatus, DomainMeta<PracticeSetStatus>>;

export const fullTestStatusMeta = {
  DRAFT: { value: "DRAFT", label: "Draft", order: 10, badge: "warning" },
  PUBLISHED: { value: "PUBLISHED", label: "Published", order: 20, badge: "success" },
  ARCHIVED: { value: "ARCHIVED", label: "Archived", order: 30, badge: "default" },
} as const satisfies Record<FullTestStatus, DomainMeta<FullTestStatus>>;

export const explanationVisibilityMeta = {
  IMMEDIATE: { value: "IMMEDIATE", label: "Immediately", order: 10, badge: "info" },
  AFTER_FINISH: { value: "AFTER_FINISH", label: "After finish", order: 20, badge: "default" },
  HIDDEN: { value: "HIDDEN", label: "Hidden", order: 30, badge: "default" },
} as const satisfies Record<ExplanationVisibility, DomainMeta<ExplanationVisibility>>;

/** Materials / generic content publish states (same values as question status). */
export const contentStatusMeta = questionStatusMeta;

export const difficultyOptions = () => sortedEntries(difficultyMeta);
export const questionTypeOptions = () => sortedEntries(questionTypeMeta);
export const questionStatusOptions = () => sortedEntries(questionStatusMeta);
export const practiceSetStatusOptions = () => sortedEntries(practiceSetStatusMeta);
export const fullTestStatusOptions = () => sortedEntries(fullTestStatusMeta);
export const explanationVisibilityOptions = () => sortedEntries(explanationVisibilityMeta);
export const contentStatusOptions = () => sortedEntries(contentStatusMeta);

export function difficultyLabel(value: string): string {
  return difficultyMeta[value as Difficulty]?.label ?? value;
}

export function difficultyBadgeVariant(value: string): BadgeVariant {
  return difficultyMeta[value as Difficulty]?.badge ?? "default";
}

export function questionTypeLabel(value: string, compact = false): string {
  // Badges spell it out: "MC" is not readable for teachers and students.
  if (compact && value === "MC") return "Multiple Choice";
  if (compact && value === "NUMERIC") return "Numeric";
  return questionTypeMeta[value as QuestionType]?.label ?? value;
}

export function questionStatusLabel(value: string): string {
  return questionStatusMeta[value as QuestionStatus]?.label ?? value;
}

export function questionStatusBadgeVariant(value: string): BadgeVariant {
  return questionStatusMeta[value as QuestionStatus]?.badge ?? "default";
}

export function practiceSetStatusLabel(value: string): string {
  return practiceSetStatusMeta[value as PracticeSetStatus]?.label ?? value;
}

export function practiceSetStatusBadgeVariant(value: string): BadgeVariant {
  return practiceSetStatusMeta[value as PracticeSetStatus]?.badge ?? "default";
}

export function fullTestStatusLabel(value: string): string {
  return fullTestStatusMeta[value as FullTestStatus]?.label ?? value;
}

export function fullTestStatusBadgeVariant(value: string): BadgeVariant {
  return fullTestStatusMeta[value as FullTestStatus]?.badge ?? "default";
}

export function explanationVisibilityLabel(value: string): string {
  return explanationVisibilityMeta[value as ExplanationVisibility]?.label ?? value;
}

/** Tailwind chip classes used by legacy `difficultyColor` call sites. */
export function difficultyChipClass(value: string): string {
  switch (value) {
    case "EASY":
      return "text-green-600 bg-green-50";
    case "MEDIUM":
      return "text-yellow-600 bg-yellow-50";
    case "HARD":
      return "text-red-600 bg-red-50";
    default:
      return "text-gray-600 bg-gray-50";
  }
}

/** Plain-language labels for status codes shown to students, parents and teachers. */
const ASSIGNMENT_STATUS_LABELS: Record<string, string> = {
  PENDING: "Not started",
  IN_PROGRESS: "In progress",
  OVERDUE: "Overdue",
  COMPLETED: "Completed",
  LOCKED: "Not open yet",
};

export function assignmentStatusLabel(value: string): string {
  return ASSIGNMENT_STATUS_LABELS[value] ?? humanizeCode(value);
}

const ENROLLMENT_STATUS_LABELS: Record<string, string> = {
  PENDING: "Waiting for approval",
  APPROVED: "Approved",
  REJECTED: "Not approved",
  DENIED: "Not approved",
};

export function enrollmentStatusLabel(value: string): string {
  return ENROLLMENT_STATUS_LABELS[value] ?? humanizeCode(value);
}

const ROLE_LABELS: Record<string, string> = { ADMIN: "Admin", TEACHER: "Teacher", STUDENT: "Student", PARENT: "Parent" };

export function roleLabel(value: string): string {
  return ROLE_LABELS[value] ?? humanizeCode(value);
}

/** Last resort for any other code: "SOME_VALUE" → "Some value" (never show raw codes). */
export function humanizeCode(value: string | null | undefined): string {
  if (!value) return "";
  const text = value.replace(/_/g, " ").toLowerCase();
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Attempt general info: the assignment's "Show explanations in the player" this attempt was given. */
export function explanationsInPlayerLabel(shown: boolean | null | undefined): string {
  return `Explanations in the player: ${shown ? "shown" : "hidden"}`;
}

/** Question Bank status when the URL has none (`status=all` = every status). */
export const QUESTION_STATUS_DEFAULT = "PUBLISHED";
