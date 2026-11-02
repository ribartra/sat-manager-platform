/**
 * Classroom / Homework (pendiente-p2.md). A practice assignment is either work done in class
 * (CLASSROOM: shows what was done, never a score, never in reports) or homework (HOMEWORK: scored;
 * the only practice that counts in results, reports, overviews and the auto-open of the next level).
 * The context is fixed once assigned; a set can have one assignment per context. Tests have no context.
 */
export const ASSIGNMENT_CONTEXTS = ["CLASSROOM", "HOMEWORK"] as const;
export type AssignmentContext = (typeof ASSIGNMENT_CONTEXTS)[number];

/** The context whose tries are scored and reported. */
export const SCORED_CONTEXT: AssignmentContext = "HOMEWORK";

export function isAssignmentContext(value: unknown): value is AssignmentContext {
  return value === "CLASSROOM" || value === "HOMEWORK";
}

export function contextLabel(context: string | null | undefined): string {
  return context === "CLASSROOM" ? "Classroom" : "Homework";
}

/** Whether a try of this context shows a score (%, correct count). */
export function isScoredContext(context: string | null | undefined): boolean {
  return context !== "CLASSROOM";
}

/** View filter of the All / Classroom / Homework selector (URL `context=all|classroom|homework`). */
export type ContextView = "all" | "classroom" | "homework";

export function contextViewFromParam(value: string | null | undefined): ContextView {
  return value === "classroom" || value === "homework" ? value : "all";
}

/** Prisma where on Assignment for a view ({} = every context). */
export function assignmentContextWhere(view: ContextView): { context?: AssignmentContext } {
  return view === "classroom" ? { context: "CLASSROOM" } : view === "homework" ? { context: "HOMEWORK" } : {};
}

/** Practice tries that count toward scores and reports: submitted, of a Homework assignment. */
export const SCORED_PRACTICE_ATTEMPT_WHERE = { status: "SUBMITTED", assignment: { context: SCORED_CONTEXT } } as const;
