// Applies the pending DATA patches in prisma/data-patches/ (data only; the schema changes only with
// Prisma migrations). Each patch runs once, in its own transaction, and is recorded in AppSetting
// (key DATA_PATCH:<file>, value {sha256, appliedAt, rows}), so no table or migration is added.
//
// Runs from deploy/vm/web-entrypoint.sh after `migrate deploy`, before the server starts (no
// concurrent writers): every deploy applies what is pending, and a failure stops the container, so
// deploy.sh rolls back to the previous TAG (its pre-deploy DB copy undoes nothing that did not commit).
// Locally the same file and runner: `npm run db:patch` (local == production + what is pending).
//
//   node scripts/apply-data-patches.mjs            apply pending patches
//   node scripts/apply-data-patches.mjs --status   applied / pending / changed after applying
//   node scripts/apply-data-patches.mjs --dry      run pending patches and roll back (row counts only)
//
// Patch files (sorted by name): YYYYMMDDHHMM_<name>.sql | .mjs
//   .sql  plain DML (UPDATE / INSERT / DELETE); DDL and transaction statements are rejected.
//         Optional guard: a line `-- expect: <n>` = rows changed (SQLite total_changes, which also
//         counts rows changed by triggers). Any other count rolls the patch back and fails.
//   .mjs  `export default function (db) { ...; return rowsChanged }` (synchronous, better-sqlite3),
//         optional `export const expect = <n>`.
// An applied patch must never be edited (its checksum is checked): fix it with a new patch.
import Database from "better-sqlite3";
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const url = process.env.DATABASE_URL ?? "file:./dev.db";
const file = url.replace(/^file:/, "");
const dir = resolve(process.env.PATCHES_DIR ?? "prisma/data-patches");
const mode = process.argv.includes("--status") ? "status" : process.argv.includes("--dry") ? "dry" : "apply";
const NAME = /^\d{12}_[a-z0-9][a-z0-9_-]*\.(sql|mjs)$/;
// Statements a .sql patch may contain (checked after removing comments and string literals, so
// content text such as 'Drop the …' is never mistaken for a statement).
const DATA_STATEMENT = /^(UPDATE|INSERT|DELETE|REPLACE|WITH|SELECT)\b/i;

const log = (message) => console.log(`[data-patches] ${message}`);
const fail = (message) => {
  console.error(`[data-patches] ERROR: ${message}`);
  process.exit(1);
};

const db = new Database(file);
db.pragma("busy_timeout = 5000");
if (!db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'AppSetting'").get()) {
  log("no AppSetting table (empty database); skipped");
  process.exit(0);
}

const patches = existsSync(dir)
  ? readdirSync(dir)
      .filter((name) => NAME.test(name))
      .sort()
      .map((name) => {
        const source = readFileSync(join(dir, name));
        return { name, path: join(dir, name), source, sha256: createHash("sha256").update(source).digest("hex") };
      })
  : [];
const ledgerKey = (name) => `DATA_PATCH:${name}`;
const readLedger = db.prepare("SELECT value FROM AppSetting WHERE key = ?");
const writeLedger = db.prepare('INSERT INTO AppSetting ("key", "value", "updatedAt") VALUES (?, ?, ?)');
const totalChanges = db.prepare("SELECT total_changes() AS n");
const now = () => new Date().toISOString().replace("Z", "+00:00");

const applied = new Map();
for (const patch of patches) {
  const row = readLedger.get(ledgerKey(patch.name));
  if (row) applied.set(patch.name, JSON.parse(row.value));
}
const changed = patches.filter((patch) => applied.has(patch.name) && applied.get(patch.name).sha256 !== patch.sha256);
const pending = patches.filter((patch) => !applied.has(patch.name));

if (mode === "status") {
  for (const patch of patches) {
    const entry = applied.get(patch.name);
    const state = !entry ? "pending" : entry.sha256 !== patch.sha256 ? "CHANGED AFTER APPLYING" : `applied ${entry.appliedAt} (${entry.rows} rows)`;
    console.log(`${patch.name}\t${state}`);
  }
  log(`${patches.length} patches: ${patches.length - pending.length} applied, ${pending.length} pending, ${changed.length} changed`);
  process.exit(changed.length ? 1 : 0);
}

if (changed.length) fail(`applied patch(es) edited afterwards: ${changed.map((p) => p.name).join(", ")} (patches are immutable: add a new one)`);
if (pending.length === 0) {
  log("nothing pending");
  process.exit(0);
}

async function run(patch) {
  let expect = null;
  let work;
  if (patch.name.endsWith(".sql")) {
    const sql = patch.source.toString("utf8");
    const code = sql.replace(/'(?:[^']|'')*'/g, "''").replace(/--[^\n]*/g, "").replace(/\/\*[\s\S]*?\*\//g, "");
    const statements = code.split(";").map((statement) => statement.trim()).filter(Boolean);
    const invalid = statements.find((statement) => !DATA_STATEMENT.test(statement));
    if (invalid) throw new Error(`only data statements are allowed (schema changes go in a Prisma migration): "${invalid.slice(0, 60)}"`);
    const declared = sql.match(/^--\s*expect:\s*(\d+)\s*$/m);
    expect = declared ? Number(declared[1]) : null;
    work = () => db.exec(sql);
  } else {
    const patchModule = await import(pathToFileURL(patch.path).href);
    if (typeof patchModule.default !== "function") throw new Error("a .mjs patch must export default function (db)");
    expect = Number.isInteger(patchModule.expect) ? patchModule.expect : null;
    work = () => {
      const result = patchModule.default(db);
      if (result && typeof result.then === "function") throw new Error("a .mjs patch must be synchronous (better-sqlite3)");
    };
  }

  db.exec("BEGIN IMMEDIATE");
  try {
    const before = totalChanges.get().n;
    work();
    const rows = totalChanges.get().n - before;
    if (expect !== null && rows !== expect) throw new Error(`expected ${expect} rows changed, got ${rows}`);
    if (mode === "dry") {
      db.exec("ROLLBACK");
      log(`${patch.name}: ${rows} rows (dry run, rolled back)`);
      return;
    }
    writeLedger.run(ledgerKey(patch.name), JSON.stringify({ sha256: patch.sha256, appliedAt: new Date().toISOString(), rows }), now());
    db.exec("COMMIT");
    log(`${patch.name}: applied (${rows} rows)`);
  } catch (error) {
    if (db.inTransaction) db.exec("ROLLBACK");
    throw error;
  }
}

for (const patch of pending) {
  try {
    await run(patch);
  } catch (error) {
    fail(`${patch.name}: ${error.message} - rolled back, nothing from it was written`);
  }
}
if (mode === "apply" && db.pragma("quick_check", { simple: true }) !== "ok") fail("quick_check failed after applying patches");
log(mode === "dry" ? `${pending.length} pending patch(es) checked` : `${pending.length} patch(es) applied`);
