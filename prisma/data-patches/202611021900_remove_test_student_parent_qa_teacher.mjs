// Production test accounts, removed after the email checks of 2026-11-02:
//   - test student ricardo.bartra@pucp.edu.pe and test parent ricardo.bartra2000@gmail.com: deleted,
//     with everything they own (assignments, tries, answers, Tests, notifications, invite, links);
//   - QA teacher qa.teacher@satsol.org: deactivated (kept, so the audit log keeps its author).
// Guards: each account is matched by id AND email AND role; nothing else is touched. Audit rows keep
// the action with the user cleared (as the schema's SET NULL would do).
// Row count: 583 on production (dry run on a copy, 2026-11-02). A copy without these accounts
// (an older dev.db) changes nothing, so the count is checked inside, only when they are there.
const EXPECTED_ON_PRODUCTION = 583;

const STUDENT = { id: "cmvyky2r9000508pho6zw32j5", email: "ricardo.bartra@pucp.edu.pe", role: "STUDENT" };
const PARENT = { id: "cmvyky2rk000608phxxl7ncye", email: "ricardo.bartra2000@gmail.com", role: "PARENT" };
const QA_TEACHER = { id: "qa_teacher_20261101", email: "qa.teacher@satsol.org", role: "TEACHER" };

export default function (db) {
  const found = (u) => db.prepare('SELECT 1 FROM "User" WHERE "id" = ? AND lower("email") = ? AND "role" = ?').get(u.id, u.email, u.role);
  const run = (sql, ...args) => db.prepare(sql).run(...args);

  const total = () => db.prepare("SELECT total_changes() AS n").get().n;
  const start = total();
  const allThere = [STUDENT, PARENT, QA_TEACHER].every(found);
  const ids = [STUDENT, PARENT].filter(found).map((u) => u.id);
  if (ids.length) {
    const s = found(STUDENT) ? STUDENT.id : "__none__";
    const inUsers = `(${ids.map(() => "?").join(",")})`;
    // Practice
    run('DELETE FROM "AttemptAnswer" WHERE "attemptId" IN (SELECT "id" FROM "Attempt" WHERE "studentId" = ?)', s);
    run('DELETE FROM "AttemptPause" WHERE "attemptId" IN (SELECT "id" FROM "Attempt" WHERE "studentId" = ?)', s);
    run('DELETE FROM "UnlockRequest" WHERE "assignmentId" IN (SELECT "id" FROM "Assignment" WHERE "studentId" = ?)', s);
    run('DELETE FROM "Attempt" WHERE "studentId" = ?', s);
    run('DELETE FROM "Assignment" WHERE "studentId" = ?', s);
    // Tests
    run('DELETE FROM "FullPracticeTestAnswer" WHERE "attemptId" IN (SELECT "id" FROM "FullPracticeTestAttempt" WHERE "studentId" = ?)', s);
    run('DELETE FROM "FullPracticeTestPause" WHERE "attemptId" IN (SELECT "id" FROM "FullPracticeTestAttempt" WHERE "studentId" = ?)', s);
    run('DELETE FROM "FullPracticeTestAttempt" WHERE "studentId" = ?', s);
    run('DELETE FROM "FullPracticeTestAssignment" WHERE "studentId" = ?', s);
    // Links, program, invite, notifications, tokens
    run(`DELETE FROM "ParentStudent" WHERE "studentId" IN ${inUsers} OR "parentId" IN ${inUsers}`, ...ids, ...ids);
    run('DELETE FROM "ProgramEnrollment" WHERE "studentId" = ?', s);
    run('DELETE FROM "InviteToken" WHERE lower("email") = ? AND lower(coalesce("parentEmail", \'\')) = ?', STUDENT.email, PARENT.email);
    run(`DELETE FROM "Notification" WHERE "userId" IN ${inUsers}`, ...ids);
    run(`DELETE FROM "PasswordResetToken" WHERE "userId" IN ${inUsers}`, ...ids);
    run(`DELETE FROM "ParentAccessToken" WHERE "studentId" IN ${inUsers} OR "createdById" IN ${inUsers}`, ...ids, ...ids);
    run(`DELETE FROM "ParentLinkPromptDismissal" WHERE "studentId" IN ${inUsers} OR "userId" IN ${inUsers}`, ...ids, ...ids);
    run(`DELETE FROM "GroupMembership" WHERE "userId" IN ${inUsers}`, ...ids);
    run(`UPDATE "AuditLog" SET "userId" = NULL WHERE "userId" IN ${inUsers}`, ...ids);
    run(`DELETE FROM "User" WHERE "id" IN ${inUsers}`, ...ids);
  }

  // QA teacher: signed out everywhere (sessionVersion) and inactive.
  run('UPDATE "User" SET "active" = 0, "sessionVersion" = "sessionVersion" + 1 WHERE "id" = ? AND lower("email") = ? AND "role" = ? AND "active" = 1', QA_TEACHER.id, QA_TEACHER.email, QA_TEACHER.role);

  const changed = total() - start;
  if (allThere && changed !== EXPECTED_ON_PRODUCTION) throw new Error(`expected ${EXPECTED_ON_PRODUCTION} rows changed, got ${changed}`);
}
