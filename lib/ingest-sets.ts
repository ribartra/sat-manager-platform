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
  /** OCR leftover `[tbl-N.html]` table-asset placeholder */
  hasTableAssetPlaceholder: boolean;
}

const HTML_TABLE_RE = /<table\b/i;
const HTML_TAG_RE = /<\/?(?:html|body|div|td|tr|th|thead|tbody)\b/i;
const TBL_ASSET_RE = /\[tbl-\d+\.html\]/i;
const MD_IMAGE_RE = /!\[[^\]]*]\([^)]*\)/;
/** Figure/graph/table cues that usually need a STEM image even without markdown leftovers. */
const FIGURE_HINT_RE =
  /!\[[^\]]*]\([^)]*\)|\[tbl-\d+\.html\]|\[[^\]]*(?:graph|figure|chart|histogram|scatter)[^\]]*\]|(?:in the (?:figure|graph|table|chart)|shown in the (?:figure|graph)|see the (?:figure|graph))/i;

/** Detect HTML/table assets and leftover markdown images in OCR/parsed text. */
export function detectStemArtifacts(text: string | null | undefined): StemArtifacts {
  const value = text ?? "";
  const hasTableAssetPlaceholder = TBL_ASSET_RE.test(value);
  return {
    // Real HTML in the stem is always messy for students; tbl placeholders are handled separately.
    hasEmbeddedMarkup: HTML_TABLE_RE.test(value) || HTML_TAG_RE.test(value),
    hasUnresolvedMarkdownImage: MD_IMAGE_RE.test(value),
    hasTableAssetPlaceholder,
  };
}

export function textNeedsAttachedImage(text: string | null | undefined): boolean {
  return FIGURE_HINT_RE.test(text ?? "");
}

/** Single builder so Extracted Test rail and file review sidebar stay in sync. */
export function buildQuestionContent(input: {
  type: string | null | undefined;
  correctAnswer: string | null | undefined;
  stem: string | null | undefined;
  stimulus: string | null | undefined;
  explanation: string | null | undefined;
  section: string | null | undefined;
  optTextCount: number;
  optImgCount: number;
  hasStemImageLink: boolean;
}): QuestionContent {
  const combined = `${input.stem ?? ""}\n${input.stimulus ?? ""}`;
  const artifacts = detectStemArtifacts(combined);
  const section = input.section?.toUpperCase().includes("MATH")
    ? "MATH"
    : input.section
      ? "RW"
      : null;
  return {
    type: input.type ?? "MC",
    correctAnswer: input.correctAnswer ?? null,
    stemLen: (input.stem ?? "").trim().length,
    stimLen: (input.stimulus ?? "").trim().length,
    optTextCount: input.optTextCount,
    optImgCount: input.optImgCount,
    hasExpl: !!(input.explanation && input.explanation.trim()),
    section,
    hasEmbeddedMarkup: artifacts.hasEmbeddedMarkup,
    hasUnresolvedMarkdownImage: artifacts.hasUnresolvedMarkdownImage,
    hasTableAssetPlaceholder: artifacts.hasTableAssetPlaceholder,
    hasStemImageLink: input.hasStemImageLink,
    needsAttachedImage: textNeedsAttachedImage(combined),
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
  /** HTML table / tags in stem or stimulus */
  hasEmbeddedMarkup?: boolean;
  /** Markdown image still present in stem/stimulus text */
  hasUnresolvedMarkdownImage?: boolean;
  /** Leftover `[tbl-N.html]` placeholder from table extraction */
  hasTableAssetPlaceholder?: boolean;
  /** Candidate (or official) already has a STEM image link / imageUrl */
  hasStemImageLink?: boolean;
  /** Text implies a figure/graph/table that needs an attached image */
  needsAttachedImage?: boolean;
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
  if (stem === "crit") notes.push("Question text is missing");

  if (stem !== "crit" && c.hasEmbeddedMarkup) {
    stem = "warn";
    notes.push("Question has a table or messy formatting");
  }

  // Table-asset placeholder without an attached STEM image (with image, the table is the picture).
  if (stem !== "crit" && c.hasTableAssetPlaceholder && !c.hasStemImageLink) {
    stem = "warn";
    if (!notes.includes("Question has a table or messy formatting")) {
      notes.push("Question has a table or messy formatting");
    }
  }

  // Image required (markdown leftover or figure/graph cue) but not attached yet.
  if (
    stem !== "crit" &&
    !c.hasStemImageLink &&
    (c.hasUnresolvedMarkdownImage || c.needsAttachedImage || c.hasTableAssetPlaceholder)
  ) {
    stem = "warn";
    if (!notes.includes("Question image is not attached")) {
      notes.push("Question image is not attached");
    }
  }

  const hasAnswer = !!(c.correctAnswer && c.correctAnswer.trim());
  const answer: FieldState = hasAnswer ? "ok" : "crit";
  if (answer === "crit") notes.push("Answer is missing");

  let options: FieldState;
  if (!isMC) {
    options = "na";
  } else if (c.optTextCount >= 4 || c.optImgCount >= 4) {
    // Text or image-backed A–D both count as complete (graph choices often have empty text).
    options = "ok";
  } else if (c.optTextCount > 0 || c.optImgCount > 0) {
    options = "warn";
    notes.push("Some answer choices are incomplete");
  } else {
    options = "crit";
    notes.push("Answer choices are missing");
  }

  let stimulus: FieldState;
  if (c.section === "RW") {
    stimulus = c.stimLen > 0 ? "ok" : "warn";
    if (stimulus === "warn") notes.push("Passage is missing");
  } else {
    stimulus = "na";
  }

  const explanation: FieldState = c.hasExpl ? "ok" : "info";
  if (explanation === "info") notes.push("Explanation is missing");

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
