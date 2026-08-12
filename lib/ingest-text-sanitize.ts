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

export function clearObsoleteImageWarnings(warnings: string[]): string[] {
  return warnings.filter((warning) => !OBSOLETE_IMAGE_WARNING_RE.test(warning));
}
