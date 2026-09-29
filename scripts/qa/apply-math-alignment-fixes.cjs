// Apply Math Practice Set alignment fixes (docs/qa/practice/math-order-answer-alignment.md).
// Self-contained CommonJS so the same file runs locally and inside the prod web container.
//
// Ops JSON (array), every op guarded by its expected current value (`old`):
//   {t:"order", setId, questionId, old, new}          -> PracticeSetQuestion."order"
//   {t:"q",     id, field, old, new}                  -> Question.<field> (+ updatedAt)
//   {t:"opt",   questionId, label, old, new}         -> QuestionOption.text (+ Question.updatedAt)
//   {t:"cand",  id, field, old, new}                  -> IngestQuestionCandidate.<field>
//   {t:"psqMove", questionId, fromSet, toSet, oldOrder, newOrder}
//        -> moves the PracticeSetQuestion row to another set (old = fromSet:oldOrder)
// All-or-nothing: if any guard fails nothing is written.
//
// Usage: node apply-math-alignment-fixes.cjs <db> <ops.json> [--apply] [--backup=<rows.json>]
// Local dev.db: stop the Next dev server first (WAL safety) and take a file backup.
/* eslint-disable @typescript-eslint/no-require-imports -- plain CommonJS so it also runs inside the prod container */
const Database = require("better-sqlite3");
const fs = require("node:fs");

const [dbPath, opsPath, ...flags] = process.argv.slice(2);
if (!dbPath || !opsPath) { console.error("usage: <db> <ops.json> [--apply] [--backup=file]"); process.exit(2); }
const apply = flags.includes("--apply");
const backupPath = (flags.find((f) => f.startsWith("--backup=")) || "").slice(9) || null;

const Q_FIELDS = new Set(["correctAnswer", "explanation", "topicId", "stem"]);
const C_FIELDS = new Set(["questionExternalId", "correctAnswer"]);
const ops = JSON.parse(fs.readFileSync(opsPath, "utf8"));
const db = new Database(dbPath);
db.pragma("busy_timeout = 5000");

function current(op) {
  if (op.t === "order") {
    const r = db.prepare('SELECT "order" AS v FROM PracticeSetQuestion WHERE practiceSetId = ? AND questionId = ?').get(op.setId, op.questionId);
    return r ? r.v : undefined;
  }
  if (op.t === "psqMove") {
    const r = db.prepare('SELECT practiceSetId AS s, "order" AS o FROM PracticeSetQuestion WHERE questionId = ? AND practiceSetId IN (?, ?)').all(op.questionId, op.fromSet, op.toSet);
    if (r.length !== 1) return undefined;
    return `${r[0].s}:${r[0].o}`;
  }
  if (op.t === "q") {
    if (!Q_FIELDS.has(op.field)) throw new Error(`field not allowed: ${op.field}`);
    const r = db.prepare(`SELECT ${op.field} AS v FROM Question WHERE id = ?`).get(op.id);
    return r ? r.v : undefined;
  }
  if (op.t === "opt") {
    const r = db.prepare("SELECT text AS v FROM QuestionOption WHERE questionId = ? AND label = ?").all(op.questionId, op.label);
    return r.length === 1 ? r[0].v : undefined;
  }
  if (op.t === "cand") {
    if (!C_FIELDS.has(op.field)) throw new Error(`field not allowed: ${op.field}`);
    const r = db.prepare(`SELECT ${op.field} AS v FROM IngestQuestionCandidate WHERE id = ?`).get(op.id);
    return r ? r.v : undefined;
  }
  throw new Error(`unknown op type: ${op.t}`);
}

for (const op of ops) if (op.t === "psqMove") { op.old = `${op.fromSet}:${op.oldOrder}`; op.new = `${op.toSet}:${op.newOrder}`; }
const stale = [];
const already = [];
for (const op of ops) {
  const v = current(op);
  if (v === undefined) stale.push({ op, reason: "row not found" });
  else if (v === op.new && v !== op.old) already.push(op);
  else if (v !== op.old) stale.push({ op, reason: `current differs: ${JSON.stringify(String(v)).slice(0, 80)}` });
}
console.log(`ops=${ops.length} pending=${ops.length - already.length - stale.length} alreadyApplied=${already.length} stale=${stale.length}`);
for (const s of stale) console.log("STALE", s.op.t, s.op.id || s.op.questionId, s.op.field || "order", s.reason);
if (stale.length) { console.log("Aborting: guards failed, nothing written."); process.exit(1); }
if (!apply) { console.log("dry-run (pass --apply to write)"); process.exit(0); }

if (backupPath) fs.writeFileSync(backupPath, JSON.stringify(ops.map((o) => ({ ...o, before: current(o) })), null, 1));
const now = new Date().toISOString();
const run = db.transaction(() => {
  for (const op of ops) {
    if (already.includes(op)) continue;
    let info;
    if (op.t === "order") {
      info = db.prepare('UPDATE PracticeSetQuestion SET "order" = ? WHERE practiceSetId = ? AND questionId = ? AND "order" = ?').run(op.new, op.setId, op.questionId, op.old);
    } else if (op.t === "psqMove") {
      const del = db.prepare('DELETE FROM PracticeSetQuestion WHERE practiceSetId = ? AND questionId = ? AND "order" = ?').run(op.fromSet, op.questionId, op.oldOrder);
      if (del.changes !== 1) throw new Error(`psqMove delete changed ${del.changes} rows: ${op.questionId}`);
      info = db.prepare('INSERT INTO PracticeSetQuestion (practiceSetId, questionId, "order") VALUES (?, ?, ?)').run(op.toSet, op.questionId, op.newOrder);
    } else if (op.t === "q") {
      info = db.prepare(`UPDATE Question SET ${op.field} = ?, updatedAt = ? WHERE id = ? AND ${op.field} IS ?`).run(op.new, now, op.id, op.old);
    } else if (op.t === "opt") {
      info = db.prepare("UPDATE QuestionOption SET text = ? WHERE questionId = ? AND label = ? AND text IS ?").run(op.new, op.questionId, op.label, op.old);
      if (info.changes === 1) db.prepare("UPDATE Question SET updatedAt = ? WHERE id = ?").run(now, op.questionId);
    } else {
      info = db.prepare(`UPDATE IngestQuestionCandidate SET ${op.field} = ? WHERE id = ? AND ${op.field} IS ?`).run(op.new, op.id, op.old);
    }
    if (info.changes !== 1) throw new Error(`guarded update changed ${info.changes} rows: ${op.t} ${op.id || op.questionId}`);
  }
});
run();
db.pragma("wal_checkpoint(TRUNCATE)");
console.log("applied; integrity:", db.pragma("integrity_check", { simple: true }));
db.close();
