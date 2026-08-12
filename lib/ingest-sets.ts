// Client-safe types + pure logic for ingest Extracted Tests.
// An ExtractedTest is the GROUP of source files that together make one staging
// unit: at minimum a question file plus an answer and/or explanations file
// (a Full Practice Test section, or a Practice Set + its answer key). It is NOT
// an IngestQuestionCandidate — candidates live inside the ExtractedTest.
// Server-side computation: lib/ingest-sets.server.ts.

export type FieldState = "ok" | "crit" | "warn" | "info" | "na";

export interface StemArtifacts {
  hasEmbeddedMarkup: boolean;
  hasUnresolvedMarkdownImage: boolean;
}

const HTML_TABLE_RE = /<table\b/i;
const HTML_TAG_RE = /<\/?(?:html|body|div|td|tr|th|thead|tbody)\b/i;
const TBL_ASSET_RE = /\[tbl-\d+\.html\]/i;
const MD_IMAGE_RE = /!\[[^\]]*]\([^)]*\)/;

/** Detect HTML/table assets and leftover markdown images in OCR/parsed text. */
export function detectStemArtifacts(text: string | null | undefined): StemArtifacts {
  const value = text ?? "";
  return {
    hasEmbeddedMarkup: HTML_TABLE_RE.test(value) || HTML_TAG_RE.test(value) || TBL_ASSET_RE.test(value),
    hasUnresolvedMarkdownImage: MD_IMAGE_RE.test(value),
  };
}

export interface QuestionContent {
  type: string; // "MC" | "NUMERIC"
  correctAnswer: string | null;
  stemLen: number;
  stimLen: number;
  optTextCount: number;
  optImgCount: number;
  hasExpl: boolean;
  section: string | null; // "RW" | "MATH" | null
  /** HTML table / tags / [tbl-N.html] in stem or stimulus */
  hasEmbeddedMarkup?: boolean;
  /** Markdown image still present in stem/stimulus text */
  hasUnresolvedMarkdownImage?: boolean;
  /** Candidate (or official) already has a STEM image link / imageUrl */
  hasStemImageLink?: boolean;
}

export interface QuestionClassification {
  level: "ok" | "warn" | "crit";
  fields: {
    stem: FieldState;
    stimulus: FieldState;
    options: FieldState;
    answer: FieldState;
    explanation: FieldState;
  };
  notes: string[];
}

export interface QuestionSidebarState {
  dot: string;
  label: string;
}

// crit = unusable for a student; warn = needs recovery; info = worth noting.
// `level` escalates to the worst field; info never raises it.
export function classifyQuestion(c: QuestionContent): QuestionClassification {
  const notes: string[] = [];
  const isMC = c.type === "MC";

  let stem: FieldState = c.stemLen > 0 ? "ok" : "crit";
  if (stem === "crit") notes.push("missing stem");

  if (stem !== "crit" && c.hasEmbeddedMarkup) {
    stem = "warn";
    notes.push("embedded HTML or table in stem");
  }

  // Leftover markdown image in stem/stimulus text (link missing or strip incomplete).
  if (stem !== "crit" && c.hasUnresolvedMarkdownImage) {
    stem = "warn";
    notes.push("stem image not linked");
  }

  const hasAnswer = !!(c.correctAnswer && c.correctAnswer.trim());
  const answer: FieldState = hasAnswer ? "ok" : "crit";
  if (answer === "crit") notes.push("missing answer");

  let options: FieldState;
  if (!isMC) {
    options = "na";
  } else if (c.optTextCount >= 4) {
    options = "ok";
  } else if (c.optImgCount >= 4) {
    options = "info";
    notes.push("options as images");
  } else if (c.optTextCount > 0 || c.optImgCount > 0) {
    options = "warn";
    notes.push(`partial options (${c.optTextCount} text / ${c.optImgCount} img)`);
  } else {
    options = "crit";
    notes.push("missing options");
  }

  let stimulus: FieldState;
  if (c.section === "RW") {
    stimulus = c.stimLen > 0 ? "ok" : "warn";
    if (stimulus === "warn") notes.push("missing stimulus");
  } else {
    stimulus = "na";
  }

  const explanation: FieldState = c.hasExpl ? "ok" : "info";
  if (explanation === "info") notes.push("missing explanation");

  const states = [stem, answer, options, stimulus, explanation];
  const level: QuestionClassification["level"] = states.includes("crit")
    ? "crit"
    : states.includes("warn")
      ? "warn"
      : "ok";

  return { level, fields: { stem, stimulus, options, answer, explanation }, notes };
}

/** Sidebar / checklist label from classification (and optional rejected status). */
export function questionSidebarState(
  cls: QuestionClassification,
  opts?: { rejected?: boolean },
): QuestionSidebarState {
  if (opts?.rejected) return { dot: "bg-gray-300", label: "rejected" };
  if (cls.level === "crit") return { dot: "bg-rose-500", label: "needs review" };
  if (cls.level === "warn") return { dot: "bg-amber-500", label: "attention" };
  return { dot: "bg-green-500", label: "ready" };
}

/** MC options count as resolved when ok or info (image-backed). */
export function optionsFieldResolved(fields: QuestionClassification["fields"], type: string): boolean {
  if (type === "NUMERIC") return true;
  return fields.options === "ok" || fields.options === "info" || fields.options === "na";
}

export type ExtractedTestFileRole = "QUESTION" | "ANSWER" | "EXPLANATION" | "OTHER";

export interface ExtractedTestFile {
  id: string;
  name: string;
  role: ExtractedTestFileRole;
  nQ: number;
  nA: number;
}

export interface QuestionStatusRow {
  candidateId: string;
  sourceFileId: string;
  questionNumber: number | null;
  moduleLabel: string | null;
  type: string;
  answer: string;
  promoted: boolean;
  level: QuestionClassification["level"];
  fields: QuestionClassification["fields"];
  notes: string[];
}

export interface ExtractedTestRow {
  key: string;
  batchId: string;
  primaryFileId: string;
  title: string;
  contentType: string; // FULL_PRACTICE_TEST | PRACTICE_SET
  section: string | null;
  difficulty: string | null;
  testNumber: number | null;
  files: ExtractedTestFile[];
  fileIds: string[];
  total: number;
  complete: number;
  attention: number;
  needsReview: number;
  missingStem: number;
  missingStimulus: number;
  missingOptions: number;
  missingAnswer: number;
  missingExplanation: number;
  promoted: number;
  questions: QuestionStatusRow[];
}

export type SetTypeFilter = "ALL" | "PRACTICE_SET" | "FULL_PRACTICE_TEST";
export type SetSectionFilter = "ALL" | "RW" | "MATH";

export interface SetFilterState {
  query: string;
  type: SetTypeFilter;
  section: SetSectionFilter;
  onlyPending: boolean;
}

export function filterExtractedTests(
  rows: ExtractedTestRow[],
  { query, type, section, onlyPending }: SetFilterState,
): ExtractedTestRow[] {
  const q = query.trim().toLowerCase();
  const pending = (row: ExtractedTestRow) => row.needsReview + row.attention;
  const matched = rows.filter((row) => {
    if (type !== "ALL" && row.contentType !== type) return false;
    if (section !== "ALL" && (row.section ?? "") !== section) return false;
    if (onlyPending && pending(row) === 0) return false;
    if (!q) return true;
    const haystack = [row.title, row.section, row.difficulty, row.testNumber ? `test ${row.testNumber}` : null, ...row.files.map((f) => f.name)]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return haystack.includes(q);
  });
  return matched.sort((a, b) => {
    const ta = a.testNumber ?? Number.POSITIVE_INFINITY;
    const tb = b.testNumber ?? Number.POSITIVE_INFINITY;
    if (ta !== tb) return ta - tb;
    const sa = a.section === "MATH" ? 1 : 0;
    const sb = b.section === "MATH" ? 1 : 0;
    if (sa !== sb) return sa - sb;
    if (pending(b) !== pending(a)) return pending(b) - pending(a);
    return a.title.localeCompare(b.title);
  });
}
