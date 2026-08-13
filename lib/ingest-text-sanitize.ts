/**
 * Client-safe text sanitizers for ingest stems/stimuli.
 * Placeholders like ![img](…) and [tbl-N.html] must leave the student-facing
 * text once a STEM image is attached (or at promote time).
 */

const MD_IMAGE_RE = /!\[[^\]]*]\([^)]*\)/g;
const TBL_ASSET_RE = /\[tbl-\d+\.html\](?:\([^)]*\))?/gi;
/** OCR sometimes injects a false table asset after a fill-in blank and bleeds the next question. */
const BLANK_TBL_BLEED_RE = /(_____)(\s*\[tbl-\d+\.html\](?:\([^)]*\))?[\s\S]*)$/i;
/**
 * Mistral OCR often appends a lone [tbl-N.html] after a finished question ("…25%?" +
 * placeholder) when there is no table in the source — strip those orphans.
 */
const ORPHAN_TRAILING_TBL_RE = /([.?!])\s*\[tbl-\d+\.html\](?:\([^)]*\))?\s*$/i;
/** Bracket labels like [ticket sales graph] left after a figure was described/attached. */
const FIGURE_BRACKET_PLACEHOLDER_RE =
  /\[[^\]]*(?:graph|figure|chart|histogram|scatter(?:\s*plot)?|table)[^\]]*\]/gi;

export const OBSOLETE_IMAGE_WARNING_RE =
  /missing an attached image|Unresolved image|Stem\/stimulus image|image that still needs|image refs|table or messy formatting|Clean up the text or attach the image/i;

/**
 * Always-safe cleanup: drop false [tbl-…] injected after a _____ blank (and any
 * bleed text that followed). Does not remove real table placeholders elsewhere.
 */
export function repairBlankTableBleed(value: string | null | undefined): string {
  if (!value) return "";
  return value.replace(BLANK_TBL_BLEED_RE, "$1").replace(/\n{3,}/g, "\n\n").trim();
}

/** Drop a lone trailing [tbl-N.html] after sentence-ending punctuation. */
export function repairOrphanTrailingTablePlaceholder(value: string | null | undefined): string {
  if (!value) return "";
  return value.replace(ORPHAN_TRAILING_TBL_RE, "$1").replace(/\n{3,}/g, "\n\n").trim();
}

/** Always-safe OCR artifact repairs (blank bleed + orphan trailing tbl). */
export function repairIngestOcrArtifacts(value: string | null | undefined): string {
  return repairOrphanTrailingTablePlaceholder(repairBlankTableBleed(value));
}

/** Strip OCR markdown images and table-asset placeholders from question text. */
export function stripIngestImagePlaceholders(value: string | null | undefined): string {
  if (!value) return "";
  return repairIngestOcrArtifacts(value)
    .replace(MD_IMAGE_RE, "")
    .replace(TBL_ASSET_RE, "")
    .replace(FIGURE_BRACKET_PLACEHOLDER_RE, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** @deprecated Prefer stripIngestImagePlaceholders — kept for existing call sites. */
export function stripMarkdownImages(value: string | null | undefined): string {
  return stripIngestImagePlaceholders(value);
}

// College Board / practice-PDF chrome that OCR often leaves at the top of
// stem/stimulus/explanation: "Question ID: ab12cd34", bare "# Question",
// "Assessment Test Domain Skill Difficulty", trailing "**Answer**".
const CB_QUESTION_ID_LINE =
  /^(?:\*{1,2}|_{1,2}|#+\s*)?\s*(?:Question\s+ID|ID)\s*:?\s*[A-Fa-f0-9]{6,}\s*(?:\*{1,2}|_{1,2})?\s*$/i;
/** Leading "ID: ab12cd34 " / "**Question ID: …** " prefix on an otherwise real line. */
const CB_QUESTION_ID_PREFIX =
  /^(?:\*{1,2}|_{1,2}|#+\s*)?\s*(?:Question\s+ID|ID)\s*:?\s*[A-Fa-f0-9]{6,}\s*(?:\*{1,2}|_{1,2})?\s*/i;
const CB_QUESTION_ID_INLINE = /\bQuestion\s+ID\s*:?\s*[A-Fa-f0-9]{6,}\b/gi;
const CB_BARE_QUESTION_LABEL =
  /^(?:#+\s*)?(?:\*{1,2}|_{1,2})?\s*Question(?:\s+\d+)?\s*(?:\*{1,2}|_{1,2})?\s*$/i;
const CB_ASSESSMENT_HEADER = /^Assessment\s+Test\s+Domain\s+Skill\s+Difficulty\s*$/i;
const CB_SAT_TAXONOMY_HEADER = /^SAT\s+(?:Math|Reading\s+and\s+Writing)\b/i;
const CB_ANSWER_LABEL = /^(?:#+\s*)?(?:\*{1,2}|_{1,2})?\s*Answer\s*(?:\*{1,2}|_{1,2})?\s*$/i;
/** Jump to real rationale — avoid bare "Correct Answer:" / empty "Rationale" OCR stubs. */
const CB_RATIONALE_START = /^(?:Choice\s+[A-D]\s+is\s+correct|The\s+correct\s+answer\s+is)/i;

function isCollegeBoardMetaLine(line: string): boolean {
  const trimmed = line.replace(/^#+\s*/, "").trim();
  if (!trimmed) return true;
  return (
    CB_QUESTION_ID_LINE.test(trimmed) ||
    CB_BARE_QUESTION_LABEL.test(trimmed) ||
    CB_ASSESSMENT_HEADER.test(trimmed) ||
    CB_SAT_TAXONOMY_HEADER.test(trimmed)
  );
}

/**
 * Remove leaked Question-ID / Assessment / bare "Question" chrome from
 * student-facing text. Safe for stem, stimulus, and explanation.
 */
export function stripCollegeBoardMetaHeaders(value: string | null | undefined): string {
  if (!value) return "";
  let text = value.replace(/\r\n/g, "\n");

  // Prefer cutting explanations down to the real rationale when present.
  const lines = text.split("\n");
  const rationaleIdx = lines.findIndex((line) => CB_RATIONALE_START.test(line.trim()));
  if (rationaleIdx > 0) {
    const sliced = lines.slice(rationaleIdx).join("\n").trim();
    // Only cut when there is a real rationale body (not an empty stub).
    if (sliced.length >= 40) text = sliced;
  }

  const kept: string[] = [];
  let strippingLead = true;
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (strippingLead && isCollegeBoardMetaLine(line)) continue;
    strippingLead = false;
    if (CB_QUESTION_ID_LINE.test(trimmed) || CB_BARE_QUESTION_LABEL.test(trimmed) || CB_ASSESSMENT_HEADER.test(trimmed)) {
      continue;
    }
    if (CB_ANSWER_LABEL.test(trimmed)) {
      // Trailing practice-PDF "**Answer**" (and anything after) is not part of the stem.
      break;
    }
    const cleanedLine = line
      .replace(CB_QUESTION_ID_PREFIX, "")
      .replace(CB_QUESTION_ID_INLINE, "")
      .replace(/\*{4,}/g, "")
      .replace(/\*\*\s*\*\*/g, "")
      .replace(/[ \t]+$/g, "");
    if (!cleanedLine.trim() && !line.trim()) {
      kept.push("");
      continue;
    }
    if (!cleanedLine.trim()) continue;
    // After stripping a leading "ID: hex", the remainder may be a lone "Question 7".
    if (CB_BARE_QUESTION_LABEL.test(cleanedLine.trim())) continue;
    kept.push(cleanedLine);
  }

  const out = kept
    .join("\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  // OCR sometimes leaves a lone "Rationale" marker with no body.
  if (/^rationale\.?$/i.test(out)) return "";
  return out;
}

export function clearObsoleteImageWarnings(warnings: string[]): string[] {
  return warnings.filter((warning) => !OBSOLETE_IMAGE_WARNING_RE.test(warning));
}
