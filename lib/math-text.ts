/**
 * Shared math/prose text helpers for MathContent and editor toolbars.
 * Markers (outside math tokens):
 *   **bold**  → <strong>
 *   ++under++ → <u>
 * Inside math, editors wrap with \textbf{…} / \underline{…}.
 */

export const MATH_TOKEN_PATTERN =
  /(\$\$[\s\S]+?\$\$|\\\[[\s\S]+?\\\]|\$[^$\n]+?\$|\\\([\s\S]+?\\\))/g;

const ALIGNED_ENV_RE = /\\begin\{aligned\*?\}|\\begin\{align\*?\}/;
const AMP_EQ_RE = /&=/;

export type MathToken = {
  kind: "math";
  raw: string;
  math: string;
  displayMode: boolean;
};

export type ProseSegment =
  | { kind: "text"; text: string }
  | { kind: "bold"; text: string }
  | { kind: "italic"; text: string }
  | { kind: "underline"; text: string };

export type ContentPart = MathToken | { kind: "prose"; segments: ProseSegment[] };

/**
 * A single-`$…$` token whose body is English prose is almost always currency
 * ("$500 million … $10"), not math: two currency signs on a line get captured as
 * one token and KaTeX would strip its spaces ("500millionand…"). Treat such a
 * token as prose so the `$` render literally with spaces intact. Real inline math
 * ($x$, $k^4+5=21$, $\frac{1}{2}$) has LaTeX markup or no multi-word prose.
 */
function isProseDollarBody(body: string): boolean {
  if (/[\\^_{}]/.test(body)) return false; // LaTeX markup → real math
  if (/^\d[\d,.]*\s/.test(body) && /\s$/.test(body)) return true; // "$25 (Week 1: $200" → two prices, not math
  if (!/\s/.test(body)) return false; // no spaces → math token
  return (body.match(/[A-Za-z]{3,}/g) || []).length >= 2; // ≥2 real words → prose/currency
}

export function parseMathToken(token: string): MathToken | null {
  if (token.startsWith("$$") && token.endsWith("$$")) {
    return { kind: "math", raw: token, math: token.slice(2, -2), displayMode: true };
  }
  if (token.startsWith("\\[") && token.endsWith("\\]")) {
    return { kind: "math", raw: token, math: token.slice(2, -2), displayMode: true };
  }
  if (token.startsWith("$") && token.endsWith("$") && !token.startsWith("$$")) {
    if (isProseDollarBody(token.slice(1, -1))) return null; // currency/prose, not math
    return { kind: "math", raw: token, math: token.slice(1, -1), displayMode: false };
  }
  if (token.startsWith("\\(") && token.endsWith("\\)")) {
    return { kind: "math", raw: token, math: token.slice(2, -2), displayMode: false };
  }
  return null;
}

/**
 * If a display-math body uses &= but is not already in an align/aligned
 * environment, wrap it so KaTeX can render systems of equations.
 */
export function normalizeDisplayMathBody(math: string): string {
  const body = math.trim();
  if (!body) return body;
  if (!AMP_EQ_RE.test(body)) return body;
  if (ALIGNED_ENV_RE.test(body)) return body;
  return `\\begin{aligned} ${body} \\end{aligned}`;
}

export function normalizeMathToken(token: MathToken): MathToken {
  if (!token.displayMode) return token;
  const next = normalizeDisplayMathBody(token.math);
  if (next === token.math) return token;
  return { ...token, math: next };
}

/** Split prose into text / bold / italic / underline segments (no nesting). */
export function parseProseSegments(prose: string): ProseSegment[] {
  if (!prose) return [];
  // Order matters: **bold** and ++under++ before single *italic* so ** isn't split as *.
  const pattern = /(\*\*[\s\S]+?\*\*|\+\+[\s\S]+?\+\+|\*(?!\*)[^*\n]+?\*)/g;
  const parts = prose.split(pattern).filter((part) => part.length > 0);
  const segments: ProseSegment[] = [];
  for (const part of parts) {
    if (part.startsWith("**") && part.endsWith("**") && part.length >= 4) {
      segments.push({ kind: "bold", text: part.slice(2, -2) });
    } else if (part.startsWith("++") && part.endsWith("++") && part.length >= 4) {
      segments.push({ kind: "underline", text: part.slice(2, -2) });
    } else if (
      part.startsWith("*") &&
      part.endsWith("*") &&
      !part.startsWith("**") &&
      part.length >= 3
    ) {
      segments.push({ kind: "italic", text: part.slice(1, -1) });
    } else {
      segments.push({ kind: "text", text: part });
    }
  }
  return segments;
}

export type ContentBlock =
  | { kind: "text"; content: string }
  | { kind: "table"; header: string[]; rows: string[][] };

const TABLE_ROW_RE = /^\s*\|.*\|\s*$/;
const TABLE_SEPARATOR_RE = /^\s*\|(\s*:?-{3,}:?\s*\|)+\s*$/;

/** Split a markdown table row into cells; a `|` inside a math token or escaped as `\|` is not a separator. */
export function splitTableCells(line: string): string[] {
  const body = line.trim().replace(/^\|/, "").replace(/\|$/, "");
  const cells: string[] = [];
  let current = "";
  let i = 0;
  while (i < body.length) {
    const rest = body.slice(i);
    // Single-$ math never spans a cell separator: "| $210.00 | $25.20 |" are two prices, not one formula.
    const math = rest.match(/^(\$\$[^|]+?\$\$|\$[^$\n|]+?\$|\\\([^|]+?\\\))/);
    if (math) {
      current += math[0];
      i += math[0].length;
      continue;
    }
    if (rest.startsWith("\\|")) {
      current += "|";
      i += 2;
      continue;
    }
    if (body[i] === "|") {
      cells.push(current.trim());
      current = "";
      i += 1;
      continue;
    }
    current += body[i];
    i += 1;
  }
  cells.push(current.trim());
  return cells;
}

/**
 * Split content into prose/math text and GitHub-style pipe tables (header row, `| --- |` separator,
 * body rows). Tables are rendered as real HTML tables so long cell text wraps.
 */
export function splitContentBlocks(content: string): ContentBlock[] {
  const lines = String(content ?? "").split("\n");
  const blocks: ContentBlock[] = [];
  let text: string[] = [];
  const flushText = () => {
    if (text.length) blocks.push({ kind: "text", content: text.join("\n") });
    text = [];
  };
  let i = 0;
  while (i < lines.length) {
    if (TABLE_ROW_RE.test(lines[i]) && i + 1 < lines.length && TABLE_SEPARATOR_RE.test(lines[i + 1])) {
      const header = splitTableCells(lines[i]);
      const rows: string[][] = [];
      i += 2;
      while (i < lines.length && TABLE_ROW_RE.test(lines[i])) {
        const cells = splitTableCells(lines[i]);
        while (cells.length < header.length) cells.push("");
        rows.push(cells.slice(0, header.length));
        i += 1;
      }
      // Drop the blank line that separated text from the table; the table is its own block.
      if (text.length && !text[text.length - 1].trim()) text.pop();
      flushText();
      blocks.push({ kind: "table", header, rows });
      if (i < lines.length && !lines[i].trim()) i += 1;
      continue;
    }
    text.push(lines[i]);
    i += 1;
  }
  flushText();
  return blocks;
}

/** Tokenize full content into math blocks + prose (with markup segments). */
/**
 * A `$$…$$` / `\[…\]` token is a real display block only when it sits alone on its line inside
 * longer content. Ingested stems often use `$$` mid-sentence ("If $$x$$ and $$y$$, what is…?");
 * rendering those as blocks breaks the sentence into centered fragments.
 */
function isStandaloneDisplay(parts: string[], index: number): boolean {
  if (parts.length === 1) return false; // the whole content is the formula (e.g. an answer choice)
  const before = parts.slice(0, index).join("").split("\n").pop() ?? "";
  const after = parts.slice(index + 1).join("").split("\n")[0] ?? "";
  return !before.trim() && !after.trim();
}

/** `\$` is a literal dollar sign: it never opens or closes math. Hidden while splitting, restored per part. */
const ESCAPED_DOLLAR = "\uE000";

export function tokenizeMathContent(content: string): ContentPart[] {
  const source = String(content ?? "").replace(/\\\$/g, ESCAPED_DOLLAR);
  const parts = source.split(MATH_TOKEN_PATTERN).filter((part) => part.length > 0);
  const maths = parts.map((part, index) => {
    const math = parseMathToken(part);
    if (!math) return null;
    // Inside math the escape stays (KaTeX renders `\$` as a dollar sign).
    const restored = { ...math, raw: math.raw.replaceAll(ESCAPED_DOLLAR, "\\$"), math: math.math.replaceAll(ESCAPED_DOLLAR, "\\$") };
    if (restored.displayMode && !isStandaloneDisplay(parts, index)) {
      // Inline, but keep display-size fractions/roots.
      return { ...restored, displayMode: false, math: `\\displaystyle ${restored.math.trim()}` };
    }
    return normalizeMathToken(restored);
  });
  const isBlock = (index: number) => Boolean(maths[index]?.displayMode);
  const result: ContentPart[] = [];
  parts.forEach((part, index) => {
    const math = maths[index];
    if (math) {
      result.push(math);
      return;
    }
    // A display block already starts its own line: the blank lines around it would add an empty
    // line on top of the formula's margin (big gaps between "$$…$$\n\n$$…$$" equations).
    let prose = part.replaceAll(ESCAPED_DOLLAR, "$");
    if (isBlock(index - 1)) prose = prose.replace(/^[ \t]*\n\s*/, "");
    if (isBlock(index + 1)) prose = prose.replace(/\s*\n[ \t]*$/, "");
    if (prose) result.push({ kind: "prose", segments: parseProseSegments(prose) });
  });
  return result;
}

type TextFormat = "bold" | "underline";
type FormatResult = { next: string; selectionStart: number; selectionEnd: number };

const PROSE_MARK: Record<TextFormat, string> = { bold: "**", underline: "++" };
const MATH_CMD: Record<TextFormat, string> = { bold: "\\textbf{", underline: "\\underline{" };

/** Paired marker runs (open, close) on the line holding `pos`: [openStart, closeEnd). */
function markerRuns(value: string, pos: number, mark: string): Array<{ open: number; close: number }> {
  const lineStart = value.lastIndexOf("\n", Math.max(0, pos - 1)) + 1;
  const lineEndRaw = value.indexOf("\n", pos);
  const lineEnd = lineEndRaw === -1 ? value.length : lineEndRaw;
  const hits: number[] = [];
  for (let i = value.indexOf(mark, lineStart); i !== -1 && i + mark.length <= lineEnd; i = value.indexOf(mark, i + mark.length)) hits.push(i);
  const runs: Array<{ open: number; close: number }> = [];
  for (let i = 0; i + 1 < hits.length; i += 2) runs.push({ open: hits[i], close: hits[i + 1] });
  return runs;
}

/** The marked run whose inside holds [start, end] (prose markers), if any. */
function enclosingRun(value: string, start: number, end: number, mark: string) {
  return markerRuns(value, start, mark).find((run) => run.open + mark.length <= start && end <= run.close) ?? null;
}

/** Whether the selection / caret is bold or underlined (prose markers or LaTeX commands). */
export function textFormatState(value: string, selectionStart: number, selectionEnd: number): Record<TextFormat, boolean> {
  const start = Math.min(selectionStart, selectionEnd);
  const end = Math.max(selectionStart, selectionEnd);
  const state = (format: TextFormat) => {
    const selected = value.slice(start, end);
    const mark = PROSE_MARK[format];
    if (selected.length >= mark.length * 2 && selected.startsWith(mark) && selected.endsWith(mark)) return true;
    if (enclosingRun(value, start, end, mark)) return true;
    const cmd = MATH_CMD[format];
    const open = value.lastIndexOf(cmd, start);
    return open !== -1 && open + cmd.length <= start && value.indexOf("}", open) >= end;
  };
  return { bold: state("bold"), underline: state("underline") };
}

/**
 * Bold / Underline like a word processor: the button toggles.
 * - Selection already formatted (markers inside or around it, or inside a formatted run) → the format
 *   is removed from it (a part of a run splits the run).
 * - Otherwise the selection is wrapped (surrounding spaces stay outside the markers).
 * - No selection: inside a formatted run → that run is unformatted; inside a word → the word is
 *   formatted; elsewhere → an empty pair with the caret in it (typing goes formatted; pressing again
 *   removes the empty pair).
 * Prose uses **…** / ++…++; inside a math token ($…$ …) the LaTeX \textbf{…} / \underline{…}.
 */
export function wrapTextFormat(value: string, selectionStart: number, selectionEnd: number, format: TextFormat): FormatResult {
  let start = Math.max(0, Math.min(selectionStart, selectionEnd, value.length));
  let end = Math.min(value.length, Math.max(selectionStart, selectionEnd, start));

  if (isInsideMathToken(value, start, end)) {
    const cmd = MATH_CMD[format];
    const selected = value.slice(start, end);
    if (selected.startsWith(cmd) && selected.endsWith("}")) {
      const inner = selected.slice(cmd.length, -1);
      return { next: value.slice(0, start) + inner + value.slice(end), selectionStart: start, selectionEnd: start + inner.length };
    }
    if (value.slice(start - cmd.length, start) === cmd && value[end] === "}") {
      const next = value.slice(0, start - cmd.length) + value.slice(start, end) + value.slice(end + 1);
      return { next, selectionStart: start - cmd.length, selectionEnd: end - cmd.length };
    }
    const next = value.slice(0, start) + cmd + value.slice(start, end) + "}" + value.slice(end);
    return { next, selectionStart: start + cmd.length, selectionEnd: end + cmd.length };
  }

  const mark = PROSE_MARK[format];
  const m = mark.length;
  // Marks a piece keeping its edge spaces outside (** word** would show a bold space); empty → nothing.
  const marked = (piece: string) => {
    const core = piece.trim();
    if (!core) return piece;
    const lead = piece.slice(0, piece.length - piece.trimStart().length);
    const trail = piece.slice(piece.trimEnd().length);
    return `${lead}${mark}${core}${mark}${trail}`;
  };

  // 1. The selection itself carries the markers: **word** selected → word.
  const selected = value.slice(start, end);
  if (selected.length >= m * 2 && selected.startsWith(mark) && selected.endsWith(mark)) {
    const inner = selected.slice(m, -m);
    return { next: value.slice(0, start) + inner + value.slice(end), selectionStart: start, selectionEnd: start + inner.length };
  }

  // 2. Inside a formatted run (also the caret, or an empty pair **|**).
  const run = enclosingRun(value, start, end, mark);
  if (run) {
    const innerStart = run.open + m;
    const innerEnd = run.close;
    if (start === end || (start === innerStart && end === innerEnd)) {
      // The whole run (or the caret in it): remove its markers.
      const next = value.slice(0, run.open) + value.slice(innerStart, innerEnd) + value.slice(innerEnd + m);
      return { next, selectionStart: start - m, selectionEnd: end - m };
    }
    // A part of the run: the run closes before the selection and reopens after it.
    const left = marked(value.slice(innerStart, start));
    const mid = value.slice(start, end);
    const right = marked(value.slice(end, innerEnd));
    const head = value.slice(0, run.open) + left;
    return { next: head + mid + right + value.slice(innerEnd + m), selectionStart: head.length, selectionEnd: head.length + mid.length };
  }

  // 3. No selection: format the word under the caret, or open an empty pair.
  if (start === end) {
    const isWord = (ch: string | undefined) => Boolean(ch && /[\p{L}\p{N}'’-]/u.test(ch));
    if (isWord(value[start - 1]) || isWord(value[start])) {
      while (start > 0 && isWord(value[start - 1])) start -= 1;
      while (end < value.length && isWord(value[end])) end += 1;
    } else {
      const next = value.slice(0, start) + mark + mark + value.slice(start);
      return { next, selectionStart: start + m, selectionEnd: start + m };
    }
  }

  // 4. Wrap; spaces at the edges stay outside the markers (** word** would not render).
  while (start < end && /\s/.test(value[start])) start += 1;
  while (end > start && /\s/.test(value[end - 1])) end -= 1;
  const next = value.slice(0, start) + mark + value.slice(start, end) + mark + value.slice(end);
  return { next, selectionStart: start + m, selectionEnd: end + m };
}

function isInsideMathToken(value: string, start: number, end: number): boolean {
  MATH_TOKEN_PATTERN.lastIndex = 0;
  let match: RegExpExecArray | null;
  const re = new RegExp(MATH_TOKEN_PATTERN.source, "g");
  while ((match = re.exec(value))) {
    const tokenStart = match.index;
    const tokenEnd = tokenStart + match[0].length;
    // Selection fully inside the math body (not straddling delimiters).
    if (start >= tokenStart && end <= tokenEnd) return true;
  }
  return false;
}

/** Repair a full stem/stimulus string: normalize display math with &=. */
export function repairMathContent(content: string | null | undefined): string {
  if (!content) return "";
  return content
    .split(MATH_TOKEN_PATTERN)
    .map((part) => {
      const token = parseMathToken(part);
      if (!token) return part;
      const normalized = normalizeMathToken(token);
      if (!normalized.displayMode) return part;
      if (normalized.math === token.math) return part;
      // Prefer $$…$$ when original used $$; keep \[…\] otherwise.
      if (part.startsWith("$$")) return `$$${normalized.math}$$`;
      return `\\[${normalized.math}\\]`;
    })
    .join("");
}
