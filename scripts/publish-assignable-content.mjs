// Publish (DRAFT -> PUBLISHED) only content that is complete and answerable by a
// student, so teachers can select and assign it. Run with the Next dev server
// STOPPED (external writes to dev.db while it runs corrupt the file).
//
// Criteria for a publishable Question:
//   topic + difficulty + stem + correctAnswer, AND
//   NUMERIC, or MC with >=4 TEXT options and correctAnswer in A-D.
// (Explanation is NOT required — it doesn't block answering; it only enriches
//  the post-finish review.)
// A PracticeSet is published only when ALL its questions are publishable.
// Full Practice Tests are NOT published here: each still contains questions whose
// options/figures were never recovered (image-backed with no text/image), so they
// are not yet fully answerable. They stay DRAFT pending content recovery.
//
// Usage: DATABASE_URL=file:./dev.db node scripts/publish-assignable-content.mjs [--apply]
import Database from "better-sqlite3";

const url = process.env.DATABASE_URL || "file:./dev.db";
const apply = process.argv.includes("--apply");
const db = new Database(url.startsWith("file:") ? url.slice(5) : url);

const AD = new Set(["A", "B", "C", "D"]);
const qs = db.prepare(`
  SELECT q.id, q.type, q.difficulty, q.correctAnswer, q.stem, q.topicId,
         (SELECT count(*) FROM QuestionOption o WHERE o.questionId=q.id AND o.text IS NOT NULL AND o.text<>'') nText
  FROM Question q WHERE q.status='DRAFT'
`).all();
const publishableQ = new Set();
for (const q of qs) {
  if (!(q.topicId && q.difficulty && (q.stem || "").trim() && (q.correctAnswer || "").trim())) continue;
  if (q.type === "NUMERIC") { publishableQ.add(q.id); continue; }
  if (q.nText >= 4 && AD.has((q.correctAnswer || "").trim())) publishableQ.add(q.id);
}

const sets = db.prepare("SELECT id, name FROM PracticeSet WHERE status='DRAFT'").all();
const publishableSets = [];
for (const s of sets) {
  const ids = db.prepare("SELECT questionId FROM PracticeSetQuestion WHERE practiceSetId=?").all(s.id).map((r) => r.questionId);
  if (ids.length && ids.every((id) => publishableQ.has(id))) publishableSets.push(s);
}
// Only publish questions that belong to a set we will publish (keeps published
// questions inside published sets; standalone answerable questions stay DRAFT).
const qToPublish = new Set();
for (const s of publishableSets) {
  for (const r of db.prepare("SELECT questionId FROM PracticeSetQuestion WHERE practiceSetId=?").all(s.id)) qToPublish.add(r.questionId);
}

console.log(`DRAFT questions: ${qs.length} | answerable-complete: ${publishableQ.size}`);
console.log(`PracticeSets publishable (100% answerable): ${publishableSets.length} / ${sets.length}`);
console.log(`Questions to publish (members of those sets): ${qToPublish.size}`);
console.log(`Full Practice Tests: held as DRAFT (content recovery pending).`);

if (!apply) { console.log("\n(dry-run; pass --apply to write)"); db.close(); process.exit(0); }

const now = new Date().toISOString().replace("Z", "+00:00");
const tx = db.transaction(() => {
  const upQ = db.prepare("UPDATE Question SET status='PUBLISHED', updatedAt=? WHERE id=? AND status='DRAFT'");
  for (const id of qToPublish) upQ.run(now, id);
  const upS = db.prepare("UPDATE PracticeSet SET status='PUBLISHED', updatedAt=? WHERE id=? AND status='DRAFT'");
  for (const s of publishableSets) upS.run(now, s.id);
});
tx();

const pubQ = db.prepare("SELECT count(*) c FROM Question WHERE status='PUBLISHED'").get().c;
const pubS = db.prepare("SELECT count(*) c FROM PracticeSet WHERE status='PUBLISHED'").get().c;
console.log(`\nAPPLIED. Question PUBLISHED=${pubQ} | PracticeSet PUBLISHED=${pubS}`);
db.close();
