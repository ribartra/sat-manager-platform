// One-off/idempotent: give every FullPracticeTestAttempt without a testSnapshot one built from the
// CURRENT exam rows, flagged `backfilled: true` (RNF-17). New attempts get their snapshot at start
// (lib/full-test-snapshot.ts); this freezes the older ones so future edits stop changing them.
// Same shape as snapshotModules() in lib/full-test-snapshot.ts.
// Runs from deploy/web-entrypoint.sh after `migrate deploy`, before the server starts (no concurrent writers).
//   DATABASE_URL=file:./dev.db node scripts/backfill-fpt-snapshots.mjs [--dry]
import Database from "better-sqlite3";

const url = process.env.DATABASE_URL ?? "file:./dev.db";
const file = url.replace(/^file:/, "");
const dry = process.argv.includes("--dry");
const db = new Database(file);
db.pragma("busy_timeout = 5000");

const hasColumn = db.prepare("SELECT 1 FROM pragma_table_info('FullPracticeTestAttempt') WHERE name = 'testSnapshot'").get();
if (!hasColumn) {
  console.log("[backfill-fpt-snapshots] testSnapshot column missing; skipped");
  process.exit(0);
}

const pending = db.prepare("SELECT id, testId FROM FullPracticeTestAttempt WHERE testSnapshot IS NULL").all();
if (pending.length === 0) {
  console.log("[backfill-fpt-snapshots] nothing to backfill");
  process.exit(0);
}

const modulesStmt = db.prepare('SELECT id, name, section, "order", timeLimit FROM FullPracticeTestModule WHERE testId = ? ORDER BY "order"');
const itemsStmt = db.prepare(`
  SELECT fq.questionId, fq."order" AS ord, fq.isPretest, q.stem, q.stimulus, q.type, q.difficulty, q.correctAnswer,
         q.explanation, q.imageUrl, q.supportsGraph, t.id AS topicId, t.name AS topicName, d.id AS domainId, d.name AS domainName
  FROM FullPracticeTestQuestion fq
  JOIN Question q ON q.id = fq.questionId
  JOIN Topic t ON t.id = q.topicId
  JOIN Domain d ON d.id = t.domainId
  WHERE fq.moduleId = ? ORDER BY fq."order"`);
const optionsStmt = db.prepare("SELECT id, label, text, imageUrl FROM QuestionOption WHERE questionId = ? ORDER BY label");
const update = db.prepare("UPDATE FullPracticeTestAttempt SET testSnapshot = ? WHERE id = ? AND testSnapshot IS NULL");

const cache = new Map();
function snapshotFor(testId) {
  if (cache.has(testId)) return cache.get(testId);
  const modules = modulesStmt.all(testId).map((m) => ({
    id: m.id,
    name: m.name,
    section: m.section,
    order: m.order,
    timeLimit: m.timeLimit,
    questions: itemsStmt.all(m.id).map((row) => ({
      questionId: row.questionId,
      order: row.ord,
      isPretest: Boolean(row.isPretest),
      question: {
        id: row.questionId,
        stem: row.stem,
        stimulus: row.stimulus,
        type: row.type,
        difficulty: row.difficulty,
        correctAnswer: row.correctAnswer,
        explanation: row.explanation,
        imageUrl: row.imageUrl,
        supportsGraph: Boolean(row.supportsGraph),
        topic: { id: row.topicId, name: row.topicName, domain: { id: row.domainId, name: row.domainName } },
        options: optionsStmt.all(row.questionId).map((o) => ({ id: o.id, label: o.label, text: o.text, imageUrl: o.imageUrl })),
      },
    })),
  }));
  cache.set(testId, modules);
  return modules;
}

const takenAt = new Date().toISOString();
let done = 0;
const run = db.transaction(() => {
  for (const attempt of pending) {
    const modules = snapshotFor(attempt.testId);
    if (!modules.length) continue;
    const json = JSON.stringify({ version: 1, takenAt, backfilled: true, testId: attempt.testId, modules });
    if (!dry) done += update.run(json, attempt.id).changes;
    else done += 1;
  }
});
run();
console.log(`[backfill-fpt-snapshots] ${dry ? "would backfill" : "backfilled"} ${done}/${pending.length} attempts`);
