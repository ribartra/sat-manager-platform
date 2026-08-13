/**
 * Local-only content repairs:
 *  1) Normalize display-math stems/stimuli that use &= without aligned/align.
 *  2) When a stem contains underlined: '…' (or "…"), wrap the first matching
 *     occurrence in the stimulus with ++…++ so MathContent can render it.
 *
 *   MODE=APPLY node scripts/repair-math-underline-local.mjs
 */
import Database from "better-sqlite3";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const apply = process.env.MODE === "APPLY";
const dbPath = process.env.DB_PATH || path.join(root, "dev.db");

const MATH_TOKEN_PATTERN =
  /(\$\$[\s\S]+?\$\$|\\\[[\s\S]+?\\\]|\$[^$\n]+?\$|\\\([\s\S]+?\\\))/g;
const ALIGNED_ENV_RE = /\\begin\{aligned\*?\}|\\begin\{align\*?\}/;
const AMP_EQ_RE = /&=/;

function parseMathToken(token) {
  if (token.startsWith("$$") && token.endsWith("$$")) {
    return { math: token.slice(2, -2), displayMode: true, wrap: (m) => `$$${m}$$` };
  }
  if (token.startsWith("\\[") && token.endsWith("\\]")) {
    return { math: token.slice(2, -2), displayMode: true, wrap: (m) => `\\[${m}\\]` };
  }
  return null;
}

function repairMathContent(content) {
  if (!content) return content;
  return content
    .split(MATH_TOKEN_PATTERN)
    .map((part) => {
      const token = parseMathToken(part);
      if (!token || !token.displayMode) return part;
      const body = token.math.trim();
      if (!AMP_EQ_RE.test(body) || ALIGNED_ENV_RE.test(body)) return part;
      return token.wrap(`\\begin{aligned} ${body} \\end{aligned}`);
    })
    .join("");
}

function extractUnderlinedHint(stem) {
  if (!stem) return null;
  const patterns = [
    /underlined\s*:\s*'([^']+)'/i,
    /underlined\s*:\s*"([^"]+)"/i,
    /underlined\s*:\s*[“"]([^”"]+)[”"]/i,
  ];
  for (const re of patterns) {
    const m = stem.match(re);
    if (m?.[1]?.trim()) return m[1].trim();
  }
  return null;
}

function wrapStimulusUnderline(stimulus, phrase) {
  if (!stimulus || !phrase) return stimulus;
  if (stimulus.includes(`++${phrase}++`)) return stimulus;
  const idx = stimulus.indexOf(phrase);
  if (idx < 0) return stimulus;
  return stimulus.slice(0, idx) + `++${phrase}++` + stimulus.slice(idx + phrase.length);
}

const db = new Database(dbPath);
db.pragma("journal_mode = WAL");

let mathFixed = 0;
let underlineFixed = 0;
const samples = [];

const rows = db
  .prepare("SELECT id, stem, stimulus, explanation FROM Question")
  .all();

const updates = [];
for (const row of rows) {
  let stem = row.stem ?? "";
  let stimulus = row.stimulus ?? "";
  let explanation = row.explanation ?? "";
  let changed = false;

  const nextStem = repairMathContent(stem);
  const nextStimulus = repairMathContent(stimulus);
  const nextExplanation = repairMathContent(explanation);
  if (nextStem !== stem) {
    stem = nextStem;
    changed = true;
    mathFixed += 1;
  }
  if (nextStimulus !== stimulus) {
    stimulus = nextStimulus;
    changed = true;
    mathFixed += 1;
  }
  if (nextExplanation !== explanation) {
    explanation = nextExplanation;
    changed = true;
    mathFixed += 1;
  }

  const hint = extractUnderlinedHint(stem);
  if (hint && stimulus) {
    const wrapped = wrapStimulusUnderline(stimulus, hint);
    if (wrapped !== stimulus) {
      stimulus = wrapped;
      changed = true;
      underlineFixed += 1;
      if (samples.length < 8) {
        samples.push({ id: row.id, phrase: hint.slice(0, 80) });
      }
    }
  }

  if (changed) {
    updates.push({ id: row.id, stem, stimulus, explanation });
  }
}

if (apply) {
  const upd = db.prepare(
    "UPDATE Question SET stem = ?, stimulus = ?, explanation = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?",
  );
  const tx = db.transaction(() => {
    for (const u of updates) upd.run(u.stem, u.stimulus || null, u.explanation || null, u.id);
  });
  tx();
}

console.log(apply ? "APPLIED" : "DRY RUN");
console.log({ dbPath, rowsChanged: updates.length, mathFixed, underlineFixed });
for (const s of samples) console.log("- underline", s.id, JSON.stringify(s.phrase));
const alignedSample = updates.find((u) => u.stem.includes("\\begin{aligned}"));
if (alignedSample) {
  console.log("- aligned stem", alignedSample.id, alignedSample.stem.slice(0, 120).replace(/\n/g, " | "));
}
db.close();
