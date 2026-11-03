// Attempts no longer copy question content (lib/attempt-snapshots.ts, lib/full-test-snapshot.ts):
// results and grading read the current question, and a fixed answer key re-grades submitted attempts
// (lib/attempt-regrade.ts). This patch drops the copies already stored:
//  - AttemptAnswer.questionSnapshot → NULL (the practice attempt keeps its set structure, practiceSetSnapshot);
//  - FullPracticeTestAttempt.testSnapshot version 1 (structure + question content) → version 2
//    (structure only: modules, order, question ids, pretest flags).
// Checked before writing: `npm run regrade` (dry-run) over a production copy re-grades 0 attempts, so
// the stored right/wrong and scores already match the current keys. Self-guarded (only rows that still
// hold a copy), so no fixed `expect`.
export default function (db) {
  db.prepare('UPDATE "AttemptAnswer" SET "questionSnapshot" = NULL WHERE "questionSnapshot" IS NOT NULL').run();

  const rows = db
    .prepare(`SELECT "id", "testSnapshot" FROM "FullPracticeTestAttempt"
              WHERE json_valid("testSnapshot") AND json_extract("testSnapshot", '$.version') = 1`)
    .all();
  const update = db.prepare('UPDATE "FullPracticeTestAttempt" SET "testSnapshot" = ? WHERE "id" = ? AND "testSnapshot" = ?');
  for (const row of rows) {
    const snapshot = JSON.parse(row.testSnapshot);
    const structure = {
      version: 2,
      takenAt: snapshot.takenAt,
      testId: snapshot.testId,
      modules: (snapshot.modules ?? []).map((module) => ({
        id: module.id,
        name: module.name,
        section: module.section,
        order: module.order,
        timeLimit: module.timeLimit,
        questions: (module.questions ?? []).map((item) => ({ questionId: item.questionId, order: item.order, isPretest: Boolean(item.isPretest) })),
      })),
    };
    update.run(JSON.stringify(structure), row.id, row.testSnapshot);
  }
}
