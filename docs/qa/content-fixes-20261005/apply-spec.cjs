/* eslint-disable @typescript-eslint/no-require-imports */ // run from the repo root: node docs/qa/content-fixes-20261005/<file>
// Guarded content fixes from a spec. Usage: node apply-spec.cjs <db> <spec.json> [--apply]
const Database = require(process.env.BSQ || "better-sqlite3");
const ops = JSON.parse(require("fs").readFileSync(process.argv[3], "utf8"));
const db = new Database(process.argv[2]);
db.pragma("busy_timeout = 5000");
const apply = process.argv.includes("--apply");
const now = new Date().toISOString();
const counts = {};
db.transaction(() => {
  for (const op of ops) {
    if (!["Question", "QuestionOption"].includes(op.table) || !["stem", "stimulus", "explanation", "text", "imageUrl"].includes(op.field)) throw new Error("bad op");
    const row = db.prepare(`select "${op.field}" v from "${op.table}" where id = ?`).get(op.id);
    const state = !row ? "MISSING" : row.v === op.after ? "ALREADY" : row.v === op.before ? "PENDING" : "DRIFT";
    if (apply && state === "PENDING") {
      const n = db.prepare(`update "${op.table}" set "${op.field}" = ? where id = ? and "${op.field}" IS ?`).run(op.after, op.id, op.before).changes;
      if (n !== 1) throw new Error("guard failed " + op.id);
      const qid = op.table === "Question" ? op.id : db.prepare("select questionId q from QuestionOption where id = ?").get(op.id).q;
      db.prepare("update Question set updatedAt = ? where id = ?").run(now, qid);
    }
    counts[state] = (counts[state] || 0) + 1;
    if (state !== "PENDING" && state !== "ALREADY") console.log(state, op.table, op.id, op.field, op.note);
  }
})();
console.log(JSON.stringify({ mode: apply ? "apply" : "dry-run", ops: ops.length, ...counts }));
if (apply) console.log("integrity", db.pragma("integrity_check", { simple: true }));
