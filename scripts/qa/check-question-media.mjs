#!/usr/bin/env node
// Read-only check: question images must be files referenced by URL (never base64), and attempts must
// only reference them. Reports data: URIs in the bank and in attempt snapshots, and snapshot images
// that differ from the live question (harmless now: results read images from the live question).
// Usage: node scripts/qa/check-question-media.mjs [path/to/dev.db]
import Database from "better-sqlite3";

const db = new Database(process.argv[2] ?? "dev.db", { readonly: true, fileMustExist: true });
const count = (sql) => db.prepare(sql).get().c;
const report = {
  questionsWithDataUri: count("SELECT COUNT(*) c FROM Question WHERE imageUrl LIKE 'data:%'"),
  optionsWithDataUri: count("SELECT COUNT(*) c FROM QuestionOption WHERE imageUrl LIKE 'data:%'"),
  testSnapshotsWithDataUri: count("SELECT COUNT(*) c FROM FullPracticeTestAttempt WHERE testSnapshot LIKE '%data:image%'"),
  practiceSnapshotsWithDataUri: count("SELECT COUNT(*) c FROM AttemptAnswer WHERE questionSnapshot LIKE '%data:image%'"),
};
const live = db.prepare("SELECT imageUrl FROM Question WHERE id = ?");
let snapshotQuestions = 0;
let staleImages = 0;
for (const row of db.prepare("SELECT testSnapshot FROM FullPracticeTestAttempt WHERE testSnapshot IS NOT NULL").all()) {
  for (const testModule of JSON.parse(row.testSnapshot).modules ?? []) {
    for (const item of testModule.questions ?? []) {
      snapshotQuestions += 1;
      const frozen = item.question?.imageUrl ?? null;
      if (frozen !== null && frozen !== (live.get(item.questionId)?.imageUrl ?? null)) staleImages += 1;
    }
  }
}
report.testSnapshotQuestions = snapshotQuestions;
report.testSnapshotImagesDifferentFromBank = staleImages;
console.log(JSON.stringify(report, null, 2));
const bad = report.questionsWithDataUri + report.optionsWithDataUri + report.testSnapshotsWithDataUri + report.practiceSnapshotsWithDataUri;
process.exit(bad > 0 ? 1 : 0);
