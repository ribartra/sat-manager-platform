// "Import with AI" (simple import): an external AI reads the PDF and returns a CSV; the CSV rows
// become staging candidates (IngestQuestionCandidate) that are reviewed and cropped with the AI Import
// tools, then promoted to ONE new Practice Set or Test (Draft) under the chosen source.
import { randomUUID } from "crypto";
import { parseCsv } from "@/lib/csv";

export const QUICK_IMPORT_MODE = "AI_CSV";

/**
 * What each uploaded file is, as chosen in step 1 (never inferred from its name or path: on the
 * deployed app the teacher only uploads files).
 *   Practice Set: Q (questions PDF), ANS (answers / explanations).
 *   Test: per section, RW_Q (Module 1 + 2 in one file) or RW1_Q + RW2_Q (one file per module), the
 *   same for MATH; RW_ANS / MATH_ANS (that section's answers / explanations); KEY (one answer key for
 *   the whole Test).
 */
export type QuickFileSlot = "Q" | "ANS" | "RW_Q" | "RW1_Q" | "RW2_Q" | "MATH_Q" | "MATH1_Q" | "MATH2_Q" | "RW_ANS" | "MATH_ANS" | "KEY";
export type SectionLayout = "COMBINED" | "PER_MODULE";
/** Uploaded files by IngestSourceFile id: their slot and original name. */
export type QuickFiles = Record<string, { slot: QuickFileSlot; name: string }>;

export type QuickImportTarget =
  | {
      kind: "PRACTICE_SET";
      topicId: string;
      topicName: string;
      domainName: string;
      /** MATH | READING | WRITING */
      section: string;
      difficulty: "EASY" | "MEDIUM" | "HARD";
      files?: QuickFiles;
    }
  | {
      kind: "FULL_PRACTICE_TEST";
      testName: string;
      /** "TEST N" (groups versions across sources). */
      testNumber?: number;
      /** How each section's questions came: one file with both modules, or one file per module. */
      layout?: Record<"RW" | "MATH", SectionLayout>;
      files?: QuickFiles;
    };

export const QUESTION_SLOTS: ReadonlySet<QuickFileSlot> = new Set(["Q", "RW_Q", "RW1_Q", "RW2_Q", "MATH_Q", "MATH1_Q", "MATH2_Q"]);

export const QUICK_IMPORT_COLUMNS = [
  "number",
  "module",
  "domain",
  "skill",
  "difficulty",
  "type",
  "stimulus",
  "stem",
  "optionA",
  "optionB",
  "optionC",
  "optionD",
  "correctAnswer",
  "explanation",
  "figure",
  "figurePage",
  "notes",
] as const;

/** Test modules in order (R&W 1, R&W 2, Math 1, Math 2). */
export const TEST_MODULES = ["RW1", "RW2", "MATH1", "MATH2"] as const;
export type TestModuleCode = (typeof TEST_MODULES)[number];

/** A Test is imported one module at a time: what each module is, its PDF and its question count. */
export const TEST_MODULE_INFO: Record<TestModuleCode, { name: string; section: "RW" | "MATH"; second: boolean; expected: number; minutes: number }> = {
  RW1: { name: "Reading and Writing, Module 1", section: "RW", second: false, expected: 27, minutes: 32 },
  RW2: { name: "Reading and Writing, Module 2", section: "RW", second: true, expected: 27, minutes: 32 },
  MATH1: { name: "Math, Module 1", section: "MATH", second: false, expected: 22, minutes: 35 },
  MATH2: { name: "Math, Module 2", section: "MATH", second: true, expected: 22, minutes: 35 },
};

export function parseTestModule(value: unknown): TestModuleCode | null {
  const code = String(value ?? "").toUpperCase().replace(/[\s_-]/g, "");
  return (TEST_MODULES as readonly string[]).includes(code) ? (code as TestModuleCode) : null;
}

const fileIdsIn = (target: QuickImportTarget, slots: QuickFileSlot[]) =>
  Object.entries(target.files ?? {})
    .filter(([, file]) => slots.includes(file.slot))
    .map(([id]) => id);

/** The questions file a Test module is read from (by the section's layout), or null. */
export function moduleQuestionFileId(target: QuickImportTarget, code: TestModuleCode): string | null {
  if (target.kind !== "FULL_PRACTICE_TEST") return null;
  const section = TEST_MODULE_INFO[code].section;
  const combined = (target.layout?.[section] ?? "COMBINED") === "COMBINED";
  return fileIdsIn(target, [combined ? (`${section}_Q` as QuickFileSlot) : (`${code}_Q` as QuickFileSlot)])[0] ?? null;
}

/** Whether a Test module's questions file also holds the section's other module. */
export function moduleFileIsCombined(target: QuickImportTarget, code: TestModuleCode) {
  return target.kind === "FULL_PRACTICE_TEST" && (target.layout?.[TEST_MODULE_INFO[code].section] ?? "COMBINED") === "COMBINED";
}

/** The answer / explanation files to give the AI with a module (its section's + the Test's key), or with a set. */
export function answerFileIds(target: QuickImportTarget, code: TestModuleCode | null = null): string[] {
  if (target.kind === "PRACTICE_SET") return fileIdsIn(target, ["ANS"]);
  return code ? fileIdsIn(target, [`${TEST_MODULE_INFO[code].section}_ANS` as QuickFileSlot, "KEY"]) : fileIdsIn(target, ["RW_ANS", "MATH_ANS", "KEY"]);
}

/** Every questions file of the import, in module order (no repeats). */
export function questionFileIds(target: QuickImportTarget): string[] {
  if (target.kind === "PRACTICE_SET") return fileIdsIn(target, ["Q"]);
  return [...new Set(TEST_MODULES.map((code) => moduleQuestionFileId(target, code)).filter((id): id is string => Boolean(id)))];
}

/** The modules a Test questions file holds (one, or both of its section). */
export function modulesOfFile(target: QuickImportTarget, fileId: string): TestModuleCode[] {
  return TEST_MODULES.filter((code) => moduleQuestionFileId(target, code) === fileId);
}

export const fileName = (target: QuickImportTarget, id: string) => target.files?.[id]?.name ?? null;

/** The module code of a staged Test question (section + module label). */
export function candidateTestModule(candidate: { section: string | null; moduleLabel: string | null }): TestModuleCode {
  return TEST_MODULES[testModuleIndex(candidate)];
}
const FIGURES = new Set(["NONE", "STEM", "STIMULUS", "OPTIONS"]);

export function parseTarget(json: string | null | undefined): QuickImportTarget | null {
  if (!json) return null;
  try {
    const value = JSON.parse(json) as QuickImportTarget;
    return value && (value.kind === "PRACTICE_SET" || value.kind === "FULL_PRACTICE_TEST") ? value : null;
  } catch {
    return null;
  }
}

export type QuickRow = {
  rowNumber: number;
  number: number;
  /** Blocking problems: the row is not imported. */
  errors: string[];
  /** Imported, but needs a look in Review (figure to crop, AI note, unbalanced math…). */
  warnings: string[];
  candidate: {
    questionNumber: number;
    moduleLabel: string | null;
    contentType: string;
    section: string;
    domainName: string;
    topicName: string;
    difficulty: string;
    type: "MC" | "NUMERIC";
    stem: string | null;
    stimulus: string | null;
    optionsJson: string | null;
    correctAnswer: string | null;
    explanation: string | null;
    status: "READY" | "NEEDS_REVIEW";
    rawJson: string;
    warningsJson: string | null;
  };
};

/** An odd number of unescaped `$` usually means a broken LaTeX span. */
function unbalancedDollars(text: string) {
  const count = (text.replace(/\\\$/g, "").match(/\$/g) ?? []).length;
  return count % 2 === 1;
}

function normalizeAnswer(type: "MC" | "NUMERIC", value: string) {
  const raw = value.trim();
  if (type === "MC") return raw.replace(/^\(?\s*([A-Da-d])\s*[).:]?.*$/, "$1").toUpperCase();
  // Several accepted numeric answers are pipe-delimited ("8|9"), the platform's convention.
  return raw.replace(/\s*(\||;|\bor\b)\s*/gi, "|");
}

/**
 * CSV text → rows checked against the target (Practice Set: target taxonomy; Test: the `module`
 * column, or every row in `onlyModule` when the Test is loaded one module at a time).
 */
export function readQuickImportCsv(csv: string, target: QuickImportTarget, onlyModule: TestModuleCode | null = null): { rows: QuickRow[]; missingColumns: string[] } {
  const records = parseCsv(csv);
  const headers = new Set(Object.keys(records[0] ?? {}).map((h) => h.trim()));
  const required = target.kind === "FULL_PRACTICE_TEST" && !onlyModule ? ["number", "module", "type", "stem", "correctAnswer"] : ["number", "type", "stem", "correctAnswer"];
  const missingColumns = records.length ? required.filter((column) => !headers.has(column)) : required;
  const seen = new Set<string>();

  const rows = records.map((record, index): QuickRow => {
    const get = (key: string) => (record[key] ?? "").trim();
    const errors: string[] = [];
    const warnings: string[] = [];
    const number = Number.parseInt(get("number"), 10) || index + 1;
    const options = (["A", "B", "C", "D"] as const).map((label) => ({ label, text: get(`option${label}`) }));
    const typeValue = get("type").toUpperCase();
    const type: "MC" | "NUMERIC" = typeValue === "NUMERIC" || typeValue === "SPR" || (!typeValue && options.every((o) => !o.text)) ? "NUMERIC" : "MC";
    if (typeValue && !["MC", "NUMERIC", "SPR"].includes(typeValue)) errors.push(`type must be MC or NUMERIC (got "${get("type")}").`);

    let moduleLabel: string | null = null;
    let section = "";
    let domainName = "";
    let topicName = "";
    let difficulty = "";
    if (target.kind === "FULL_PRACTICE_TEST") {
      const moduleCode = onlyModule ?? get("module").toUpperCase().replace(/[\s_-]/g, "");
      const moduleIndex = TEST_MODULES.indexOf(moduleCode as (typeof TEST_MODULES)[number]);
      if (moduleIndex < 0) errors.push(`module must be one of ${TEST_MODULES.join(", ")} (got "${get("module")}").`);
      // Same staging shape as the OCR pipeline's Test candidates (lib/full-test-modules.ts).
      section = moduleIndex >= 2 ? "MATH" : "RW";
      moduleLabel = moduleIndex === 1 || moduleIndex === 3 ? "2" : "1";
      domainName = "Full Practice Test";
      topicName = moduleIndex === 1 || moduleIndex === 3 ? "M2" : "M1";
      difficulty = moduleIndex === 1 || moduleIndex === 3 ? "HARD" : "EASY";
    } else {
      section = target.section;
      domainName = target.domainName;
      topicName = target.topicName;
      difficulty = target.difficulty;
      if (get("difficulty") && get("difficulty").toUpperCase() !== target.difficulty) warnings.push(`CSV says difficulty "${get("difficulty")}"; the import uses ${target.difficulty}.`);
    }
    const key = `${moduleLabel ?? ""}:${section}:${number}`;
    if (seen.has(key)) errors.push(`Question ${number} appears twice${moduleLabel ? ` in ${get("module")}` : ""}.`);
    seen.add(key);

    const figure = (get("figure") || "NONE").toUpperCase();
    if (!FIGURES.has(figure)) warnings.push(`figure "${get("figure")}" is not NONE, STEM, STIMULUS or OPTIONS.`);
    if (figure !== "NONE" && FIGURES.has(figure)) {
      warnings.push(`Figure in ${figure.toLowerCase()}${get("figurePage") ? ` (page ${get("figurePage")})` : ""}: crop it from the PDF in Review.`);
    }
    const stem = get("stem");
    if (!stem && figure !== "STEM") errors.push("stem is empty.");
    const answer = get("correctAnswer") ? normalizeAnswer(type, get("correctAnswer")) : "";
    if (!answer) warnings.push("No correct answer: add it in Review.");
    if (type === "MC" && answer && !["A", "B", "C", "D"].includes(answer)) errors.push(`correctAnswer must be A, B, C or D for MC (got "${get("correctAnswer")}").`);
    const filledOptions = options.filter((o) => o.text).length;
    if (type === "MC" && filledOptions < 4 && figure !== "OPTIONS") warnings.push(`Only ${filledOptions} of 4 answer choices have text.`);
    for (const [field, text] of [["stem", stem], ["stimulus", get("stimulus")], ["explanation", get("explanation")], ...options.map((o) => [`option${o.label}`, o.text])] as const) {
      if (text && unbalancedDollars(text)) warnings.push(`${field}: unbalanced $ (check the LaTeX).`);
    }
    if (get("notes")) warnings.push(`AI note: ${get("notes")}`);

    const ready = errors.length === 0 && warnings.length === 0 && Boolean(answer) && (type === "NUMERIC" || filledOptions === 4) && figure === "NONE";
    return {
      rowNumber: index + 2,
      number,
      errors,
      warnings,
      candidate: {
        questionNumber: number,
        moduleLabel,
        contentType: target.kind,
        section,
        domainName,
        topicName,
        difficulty,
        type,
        stem: stem || null,
        stimulus: get("stimulus") || null,
        optionsJson: type === "MC" ? JSON.stringify(options) : null,
        correctAnswer: answer || null,
        explanation: get("explanation") || null,
        status: ready ? "READY" : "NEEDS_REVIEW",
        rawJson: JSON.stringify(record),
        warningsJson: warnings.length ? JSON.stringify(warnings) : null,
      },
    };
  });
  return { rows, missingColumns };
}

export const newCandidateId = () => `cand_${randomUUID().replace(/-/g, "")}`;

/** Order of a Test question: module (RW1 … MATH2) then number. */
export function testModuleIndex(candidate: { section: string | null; moduleLabel: string | null }) {
  const second = /2/.test(candidate.moduleLabel ?? "");
  return candidate.section === "MATH" ? (second ? 3 : 2) : second ? 1 : 0;
}

const difficultyWord = (d: string) => (d === "MEDIUM" ? "Medium" : d === "HARD" ? "Hard" : "Easy");

/** Detailed English prompt for the external AI: read the PDF visually and return the CSV file. */
export function buildCsvPrompt(target: QuickImportTarget, onlyModule: TestModuleCode | null = null) {
  const moduleInfo = onlyModule ? TEST_MODULE_INFO[onlyModule] : null;
  const sectionWord = moduleInfo?.section === "RW" ? "Reading and Writing" : "Math";
  const whichPart =
    onlyModule && moduleInfo && moduleFileIsCombined(target, onlyModule)
      ? `The attached ${sectionWord} questions PDF contains BOTH modules of that section, one after the other. Use ONLY ${moduleInfo.name}${moduleInfo.second ? ' (it starts where the PDF says "Module 2"; it may be labeled 2B or "harder"; if there is a 2A and a 2B, use 2B)' : ' (it ends where "Module 2" starts)'} and ignore the other module.`
      : moduleInfo
        ? `The attached questions PDF is ${moduleInfo.name} only${moduleInfo.second ? ' (if it holds a 2A and a 2B version, use 2B, the "harder" one)' : ""}.`
        : "";
  const scope =
    target.kind === "FULL_PRACTICE_TEST" && onlyModule && moduleInfo
      ? `This is ONE module of a full-length digital SAT practice test ("${target.testName}"): ${moduleInfo.name} (${onlyModule}).
${whichPart}
It should have ${moduleInfo.expected} questions, numbered from 1. The answer key and explanations attached may also cover other modules or the other section: use only what belongs to this module's questions.
Leave "module", "domain", "skill" and "difficulty" empty.`
      : target.kind === "PRACTICE_SET"
      ? `This is ONE SAT practice set. Every question belongs to:
- Section: ${target.section === "MATH" ? "Math" : target.section === "READING" ? "Reading" : "Writing"}
- Domain: ${target.domainName}
- Skill: ${target.topicName}
- Difficulty: ${difficultyWord(target.difficulty)}
Fill "domain", "skill" and "difficulty" with exactly these values and leave "module" empty.`
      : `This is ONE full-length digital SAT practice test ("${target.testName}") with 4 modules, in this order:
- RW1 = Reading and Writing, Module 1
- RW2 = Reading and Writing, Module 2
- MATH1 = Math, Module 1
- MATH2 = Math, Module 2
Fill "module" for every question (RW1, RW2, MATH1 or MATH2). Number questions as printed inside each module (they restart at 1 in every module). "domain", "skill" and "difficulty" may be left empty.`;

  return `You are a meticulous data-entry specialist for SAT preparation content. I am attaching a PDF (and possibly its answer key / explanations). Read EVERY page VISUALLY — do not rely only on the text layer — and rebuild every question completely and exactly as printed.

${scope}

OUTPUT: produce a downloadable file named "import.csv" (send it as a file I can download, not only as text in the chat). If you cannot attach files, output the whole CSV inside one single code block and nothing else.

CSV FORMAT (strict):
- UTF-8, comma-separated, RFC 4180. Wrap EVERY field in double quotes; write a literal double quote as "". Line breaks inside a field are allowed inside the quotes.
- First line is this exact header:
${QUICK_IMPORT_COLUMNS.join(",")}
- One row per question, in the order they appear. Never merge or split questions. Do not skip any question, even if it is hard to read — mark it in "notes".

COLUMNS:
- number: the question number as printed (integer).
- module: ${target.kind === "FULL_PRACTICE_TEST" && !onlyModule ? "RW1, RW2, MATH1 or MATH2." : "leave empty."}
- domain, skill, difficulty: ${target.kind === "PRACTICE_SET" ? "the values given above." : "optional."}
- type: MC (4 answer choices) or NUMERIC (student-produced response / grid-in).
- stimulus: the passage, text excerpt, table or data the question refers to (Reading & Writing passages, Math tables). Empty if none. Keep paragraph breaks.
- stem: the question itself (what is asked), without the answer choices.
- optionA … optionD: the text of each answer choice WITHOUT the letter prefix ("A)", "(A)"…). Empty for NUMERIC.
- correctAnswer: MC → one letter A, B, C or D. NUMERIC → the value as it would be gridded (e.g. 7/2 or 3.5); several accepted answers separated by a pipe: 7/2|3.5.
- explanation: the full rationale from the answer explanations, if provided; otherwise empty. Do not invent explanations.
- figure: NONE, STEM, STIMULUS or OPTIONS — where a graph, diagram, geometric figure or image appears that cannot be written as text or a table.
- figurePage: the PDF page number (1 = first page of the file) where that figure is; empty if figure is NONE.
- notes: anything you were unsure about (illegible text, missing answer, ambiguous choice). Empty if all is clear.

MATH AND FORMATTING (the platform renders KaTeX):
- Every mathematical expression goes in LaTeX: inline $...$ (e.g. $\\frac{3}{4}x + 2 = 11$, $x^{2}$, $\\sqrt{5}$, $\\pi r^{2}$, $\\le$, $\\ne$). A formula alone on its own line may use $$...$$.
- A literal dollar sign (money) is written \\$ (e.g. \\$12.50). Never leave a $ unbalanced.
- Tables: Markdown pipe tables with a header row, e.g. | x | y |, then |---|---|, then | 1 | 3 |.
- Keep italics/underlines only if they matter for the question (use *word*); otherwise plain text.
- Do not add text that is not in the PDF. Keep the original wording, punctuation and spelling.

QUALITY CHECK before you answer: the number of rows equals the number of questions in ${moduleInfo ? `${moduleInfo.name} (${moduleInfo.expected})` : "the PDF"}; every MC row has 4 choices and a letter answer; every NUMERIC row has a value; LaTeX braces and $ are balanced; the header is exactly as above.

Small example of the expected rows:
${QUICK_IMPORT_COLUMNS.join(",")}
"1","${target.kind === "FULL_PRACTICE_TEST" && !onlyModule ? "MATH1" : ""}","${target.kind === "PRACTICE_SET" ? target.domainName : ""}","${target.kind === "PRACTICE_SET" ? target.topicName : ""}","${target.kind === "PRACTICE_SET" ? difficultyWord(target.difficulty) : ""}","MC","","If $3x + 5 = 20$, what is the value of $x$?","$3$","$5$","$15$","$25$","B","Subtracting 5 from both sides gives $3x = 15$, so $x = 5$.","NONE","",""
"2","${target.kind === "FULL_PRACTICE_TEST" && !onlyModule ? "MATH1" : ""}","${target.kind === "PRACTICE_SET" ? target.domainName : ""}","${target.kind === "PRACTICE_SET" ? target.topicName : ""}","${target.kind === "PRACTICE_SET" ? difficultyWord(target.difficulty) : ""}","NUMERIC","| x | f(x) |\n|---|---|\n| 1 | 4 |\n| 3 | 10 |","The table shows values of the linear function $f$. What is $f(5)$?","","","","","16","","NONE","",""`;
}

/** Prompt that goes inside the artifacts zip: recover the figures as image files named per slot. */
export function buildImagePrompt(questions: Array<{ number: number; module: string | null; figure: string }>) {
  const list = questions.length
    ? questions.map((q) => `- Question ${q.number}${q.module ? ` (${q.module})` : ""}: ${q.figure}`).join("\n")
    : "- (no question was flagged; check every page for graphs, diagrams and image-only answer choices)";
  return `You are helping recover the images of SAT questions. This zip contains the original PDF (folder "original"), every page rendered as PNG (folder "pages") and the questions already imported ("candidates.csv").

Crop, from the page images or the PDF, every figure that a question needs and that cannot be written as text: graphs, diagrams, geometric figures, images used as answer choices, and tables that only exist as pictures.

Return ONE zip file with PNG images named exactly:
- Q<number>_STEM.png       → the figure of the question
- Q<number>_STIMULUS.png   → the figure of the passage / data shown before the question
- Q<number>_A.png … Q<number>_D.png → answer choices that are images
${questions.some((q) => q.module) ? "Full test: question numbers restart in every module, so prefix each name with its module: RW1_Q3_STEM.png, MATH2_Q12_A.png (modules RW1, RW2, MATH1, MATH2).\n" : ""}
Rules: crop tightly around the figure (no page headers, question numbers, or answer letters), keep the original resolution or higher, white background, no compression artifacts. Do not redraw or alter the figure.

Questions flagged with a figure:
${list}`;
}
