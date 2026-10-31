// Compares two SQLite databases (read-only): schema, applied migrations, applied data patches, row
// counts of every table and a content hash of the bank/configuration tables. Used by
// `make db-compare` (production copy vs local dev.db). Exit 1 when they differ.
//   node scripts/compare-db.mjs <reference.db> <other.db>
import Database from "better-sqlite3";
import { createHash } from "node:crypto";

const [refPath, otherPath] = process.argv.slice(2);
if (!refPath || !otherPath) {
  console.error("usage: compare-db.mjs <reference.db> <other.db>");
  process.exit(2);
}

// Content that must be identical (the bank and its configuration). Activity tables (attempts,
// notifications, audit…) are compared by row count only.
const CONTENT_TABLES = [
  "Section", "Domain", "Topic", "Subskill", "TaxonomyNode", "Source", "Program",
  "Question", "QuestionOption", "PracticeSet", "PracticeSetQuestion",
  "FullPracticeTest", "FullPracticeTestModule", "FullPracticeTestQuestion", "FullPracticeTestScoreConversion",
  "AppSetting",
];
// Encrypted settings are removed from local copies (production key), see pull-db-from-prod.sh.
const IGNORED_SETTING = /_ENCRYPTED$/;

function describe(path) {
  const db = new Database(path, { readonly: true, fileMustExist: true });
  const normalize = (sql) => (sql ?? "").replace(/\s+/g, " ").trim();
  const schema = new Map(
    db.prepare("SELECT type || ' ' || name AS id, sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' AND sql IS NOT NULL").all()
      .map((row) => [row.id, normalize(row.sql)]),
  );
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'").all().map((row) => row.name);
  const counts = new Map(tables.map((table) => [table, db.prepare(`SELECT count(*) AS n FROM "${table}"`).get().n]));
  const migrations = tables.includes("_prisma_migrations")
    ? db.prepare("SELECT migration_name FROM _prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL ORDER BY 1").all().map((row) => row.migration_name)
    : [];
  const patches = tables.includes("AppSetting")
    ? db.prepare("SELECT key FROM AppSetting WHERE key LIKE 'DATA_PATCH:%' ORDER BY 1").all().map((row) => row.key.slice(11))
    : [];
  const hashes = new Map();
  for (const table of CONTENT_TABLES.filter((name) => tables.includes(name))) {
    const keys = db.prepare(`SELECT name FROM pragma_table_info('${table}') WHERE pk > 0 ORDER BY pk`).all().map((row) => `"${row.name}"`);
    const hash = createHash("sha256");
    for (const row of db.prepare(`SELECT * FROM "${table}" ORDER BY ${keys.length ? keys.join(", ") : "rowid"}`).iterate()) {
      if (table === "AppSetting" && IGNORED_SETTING.test(row.key)) continue;
      // updatedAt is bookkeeping (a re-save with the same values changes it): not content.
      const { updatedAt: _updatedAt, ...content } = row;
      void _updatedAt;
      hash.update(JSON.stringify(content, (_key, value) => (Buffer.isBuffer(value) ? value.toString("base64") : value)));
      hash.update("\n");
    }
    hashes.set(table, hash.digest("hex").slice(0, 16));
  }
  db.close();
  return { schema, counts, migrations, patches, hashes };
}

const ref = describe(refPath);
const other = describe(otherPath);
const differences = [];
const listDiff = (label, a, b) => {
  const onlyRef = a.filter((item) => !b.includes(item));
  const onlyOther = b.filter((item) => !a.includes(item));
  if (onlyRef.length) differences.push(`${label} only in reference: ${onlyRef.join(", ")}`);
  if (onlyOther.length) differences.push(`${label} only in other: ${onlyOther.join(", ")}`);
};

listDiff("migrations", ref.migrations, other.migrations);
listDiff("data patches", ref.patches, other.patches);
for (const id of new Set([...ref.schema.keys(), ...other.schema.keys()])) {
  if (ref.schema.get(id) !== other.schema.get(id)) differences.push(`schema differs: ${id}`);
}
for (const table of new Set([...ref.counts.keys(), ...other.counts.keys()])) {
  if (ref.counts.get(table) !== other.counts.get(table)) differences.push(`rows ${table}: ${ref.counts.get(table) ?? "-"} vs ${other.counts.get(table) ?? "-"}`);
}
for (const table of CONTENT_TABLES) {
  if (ref.hashes.get(table) !== other.hashes.get(table)) differences.push(`content ${table}: ${ref.hashes.get(table) ?? "-"} vs ${other.hashes.get(table) ?? "-"}`);
}

console.log(`reference: ${refPath}\nother:     ${otherPath}`);
console.log(`migrations ${ref.migrations.length}/${other.migrations.length}, data patches ${ref.patches.length}/${other.patches.length}, tables ${ref.counts.size}/${other.counts.size}`);
if (differences.length === 0) {
  console.log("IDENTICAL (schema, migrations, data patches, row counts, content of the bank tables)");
  process.exit(0);
}
console.log(`${differences.length} difference(s):`);
for (const line of differences) console.log(`  - ${line}`);
process.exit(1);
