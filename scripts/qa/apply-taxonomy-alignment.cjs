// Apply the official domain/skill order + names (lib/taxonomy-order.ts) to the DB.
// Self-contained CommonJS so the same file runs locally and inside the prod web container.
//
// Ops JSON (array), each guarded by its expected current value (`old`):
//   {table, id, field, old, new}
// Allowed: Topic.name|domainId, Domain.name, TaxonomyNode.name|label|parentId|sortOrder, PracticeSet.name.
// All-or-nothing: if any guard fails nothing is written. Dry-run unless --apply.
//
// Usage: node apply-taxonomy-alignment.cjs <db> <ops.json> [--apply] [--backup=<rows.json>]
// Local dev.db: stop the Next dev server first (WAL safety) and take a file backup.
/* eslint-disable @typescript-eslint/no-require-imports -- plain CommonJS so it also runs inside the prod container */
const Database = require("better-sqlite3");
const fs = require("node:fs");

const [dbPath, opsPath, ...flags] = process.argv.slice(2);
if (!dbPath || !opsPath) { console.error("usage: <db> <ops.json> [--apply] [--backup=file]"); process.exit(2); }
const apply = flags.includes("--apply");
const backupPath = (flags.find((f) => f.startsWith("--backup=")) || "").slice(9) || null;

const ALLOWED = {
  Topic: ["name", "domainId"],
  Domain: ["name"],
  TaxonomyNode: ["name", "label", "parentId", "sortOrder"],
  PracticeSet: ["name"],
};
const TOUCH_UPDATED_AT = new Set(["TaxonomyNode", "PracticeSet"]);

const ops = JSON.parse(fs.readFileSync(opsPath, "utf8"));
const db = new Database(dbPath);
db.pragma("busy_timeout = 5000");

function check(op) {
  if (!ALLOWED[op.table] || !ALLOWED[op.table].includes(op.field)) throw new Error(`not allowed: ${op.table}.${op.field}`);
}
const current = (op) => {
  check(op);
  const row = db.prepare(`SELECT "${op.field}" AS v FROM "${op.table}" WHERE id = ?`).get(op.id);
  return row ? row.v : undefined;
};

const stale = [];
const already = [];
for (const op of ops) {
  const v = current(op);
  if (v === undefined) stale.push({ op, reason: "row not found" });
  else if (v === op.new && v !== op.old) already.push(op);
  else if (v !== op.old) stale.push({ op, reason: `current differs: ${JSON.stringify(v)}` });
}
console.log(`ops=${ops.length} pending=${ops.length - already.length - stale.length} alreadyApplied=${already.length} stale=${stale.length}`);
for (const s of stale) console.log("STALE", s.op.table, s.op.id, s.op.field, s.reason);
if (stale.length) { console.log("Aborting: guards failed, nothing written."); process.exit(1); }
if (!apply) { console.log("dry-run (pass --apply to write)"); process.exit(0); }

if (backupPath) fs.writeFileSync(backupPath, JSON.stringify(ops.map((o) => ({ ...o, before: current(o) })), null, 1));
const now = new Date().toISOString();
db.transaction(() => {
  for (const op of ops) {
    if (already.includes(op)) continue;
    const touch = TOUCH_UPDATED_AT.has(op.table) ? `, updatedAt = ?` : "";
    const args = TOUCH_UPDATED_AT.has(op.table) ? [op.new, now, op.id, op.old] : [op.new, op.id, op.old];
    const info = db.prepare(`UPDATE "${op.table}" SET "${op.field}" = ?${touch} WHERE id = ? AND "${op.field}" IS ?`).run(...args);
    if (info.changes !== 1) throw new Error(`guarded update changed ${info.changes} rows: ${op.table} ${op.id} ${op.field}`);
  }
})();
db.pragma("wal_checkpoint(TRUNCATE)");
console.log("applied; integrity:", db.pragma("integrity_check", { simple: true }));
db.close();
