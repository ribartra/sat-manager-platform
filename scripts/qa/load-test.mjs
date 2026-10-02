// Load / concurrency test for RNF-20/21: N students take a Full Practice Test at the same time
// (autosave every 2–3 s, like the real player), teachers refresh dashboards, then everyone submits
// at once. Reports p50/p95/max latency per endpoint and every non-2xx.
//
//   1) prepare a COPY of a database (never the live dev.db / prod DB):
//        node scripts/qa/load-test.mjs prepare <db-copy.sqlite> [students=10]
//   2) start the app against it (ideally the production image limited like the e2-medium:
//        docker run --cpus=2 --memory=4g ... -e DATABASE_URL=file:/db/<copy>)
//   3) run:
//        node scripts/qa/load-test.mjs run <baseUrl> <db-copy.sqlite> [seconds=300] [students=10]
import Database from "better-sqlite3";
import bcrypt from "bcryptjs";

const [mode, ...rest] = process.argv.slice(2);
const PASSWORD = "LoadTest#2026";
const PREFIX = "load-student-";

function percentile(sorted, p) {
  if (!sorted.length) return 0;
  return sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)];
}

if (mode === "prepare") {
  const [dbPath, n = "10"] = rest;
  const db = new Database(dbPath);
  const hash = bcrypt.hashSync(PASSWORD, 10);
  const now = new Date().toISOString();
  const test = db.prepare("select id from FullPracticeTest where status='PUBLISHED' order by name limit 1").get();
  const program = db.prepare("select id from Program where active=1 order by createdAt limit 1").get();
  const teacher = db.prepare("select id, email from User where role='TEACHER' and active=1 limit 1").get();
  db.prepare("update User set passwordHash=? where id=?").run(hash, teacher.id);
  db.prepare("insert or ignore into ProgramTeacher (programId, teacherId) values (?, ?)").run(program.id, teacher.id);
  for (let i = 1; i <= Number(n); i++) {
    const id = `${PREFIX}${i}`;
    db.prepare("insert or ignore into User (id,name,email,passwordHash,role,active,validationStatus,createdAt,updatedAt) values (?,?,?,?,'STUDENT',1,'APPROVED',?,?)")
      .run(id, `Load Student ${i}`, `${id}@load.local`, hash, now, now);
    db.prepare("insert or ignore into ProgramEnrollment (programId,studentId,enrolledAt,active,status) values (?,?,?,1,'APPROVED')").run(program.id, id, now);
    db.prepare("insert or ignore into FullPracticeTestAssignment (id,testId,studentId,status,createdAt) values (?,?,?,'PENDING',?)").run(`load-fa-${i}`, test.id, id, now);
  }
  console.log(JSON.stringify({ prepared: Number(n), test: test.id, program: program.id, teacher: teacher.email }));
  process.exit(0);
}

if (mode !== "run") {
  console.error("usage: load-test.mjs prepare <db> [n] | run <baseUrl> <db> [seconds] [n]");
  process.exit(2);
}

const [base, dbPath, secondsArg = "300", nArg = "10"] = rest;
const SECONDS = Number(secondsArg);
const N = Number(nArg);
const db = new Database(dbPath, { readonly: true });
db.pragma("busy_timeout = 5000");
const teacherEmail = db.prepare("select u.email from User u join ProgramTeacher pt on pt.teacherId=u.id where u.role='TEACHER' and u.active=1 limit 1").get().email;

const samples = new Map(); // endpoint → ms[]
const failures = [];
function record(name, ms, status, detail = "") {
  if (!samples.has(name)) samples.set(name, []);
  samples.get(name).push(ms);
  if (status < 200 || status >= 400) failures.push(`${name} ${status} ${detail}`.slice(0, 200));
}

class Client {
  constructor() {
    this.cookies = new Map();
  }
  cookieHeader() {
    return [...this.cookies].map(([k, v]) => `${k}=${v}`).join("; ");
  }
  absorb(res) {
    for (const raw of res.headers.getSetCookie?.() ?? []) {
      const [pair] = raw.split(";");
      const idx = pair.indexOf("=");
      this.cookies.set(pair.slice(0, idx).trim(), pair.slice(idx + 1));
    }
  }
  async req(name, path, init = {}) {
    const started = performance.now();
    let res;
    try {
      res = await fetch(`${base}${path}`, {
        redirect: "manual",
        ...init,
        headers: { cookie: this.cookieHeader(), ...(init.headers ?? {}) },
      });
    } catch (error) {
      record(name, performance.now() - started, 0, String(error));
      return null;
    }
    const body = await res.text();
    record(name, performance.now() - started, res.status, res.status >= 400 ? body.slice(0, 120) : "");
    this.absorb(res);
    return { status: res.status, body };
  }
  async login(email) {
    const csrf = await this.req("auth.csrf", "/api/auth/csrf");
    const { csrfToken } = JSON.parse(csrf.body);
    const form = new URLSearchParams({ csrfToken, email, password: PASSWORD, callbackUrl: `${base}/` });
    await this.req("auth.login", "/api/auth/callback/credentials", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: form,
    });
    if (![...this.cookies.keys()].some((k) => k.includes("session-token"))) throw new Error(`login failed for ${email}`);
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const deadline = Date.now() + SECONDS * 1000;

async function student(i) {
  const c = new Client();
  const id = `${PREFIX}${i}`;
  await c.login(`${id}@load.local`);
  await c.req("page.fpt_player", `/student/full-tests/load-fa-${i}`);
  const attempt = db.prepare("select id, testSnapshot from FullPracticeTestAttempt where assignmentId=? and status='IN_PROGRESS'").get(`load-fa-${i}`);
  if (!attempt) throw new Error(`no attempt for ${id}`);
  const modules = JSON.parse(attempt.testSnapshot).modules;
  const questions = modules.flatMap((m, mi) => m.questions.map((q) => ({ id: q.questionId, mi, type: q.question.type, options: q.question.options })));
  const answers = {};
  const timeSpent = {};
  const marked = new Set();
  let q = 0;
  while (Date.now() < deadline) {
    const item = questions[q % questions.length];
    answers[item.id] = item.options.length ? item.options[(i + q) % item.options.length].label : String((i + q) % 9);
    timeSpent[item.id] = (timeSpent[item.id] ?? 0) + 3;
    if (q % 7 === 0) marked.add(item.id);
    await c.req("api.fpt_autosave", `/api/full-practice-tests/attempts/${attempt.id}/autosave`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        answers,
        currentModule: item.mi,
        currentQuestion: q % 27,
        timeExpiredEvents: 0,
        extraTimeUsed: 0,
        moduleTimerState: { timers: modules.map((m) => m.timeLimit), phase: "MODULE", breakRemaining: 0 },
        timeSpentByQuestion: timeSpent,
        markedQuestionIds: [...marked],
        notes: {},
        eliminatedOptions: {},
      }),
    });
    q += 1;
    await sleep(2000 + Math.random() * 1000);
  }
  return { c, attempt, answers, timeSpent, marked };
}

async function teacher() {
  const c = new Client();
  await c.login(teacherEmail);
  while (Date.now() < deadline) {
    await c.req("page.teacher_dashboard", "/teacher");
    await c.req("page.teacher_student", `/teacher/students/${PREFIX}${1 + Math.floor(Math.random() * N)}`);
    await sleep(5000);
  }
}

console.log(`load: ${N} students + 2 teachers for ${SECONDS}s against ${base}`);
const started = Date.now();
const [states] = await Promise.all([
  Promise.all(Array.from({ length: N }, (_, k) => student(k + 1))),
  teacher(),
  teacher(),
]);

// Everyone submits at the same moment (end of a timed class exam).
await Promise.all(
  states.map(({ c, attempt, answers, timeSpent, marked }) =>
    c.req("api.fpt_submit", `/api/full-practice-tests/attempts/${attempt.id}/submit`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ answers, timeSpentByQuestion: timeSpent, timeExpiredEvents: 0, extraTimeUsed: 0, markedQuestionIds: [...marked], notes: {}, eliminatedOptions: {} }),
    }),
  ),
);
await Promise.all(states.map(({ c, attempt }) => c.req("page.fpt_results", `/student/full-tests/results/${attempt.id}`)));

const rows = [...samples].map(([name, ms]) => {
  const s = [...ms].sort((a, b) => a - b);
  return { endpoint: name, n: s.length, p50: Math.round(percentile(s, 50)), p95: Math.round(percentile(s, 95)), max: Math.round(s[s.length - 1]) };
});
console.table(rows);
const submitted = new Database(dbPath, { readonly: true })
  .prepare(`select count(*) n from FullPracticeTestAttempt where studentId like '${PREFIX}%' and status='SUBMITTED'`)
  .get().n;
const summary = {
  seconds: Math.round((Date.now() - started) / 1000),
  students: N,
  requests: rows.reduce((sum, r) => sum + r.n, 0),
  failures: failures.length,
  submitted,
  worstP95: Math.max(...rows.map((r) => r.p95)),
};
console.log(JSON.stringify(summary));
if (failures.length) console.log("failures:\n  " + [...new Set(failures)].slice(0, 20).join("\n  "));
process.exit(failures.length || submitted < N ? 1 : 0);
