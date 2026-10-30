#!/usr/bin/env node
// One-off: rewrite existing account names (User.name) and pending invitation names
// (InviteToken.name / parentName) as "First Last", the rule lib/person-name.ts applies on every
// create / edit. Dry run by default (prints the changes); `--apply` writes them in one transaction.
//
//   node scripts/normalize-person-names.mjs <path/to/dev.db> [--apply]
//
// Same rules as formatPersonName in lib/person-name.ts (kept in sync by hand: this runs with plain
// node inside the production container, which has no TypeScript runner). Names that look like an
// email (a parent created without a name) are left as they are.
import Database from "better-sqlite3";

const PARTICLES = new Set(["de", "del", "la", "las", "los", "y", "e", "da", "do", "dos"]);
const capitalize = (part) => (part ? part.charAt(0).toLocaleUpperCase("es") + part.slice(1).toLocaleLowerCase("es") : part);
function formatPersonName(raw) {
  const words = raw.trim().replace(/\s+/g, " ").split(" ").filter(Boolean);
  // A short all-caps word in a name that is not all caps is an acronym ("SAT Teacher", "QA Admin").
  const allCaps = words.join("") === words.join("").toLocaleUpperCase("es");
  return words
    .map((word, index) => {
      const lower = word.toLocaleLowerCase("es");
      if (index > 0 && index < words.length - 1 && PARTICLES.has(lower)) return lower;
      if (!allCaps && word.length <= 3 && /^\p{Lu}+$/u.test(word)) return word;
      return word
        .split(/([-'’])/)
        .map((part) => (/^[-'’]$/.test(part) ? part : capitalize(part)))
        .join("");
    })
    .join(" ");
}

const [dbPath, flag] = process.argv.slice(2);
if (!dbPath) {
  console.error("Usage: node scripts/normalize-person-names.mjs <db> [--apply]");
  process.exit(1);
}
const apply = flag === "--apply";
const db = new Database(dbPath);
db.pragma("busy_timeout = 5000");

const changes = [];
const plan = (table, column, rows) => {
  for (const row of rows) {
    const value = row[column];
    if (!value || value.includes("@")) continue;
    const next = formatPersonName(value);
    if (next && next !== value) changes.push({ table, column, id: row.id, from: value, to: next });
  }
};
plan("User", "name", db.prepare("SELECT id, name FROM User").all());
plan("InviteToken", "name", db.prepare("SELECT id, name FROM InviteToken WHERE usedAt IS NULL").all());
plan("InviteToken", "parentName", db.prepare("SELECT id, parentName FROM InviteToken WHERE usedAt IS NULL AND parentName IS NOT NULL").all());

for (const c of changes) console.log(`${c.table}.${c.column} ${c.id}: ${JSON.stringify(c.from)} -> ${JSON.stringify(c.to)}`);
console.log(`${changes.length} change(s)${apply ? "" : " (dry run; pass --apply to write)"}`);

if (apply && changes.length) {
  const write = db.transaction(() => {
    for (const c of changes) db.prepare(`UPDATE "${c.table}" SET "${c.column}" = ? WHERE id = ?`).run(c.to, c.id);
  });
  write();
  console.log("applied");
}
db.close();
