#!/usr/bin/env node
// Build a clean, usable PRODUCTION database from scratch.
//
// Why not `prisma migrate deploy`? The migration chain is not replayable from an
// empty DB: the 20260804 taxonomy migrations are data-patches that reference base
// Domains (dom-algebra, …) which no migration creates — only the seed does. So we
// materialize the current schema directly from schema.prisma (via the read-only
// `migrate diff`, applied with better-sqlite3 — no `db push` AI-consent prompt),
// mark every migration as applied so the app's boot-time `migrate deploy` is a
// no-op, then seed production data (taxonomy + score tables + settings + admin).
//
// Usage:
//   DATABASE_URL="file:./prisma/prod.db" npm run db:init:prod
//   (admin password: see prisma/seed.prod.ts — written to .secrets/, gitignored)
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const Database = require("better-sqlite3");

const DB_URL = process.env.DATABASE_URL ?? "file:./prisma/prod.db";
const env = { ...process.env, DATABASE_URL: DB_URL };
const dbPath = DB_URL.replace(/^file:/, "");

function npx(args, opts = {}) {
  return execFileSync("npx", args, { env, ...opts });
}

console.log(`\n▶  Inicializando DB de producción → ${DB_URL}\n`);

if (fs.existsSync(dbPath) && fs.statSync(dbPath).size > 0) {
  console.error(`✗  ${dbPath} ya existe y no está vacío. Borra el archivo o usa otra ruta (DATABASE_URL).`);
  process.exit(1);
}

// 1) Materialize the current schema.prisma into SQL (read-only) and apply it.
console.log("▶  Generando schema desde prisma/schema.prisma (migrate diff)…");
const schemaSql = npx(
  ["prisma", "migrate", "diff", "--from-empty", "--to-schema", "prisma/schema.prisma", "--script"],
  { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 }
);
fs.mkdirSync(path.dirname(path.resolve(dbPath)), { recursive: true });
const db = new Database(dbPath);
db.exec(schemaSql);
db.close();
console.log("   schema aplicado.");

// 2) Record every migration as applied so `prisma migrate deploy` at container
//    boot is a clean no-op (a future new migration still applies normally).
const migDir = path.resolve("prisma/migrations");
const migrations = fs
  .readdirSync(migDir)
  .filter((n) => fs.existsSync(path.join(migDir, n, "migration.sql")))
  .sort();
console.log(`\n▶  Marcando ${migrations.length} migraciones como aplicadas (baseline)…`);
for (const name of migrations) {
  npx(["prisma", "migrate", "resolve", "--applied", name], { stdio: "ignore" });
}
console.log("   baseline registrado.");

// 3) Seed production data (no demo users/questions).
console.log("\n▶  Sembrando datos de producción (seed.prod)…");
npx(["tsx", "prisma/seed.prod.ts"], { stdio: "inherit" });

console.log("\n✅  DB de producción lista y usable.");
console.log(`    Archivo: ${dbPath}`);
console.log("    Para embarcarla como seed del despliegue: subirla a gs://<bucket>/seed/dev.db\n");
