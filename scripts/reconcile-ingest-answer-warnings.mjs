/**
 * Replace stale "The correct answer is missing." warnings when correctAnswer is set.
 * Dry-run by default; MODE=APPLY to write.
 *
 * Keep reconcile() in sync with lib/ingest-warnings.ts.
 */
import Database from "better-sqlite3";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

const MISSING_ANSWER_RE = /^The correct answer is missing\.?$/i;
const RECTIFIED = "Correct answer was filled in after ingest.";
const RECTIFIED_RE = /^Correct answer was filled in after ingest\.?$/i;
const IMAGE_HINT_RE = /^Answer looks like an image; check that the numeric answer is set\.?$/i;

function parse(raw) {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map((x) => String(x ?? "").trim()).filter(Boolean) : [];
  } catch {
    return [];
  }
}

function reconcile(raw, correctAnswer) {
  const hasAnswer = Boolean(String(correctAnswer ?? "").trim());
  const warnOut = [];
  const infoOut = [];
  let hadMissing = false;
  for (const warning of parse(raw)) {
    if (MISSING_ANSWER_RE.test(warning)) {
      hadMissing = true;
      if (!hasAnswer) warnOut.push("The correct answer is missing.");
      continue;
    }
    if (RECTIFIED_RE.test(warning)) {
      if (hasAnswer) infoOut.push(RECTIFIED);
      continue;
    }
    if (hasAnswer && IMAGE_HINT_RE.test(warning)) continue;
    warnOut.push(warning);
  }
  if (hasAnswer && hadMissing) infoOut.push(RECTIFIED);
  return JSON.stringify([...new Set(warnOut), ...new Set(infoOut)]);
}

const apply = process.env.MODE === "APPLY";
const dbPath = process.env.DB_PATH || path.join(root, "dev.db");
const db = new Database(dbPath);
const rows = db.prepare("SELECT id, correctAnswer, warningsJson FROM IngestQuestionCandidate").all();
const upd = db.prepare("UPDATE IngestQuestionCandidate SET warningsJson = ? WHERE id = ?");

let changed = 0;
let stillMissingStale = 0;
let infoNotes = 0;
const pending = [];

for (const row of rows) {
  const next = reconcile(row.warningsJson, row.correctAnswer);
  const prev = row.warningsJson ?? "[]";
  if (next !== prev) {
    changed += 1;
    pending.push([next, row.id]);
  }
  const check = next;
  if (check.includes("The correct answer is missing") && String(row.correctAnswer || "").trim()) {
    stillMissingStale += 1;
  }
  if (check.includes("filled in after ingest")) infoNotes += 1;
}

if (apply) {
  const tx = db.transaction(() => {
    for (const args of pending) upd.run(...args);
  });
  tx();
}

console.log(apply ? "APPLIED" : "DRY RUN", { dbPath, changed, stillMissingStale, infoNotes });
db.close();
