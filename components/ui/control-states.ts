/**
 * Shared "unavailable" look for form fields and small controls, the counterpart of the button
 * blocked state in button.tsx: neutral gray, no focus ring, not-allowed cursor.
 */
export const FIELD_BLOCKED =
  "disabled:cursor-not-allowed disabled:border-gray-200 disabled:bg-gray-100 disabled:text-gray-500 disabled:shadow-none";

/** Checkbox / radio boxes (native inputs). */
export const CHOICE_BLOCKED = "disabled:cursor-not-allowed disabled:border-gray-200 disabled:bg-gray-100 disabled:opacity-60";

/** Tabs and menu items: text-only controls. */
export const TEXT_BLOCKED = "disabled:cursor-not-allowed disabled:text-gray-400 data-[disabled]:cursor-not-allowed data-[disabled]:text-gray-400";

/**
 * Custom-shaped raw buttons (cards, menu rows, switches) that cannot use <Button>: same meaning,
 * adapted to their shape. Pick the one matching the control; never a bare `disabled:opacity-*`.
 */
/** Text-only actions and menu rows ("Approve", "Change photo", "Remove file"). */
export const BLOCKED_TEXT =
  "disabled:cursor-not-allowed disabled:text-gray-400 disabled:no-underline disabled:hover:bg-transparent disabled:hover:text-gray-400 disabled:hover:no-underline";
/** Bordered surfaces: step cards, chips, page buttons, small bordered actions. */
export const BLOCKED_SURFACE =
  "disabled:cursor-not-allowed disabled:border-gray-200 disabled:bg-gray-50 disabled:text-gray-400 disabled:shadow-none disabled:hover:border-gray-200 disabled:hover:bg-gray-50";
/** Toggle switches. */
export const BLOCKED_SWITCH = "disabled:cursor-not-allowed disabled:bg-gray-200";
/**
 * Not blocked but settled: an answer already checked/graded keeps its colors and is read-only.
 * Use only for result states, where graying out would hide the feedback.
 */
export const SETTLED_RESULT = "disabled:cursor-default";
