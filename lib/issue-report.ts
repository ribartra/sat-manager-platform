/**
 * "Report a problem" shared shapes (client + server). A report is a comment about part of a screen:
 * the element the user clicked, or the area they dragged over, plus page context and a screenshot.
 * Collected by components/sat/issue-reporter.tsx, stored in IssueReport, emailed by lib/email.ts.
 */

export const ISSUE_CATEGORIES = [
  { value: "PROBLEM", label: "Problem", color: "#dc2626" },
  { value: "CONFUSING", label: "Confusing", color: "#d97706" },
  { value: "SUGGESTION", label: "Suggestion", color: "#2563eb" },
  { value: "PRAISE", label: "I like it", color: "#16a34a" },
] as const;

export type IssueCategory = (typeof ISSUE_CATEGORIES)[number]["value"];

export function issueCategoryMeta(value: string) {
  return ISSUE_CATEGORIES.find((c) => c.value === value) ?? ISSUE_CATEGORIES[0];
}

/** One DOM element as the reporter saw it. */
export interface IssueElement {
  selector: string;
  tag: string;
  id?: string;
  classes?: string[];
  attributes?: Record<string, string>;
  text?: string;
  html?: string;
  ancestors?: string[];
  rect?: { x: number; y: number; width: number; height: number };
}

/** Everything about the selection; stored as JSON in IssueReport.target. */
export interface IssueTarget {
  kind: "element" | "area" | "page";
  /** Nearest heading before the selection (the block it belongs to). */
  context: string;
  /** Clicked element, or the smallest element containing the dragged area. */
  element?: IssueElement;
  /** Area only: selection rectangle in viewport pixels. */
  area?: { x: number; y: number; width: number; height: number };
  /** Area only: table column headers inside the selection. */
  columns?: string[];
  /** Area only: elements inside the selection (short form). */
  inside?: IssueElement[];
  devicePixelRatio?: number;
  scroll?: { x: number; y: number };
  /** Last JS errors on the page before the report. */
  errors?: string[];
}

export const ISSUE_COMMENT_MAX = 4000;
export const ISSUE_TARGET_MAX = 64 * 1024;
export const ISSUE_SCREENSHOT_MAX = 2 * 1024 * 1024;
export const ISSUE_REPORT_DEFAULT_EMAIL = "admin@nordmetric.com";
