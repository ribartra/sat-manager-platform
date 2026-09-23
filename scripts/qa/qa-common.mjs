// Read-only QA helpers for comparing published Full Practice Test questions
// against their source files. NEVER writes to dev.db or official content.
import Database from "better-sqlite3";
import katex from "katex";
import fs from "node:fs";
import path from "node:path";

export const REPO_ROOT = "/home/turista/Descargas/Github/sat-manager-platform";
export const MOCK_ROOT = path.join(REPO_ROOT, "files_to_load", "MOCK EXAMS");
export const PUBLIC_QUESTIONS_DIR = path.join(REPO_ROOT, "public", "uploads", "questions");

export function remapAppPath(p) {
  if (!p) return p;
  return p.replace(/^\/app\//, REPO_ROOT + "/");
}

export function openDb() {
  return new Database(path.join(REPO_ROOT, "dev.db"), { readonly: true, fileMustExist: true });
}

// ---------- Math/prose rendering (port of lib/math-text.ts + components/math-content.tsx) ----------
const MATH_TOKEN_PATTERN = /(\$\$[\s\S]+?\$\$|\\\[[\s\S]+?\\\]|\$[^$\n]+?\$|\\\([\s\S]+?\\\))/g;
const ALIGNED_ENV_RE = /\\begin\{aligned\*?\}|\\begin\{align\*?\}/;
const AMP_EQ_RE = /&=/;

function parseMathToken(token) {
  if (token.startsWith("$$") && token.endsWith("$$")) return { math: token.slice(2, -2), displayMode: true, raw: token };
  if (token.startsWith("\\[") && token.endsWith("\\]")) return { math: token.slice(2, -2), displayMode: true, raw: token };
  if (token.startsWith("$") && token.endsWith("$")) return { math: token.slice(1, -1), displayMode: false, raw: token };
  if (token.startsWith("\\(") && token.endsWith("\\)")) return { math: token.slice(2, -2), displayMode: false, raw: token };
  return null;
}
function normalizeDisplayMathBody(math) {
  const body = math.trim();
  if (!body) return body;
  if (!AMP_EQ_RE.test(body)) return body;
  if (ALIGNED_ENV_RE.test(body)) return body;
  return `\\begin{aligned} ${body} \\end{aligned}`;
}
function parseProseSegments(prose) {
  if (!prose) return [];
  const pattern = /(\*\*[\s\S]+?\*\*|\+\+[\s\S]+?\+\+)/g;
  const parts = prose.split(pattern).filter((p) => p.length > 0);
  return parts.map((part) => {
    if (part.startsWith("**") && part.endsWith("**") && part.length >= 4) return { kind: "bold", text: part.slice(2, -2) };
    if (part.startsWith("++") && part.endsWith("++") && part.length >= 4) return { kind: "underline", text: part.slice(2, -2) };
    return { kind: "text", text: part };
  });
}
export function escapeHtml(s) {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
// Render content string to HTML exactly like <MathContent>
export function renderMathHtml(content) {
  const parts = String(content ?? "").split(MATH_TOKEN_PATTERN).filter((p) => p.length > 0);
  let out = "";
  for (const part of parts) {
    const tok = parseMathToken(part);
    if (tok) {
      let math = tok.math;
      if (tok.displayMode) math = normalizeDisplayMathBody(math);
      try {
        const html = katex.renderToString(math, { throwOnError: false, displayMode: tok.displayMode });
        out += tok.displayMode ? `<div>${html}</div>` : `<span>${html}</span>`;
      } catch {
        out += `<span>${escapeHtml(tok.raw)}</span>`;
      }
    } else {
      let seg = "";
      for (const s of parseProseSegments(part)) {
        if (s.kind === "bold") seg += `<strong>${escapeHtml(s.text)}</strong>`;
        else if (s.kind === "underline") seg += `<u>${escapeHtml(s.text)}</u>`;
        else seg += `<span>${escapeHtml(s.text)}</span>`;
      }
      out += `<span>${seg}</span>`;
    }
  }
  return `<div class="math-content">${out}</div>`;
}

// ---------- Published question resolution ----------
export function resolveTestQuestions(db, testName) {
  const rows = db.prepare(`
    SELECT m.section AS section, m.name AS moduleName, m."order" AS moduleOrder,
           fq."order" AS qOrder, fq.isPretest AS isPretest,
           q.id AS qid, q.type AS type, q.difficulty AS difficulty,
           q.stem AS stem, q.stimulus AS stimulus, q.correctAnswer AS correctAnswer,
           q.explanation AS explanation, q.imageUrl AS imageUrl, q.supportsGraph AS supportsGraph,
           c.id AS candId, c.questionNumber AS qnum, c.moduleLabel AS moduleLabel,
           c.section AS candSection, c.stem AS candStem, c.stimulus AS candStimulus,
           c.optionsJson AS candOptionsJson, c.correctAnswer AS candAnswer,
           c.answerSource AS answerSource, c.warningsJson AS warningsJson,
           sf.path AS sourcePath, sf.extension AS sourceExt, sf.isQuestionSource AS isQuestionSource,
           sf.isExplanationFile AS isExplanationFile, sf.section AS sourceSection,
           pa.pageNumber AS pageNumber
    FROM FullPracticeTest t
    JOIN FullPracticeTestModule m ON m.testId = t.id
    JOIN FullPracticeTestQuestion fq ON fq.moduleId = m.id
    JOIN Question q ON q.id = fq.questionId
    LEFT JOIN IngestQuestionCandidate c ON c.officialQuestionId = q.id
    LEFT JOIN IngestSourceFile sf ON sf.id = c.sourceFileId
    LEFT JOIN IngestPageArtifact pa ON pa.id = c.pageArtifactId
    WHERE t.name = ?
    ORDER BY m."order", fq."order"
  `).all(testName);

  const optStmt = db.prepare(`SELECT label, text, imageUrl FROM QuestionOption WHERE questionId = ? ORDER BY label ASC`);
  const N = { RW: 0, MATH: 0 };
  return rows.map((r) => {
    const options = optStmt.all(r.qid);
    // Sequential question number within its section (1..54 RW, 1..44 Math) for alignment.
    const seqKey = r.section === "MATH" ? "MATH" : "RW";
    N[seqKey] += 1;
    return {
      ...r,
      options,
      moduleKey: r.moduleOrder % 2 === 0 ? "M1" : "M2",
      sourcePathLocal: remapAppPath(r.sourcePath),
      sectionSeq: N[seqKey], // 1-based within section across both modules
      moduleSeq: r.qOrder + 1, // 1-based within module
    };
  });
}

// ---------- Source file inventory (scan + classify, robust to name variance) ----------
function walk(dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}
export function resolveSourceFilesForTest(n) {
  const dir = path.join(MOCK_ROOT, `TEST ${n}`);
  const files = walk(dir).filter((f) => /\.(pdf|docx)$/i.test(f));
  const rel = (f) => path.relative(MOCK_ROOT, f);
  const res = { test: n, dir, mathQ: null, rwQ: null, mathExpl: null, rwExpl: null, ansKey: null, all: files.map(rel) };
  for (const f of files) {
    const base = path.basename(f);
    const up = base.toUpperCase();
    const inMath = /\/MATHS?\//i.test(f) || /\bMATH\b/i.test(up);
    const inRW = /READING AND WRITING/i.test(f) || /\bR&?W\b/i.test(up) || /READING/i.test(up);
    const isKey = /ANS\.?\s*KEY|ANSWERS?\s*KEY/i.test(up);
    const isExpl = /EXPL|EXPLANATION|ANSWER\s*EXP|ANS\s*EXPLAN|ANSWERS?\b.*CHECKED/i.test(up);
    if (isKey) { if (!res.ansKey) res.ansKey = rel(f); continue; }
    if (isExpl) {
      if (inMath && !res.mathExpl) res.mathExpl = rel(f);
      else if (inRW && !res.rwExpl) res.rwExpl = rel(f);
      else if (!res.mathExpl && /MATH/i.test(up)) res.mathExpl = rel(f);
      else if (!res.rwExpl && /R&?W|READING/i.test(up)) res.rwExpl = rel(f);
      continue;
    }
    // question sources
    if (inMath && /\.pdf$/i.test(f) && !res.mathQ) { res.mathQ = rel(f); continue; }
    if (inRW && /\.(pdf|docx)$/i.test(f) && !res.rwQ) { res.rwQ = rel(f); continue; }
  }
  return res;
}

export function abs(relFromMock) {
  return relFromMock ? path.join(MOCK_ROOT, relFromMock) : null;
}
