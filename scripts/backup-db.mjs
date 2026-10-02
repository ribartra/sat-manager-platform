// WAL-safe SQLite backup (online backup API: consistent even while the app writes; includes
// whatever is still in the -wal file). Verifies the copy with integrity_check before reporting.
//   npm run db:backup            → ./backups/<db>.<stamp>.bak   (BACKUP_DIR to override)
import "dotenv/config";
import Database from "better-sqlite3";
import { mkdirSync, statSync, unlinkSync } from "node:fs";
import { basename, join, resolve } from "node:path";

function sqlitePathFromUrl(databaseUrl) {
  if (!databaseUrl.startsWith("file:")) {
    throw new Error("backup: DATABASE_URL must use a SQLite file: URL");
  }
  return resolve(databaseUrl.slice("file:".length));
}

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("backup: DATABASE_URL is required");

const source = sqlitePathFromUrl(databaseUrl);
statSync(source);

const backupDir = resolve(process.env.BACKUP_DIR ?? "backups");
mkdirSync(backupDir, { recursive: true });

const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const target = join(backupDir, `${basename(source)}.${stamp}.bak`);

const db = new Database(source, { readonly: true, fileMustExist: true });
db.pragma("busy_timeout = 5000");
await db.backup(target);
db.close();

const copy = new Database(target, { readonly: true });
const integrity = copy.pragma("integrity_check", { simple: true });
copy.close();
if (integrity !== "ok") {
  unlinkSync(target);
  throw new Error(`backup: integrity_check failed on the copy (${integrity}); copy removed`);
}

console.info(JSON.stringify({
  level: "info",
  event: "backup.created",
  source,
  target,
  bytes: statSync(target).size,
  integrity,
  at: new Date().toISOString(),
}));
