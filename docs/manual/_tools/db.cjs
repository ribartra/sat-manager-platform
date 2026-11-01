// Read helpers over the manual's database copy (ids are looked up by name, never hard-coded).
const Database = require(require("path").join(__dirname, "../../../node_modules/better-sqlite3"));
const { DB } = require("./config.cjs");
const open = (readonly = true) => new Database(DB, { readonly });
const one = (sql, ...args) => { const db = open(); try { return db.prepare(sql).get(...args); } finally { db.close(); } };
const all = (sql, ...args) => { const db = open(); try { return db.prepare(sql).all(...args); } finally { db.close(); } };
const userId = (email) => one("select id from User where email = ?", email)?.id;
const setId = (name) => one("select id from PracticeSet where name = ? and status = 'PUBLISHED'", name)?.id;
const assignmentId = (email, setName) => one(`select a.id from Assignment a join PracticeSet p on p.id = a.practiceSetId join User u on u.id = a.studentId where u.email = ? and p.name = ?`, email, setName)?.id;
const testAssignmentId = (email, number) => one(`select a.id from FullPracticeTestAssignment a join FullPracticeTest t on t.id = a.testId join User u on u.id = a.studentId where u.email = ? and t.number = ? order by a.createdAt limit 1`, email, number)?.id;
const answerKey = (setName) => all(`select q.correctAnswer a from PracticeSetQuestion x join Question q on q.id = x.questionId join PracticeSet p on p.id = x.practiceSetId where p.name = ? and p.status = 'PUBLISHED' order by x."order"`, setName).map((r) => r.a);
module.exports = { open, one, all, userId, setId, assignmentId, testAssignmentId, answerKey };
