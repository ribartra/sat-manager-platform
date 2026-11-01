import { readFile } from "node:fs/promises";
import Database from "better-sqlite3";

const dbPath = process.env.DB_PATH || "dev.db";
const schema = await readFile("prisma/schema.prisma", "utf8");
const practiceRoute = await readFile("app/api/assignments/route.ts", "utf8");
const examRoute = await readFile("app/api/full-practice-tests/[testId]/assign/route.ts", "utf8");
// Create/update/reassign rules (and the unique-race fallback) live in lib/assignments.ts.
const assignmentsLib = await readFile("lib/assignments.ts", "utf8");

const checks = [
  [schema.includes("@@unique([studentId, practiceSetId])"), "Prisma schema protects student + Practice Set assignments"],
  [schema.includes("@@unique([studentId, testId])"), "Prisma schema protects student + FPT assignments"],
  [assignmentsLib.includes('code === "P2002"'), "Assignment upserts handle unique races"],
  [practiceRoute.includes("upsertPracticeAssignment"), "Practice assignment API reuses the single assignment row"],
  [examRoute.includes("upsertFullTestAssignment"), "FPT assignment API reuses the single assignment row"],
];

for (const [ok, label] of checks) {
  if (!ok) throw new Error(`FAIL - ${label}`);
  console.log(`PASS - ${label}`);
}

const db = new Database(dbPath, { readonly: true, fileMustExist: true });
try {
  const quickCheck = db.prepare("PRAGMA quick_check").pluck().get();
  if (quickCheck !== "ok") throw new Error(`FAIL - SQLite quick_check: ${quickCheck}`);
  console.log("PASS - SQLite quick_check: ok");

  const duplicateQueries = [
    ["Assignment", "SELECT COUNT(*) FROM (SELECT studentId, practiceSetId FROM Assignment GROUP BY studentId, practiceSetId HAVING COUNT(*) > 1)"],
    ["FullPracticeTestAssignment", "SELECT COUNT(*) FROM (SELECT studentId, testId FROM FullPracticeTestAssignment GROUP BY studentId, testId HAVING COUNT(*) > 1)"],
  ];
  for (const [label, sql] of duplicateQueries) {
    const duplicateGroups = Number(db.prepare(sql).pluck().get());
    if (duplicateGroups !== 0) throw new Error(`FAIL - ${label} has ${duplicateGroups} duplicate groups`);
    console.log(`PASS - ${label} has no duplicate groups`);
  }
} finally {
  db.close();
}

console.log("Assignment integrity verification passed.");
