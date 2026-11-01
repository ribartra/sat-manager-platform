// 1) Copies dev.db (a production copy) into MANUAL_WORK, 2) removes one practice set and one Test
// (the empty slots the AI import guide fills), 3) removes pending invitations of real people,
// 4) creates the master teacher (no screen creates the first teacher). Never touches dev.db.
const fs = require("fs");
const path = require("path");
const bcrypt = require(path.join(__dirname, "../../../node_modules/bcryptjs"));
const Database = require(path.join(__dirname, "../../../node_modules/better-sqlite3"));
const { REPO, WORK, DB, PROGRAM, ACCOUNTS, MISSING } = require("./config.cjs");
(async () => {
  fs.mkdirSync(WORK, { recursive: true });
  for (const f of [DB, DB + "-wal", DB + "-shm"]) fs.rmSync(f, { force: true });
  await new Database(path.join(REPO, "dev.db"), { readonly: true }).backup(DB);
  const db = new Database(DB);
  const now = new Date().toISOString().replace("Z", "+00:00");
  db.transaction(() => {
    const ps = db.prepare("select id from PracticeSet where name = ?").get(MISSING.practiceSet);
    if (ps) {
      const used = db.prepare("select (select count(*) from Assignment where practiceSetId = ?) + (select count(*) from Attempt where practiceSetId = ?) n").get(ps.id, ps.id).n;
      if (used) throw new Error("the practice set to remove has assignments/attempts");
      db.prepare("delete from PracticeSetQuestion where practiceSetId = ?").run(ps.id);
      db.prepare("delete from PracticeSet where id = ?").run(ps.id);
    }
    const t = db.prepare("select id from FullPracticeTest where number = ? and sourceId = ?").get(MISSING.testNumber, MISSING.testSource);
    if (t) {
      const used = db.prepare("select (select count(*) from FullPracticeTestAssignment where testId = ?) + (select count(*) from FullPracticeTestAttempt where testId = ?) n").get(t.id, t.id).n;
      if (used) throw new Error("the Test to remove has assignments/attempts");
      db.prepare("delete from FullPracticeTestQuestion where moduleId in (select id from FullPracticeTestModule where testId = ?)").run(t.id);
      db.prepare("delete from FullPracticeTestModule where testId = ?").run(t.id);
      db.prepare("delete from FullPracticeTest where id = ?").run(t.id);
    }
    db.prepare("delete from InviteToken where usedAt is null").run();
    const m = ACCOUNTS.master;
    db.prepare(`insert into User (id,name,email,passwordHash,role,active,validationStatus,validationReviewedAt,termsAcceptedAt,termsVersion,sessionVersion,canManageTeachers,createdAt,updatedAt)
      values ('demo-master', ?, ?, ?, 'TEACHER', 1, 'APPROVED', ?, ?, '2026-10-28', 0, 1, ?, ?)`).run(m.name, m.email, bcrypt.hashSync(m.password, 10), now, now, now, now);
    db.prepare("insert into ProgramTeacher (programId, teacherId, startDate) values (?, 'demo-master', ?)").run(PROGRAM, now);
  })();
  const check = db.pragma("integrity_check", { simple: true });
  db.close();
  console.log("setup ok:", DB, "integrity", check);
})().catch((e) => { console.error("setup failed:", e.message); process.exit(1); });
