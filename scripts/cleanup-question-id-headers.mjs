/**
 * Strip leaked College Board chrome ("Question ID: ab12cd34", "# Question",
 * Assessment headers, trailing "**Answer**") from official Questions and
 * ingest candidates. Dry-run by default; MODE=APPLY to write.
 *
 *   node scripts/cleanup-question-id-headers.mjs
 *   MODE=APPLY node scripts/cleanup-question-id-headers.mjs
 *   DB_PATH=/db/dev.db MODE=APPLY node scripts/cleanup-question-id-headers.mjs
 */
import Database from "better-sqlite3";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

// Keep in sync with lib/ingest-text-sanitize.ts stripCollegeBoardMetaHeaders.
const CB_QUESTION_ID_LINE =
  /^(?:\*{1,2}|_{1,2}|#+\s*)?\s*(?:Question\s+ID|ID)\s*:?\s*[A-Fa-f0-9]{6,}\s*(?:\*{1,2}|_{1,2})?\s*$/i;
const CB_QUESTION_ID_PREFIX =
  /^(?:\*{1,2}|_{1,2}|#+\s*)?\s*(?:Question\s+ID|ID)\s*:?\s*[A-Fa-f0-9]{6,}\s*(?:\*{1,2}|_{1,2})?\s*/i;
const CB_QUESTION_ID_INLINE = /\bQuestion\s+ID\s*:?\s*[A-Fa-f0-9]{6,}\b/gi;
const CB_BARE_QUESTION_LABEL =
  /^(?:#+\s*)?(?:\*{1,2}|_{1,2})?\s*Question(?:\s+\d+)?\s*(?:\*{1,2}|_{1,2})?\s*$/i;
const CB_ASSESSMENT_HEADER = /^Assessment\s+Test\s+Domain\s+Skill\s+Difficulty\s*$/i;
const CB_SAT_TAXONOMY_HEADER = /^SAT\s+(?:Math|Reading\s+and\s+Writing)\b/i;
const CB_ANSWER_LABEL = /^(?:#+\s*)?(?:\*{1,2}|_{1,2})?\s*Answer\s*(?:\*{1,2}|_{1,2})?\s*$/i;
const CB_RATIONALE_START = /^(?:Choice\s+[A-D]\s+is\s+correct|The\s+correct\s+answer\s+is)/i;

function isMeta(line) {
  const trimmed = line.replace(/^#+\s*/, "").trim();
  if (!trimmed) return true;
  return (
    CB_QUESTION_ID_LINE.test(trimmed) ||
    CB_BARE_QUESTION_LABEL.test(trimmed) ||
    CB_ASSESSMENT_HEADER.test(trimmed) ||
    CB_SAT_TAXONOMY_HEADER.test(trimmed)
  );
}

function stripCollegeBoardMetaHeaders(value) {
  if (!value) return "";
  let text = String(value).replace(/\r\n/g, "\n");
  const lines = text.split("\n");
  const rationaleIdx = lines.findIndex((line) => CB_RATIONALE_START.test(line.trim()));
  if (rationaleIdx > 0) {
    const sliced = lines.slice(rationaleIdx).join("\n").trim();
    if (sliced.length >= 40) text = sliced;
  }
  const kept = [];
  let strippingLead = true;
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (strippingLead && isMeta(line)) continue;
    strippingLead = false;
    if (
      CB_QUESTION_ID_LINE.test(trimmed) ||
      CB_BARE_QUESTION_LABEL.test(trimmed) ||
      CB_ASSESSMENT_HEADER.test(trimmed)
    ) {
      continue;
    }
    if (CB_ANSWER_LABEL.test(trimmed)) break;
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
    if (CB_BARE_QUESTION_LABEL.test(cleanedLine.trim())) continue;
    kept.push(cleanedLine);
  }
  const out = kept.join("\n").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  if (/^rationale\.?$/i.test(out)) return "";
  return out;
}

const apply = process.env.MODE === "APPLY";
const dbPath = process.env.DB_PATH || path.join(root, "dev.db");
const db = new Database(dbPath);
db.pragma("journal_mode = WAL");

const targets = [
  { table: "Question", fields: ["stem", "stimulus", "explanation"], touchUpdated: true },
  { table: "IngestQuestionCandidate", fields: ["stem", "stimulus", "explanation"], touchUpdated: false },
];

let changedRows = 0;
let changedFields = 0;
const samples = [];
const pending = [];

for (const { table, fields, touchUpdated } of targets) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all().map((c) => c.name);
  const present = fields.filter((f) => cols.includes(f));
  if (present.length === 0) continue;

  for (const row of db.prepare(`SELECT id, ${present.join(", ")} FROM ${table}`).all()) {
    const next = {};
    let rowChanged = false;
    for (const field of present) {
      const before = row[field] ?? "";
      let after = stripCollegeBoardMetaHeaders(before);
      if (field === "stem" && String(before).trim() && !after.trim()) after = before;
      next[field] = after;
      if (after !== before) {
        rowChanged = true;
        changedFields += 1;
        if (samples.length < 15) {
          samples.push({
            table,
            id: row.id,
            field,
            before: String(before).slice(0, 140).replace(/\n/g, " | "),
            after: String(after).slice(0, 140).replace(/\n/g, " | "),
          });
        }
      }
    }
    if (!rowChanged) continue;
    changedRows += 1;
    pending.push({ table, present, touchUpdated, id: row.id, next });
  }
}

if (apply) {
  const stmts = new Map();
  const getStmt = (table, present, touchUpdated) => {
    const key = `${table}:${present.join(",")}:${touchUpdated}`;
    if (!stmts.has(key)) {
      const setters = present.map((f) => `${f} = ?`).join(", ");
      const sql = touchUpdated
        ? `UPDATE ${table} SET ${setters}, updatedAt = CURRENT_TIMESTAMP WHERE id = ?`
        : `UPDATE ${table} SET ${setters} WHERE id = ?`;
      stmts.set(key, db.prepare(sql));
    }
    return stmts.get(key);
  };
  const tx = db.transaction(() => {
    for (const item of pending) {
      getStmt(item.table, item.present, item.touchUpdated).run(
        ...item.present.map((f) => item.next[f] || null),
        item.id,
      );
    }
  });
  tx();
}

console.log(apply ? "APPLIED" : "DRY RUN");
console.log(`db=${dbPath}`);
console.log(`rowsChanged=${changedRows} fieldsChanged=${changedFields}`);
for (const s of samples) {
  console.log(`- ${s.table}.${s.field} ${s.id}`);
  console.log(`  before: ${s.before}`);
  console.log(`  after:  ${s.after}`);
}
db.close();
