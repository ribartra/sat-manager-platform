// Restore a SQLite backup over DATABASE_URL. STOP the app (dev server / web container) first:
// replacing the file under a running process corrupts it. Keeps a WAL-safe safety copy of the
// current DB, verifies the backup, and removes stale -wal/-shm files so they are not replayed
// on top of the restored file.
//   BACKUP_FILE=backups/dev.db.<stamp>.bak npm run db:restore
import "dotenv/config";
import Database from "better-sqlite3";
import { copyFileSync, existsSync, mkdirSync, rmSync, statSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";

function sqlitePathFromUrl(databaseUrl) {
  if (!databaseUrl.startsWith("file:")) {
    throw new Error("restore: DATABASE_URL must use a SQLite file: URL");
  }
  return resolve(databaseUrl.slice("file:".length));
}

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("restore: DATABASE_URL is required");

const backupFile = process.env.BACKUP_FILE;
if (!backupFile) throw new Error("restore: BACKUP_FILE is required");

const source = resolve(backupFile);
statSync(source);
const check = new Database(source, { readonly: true });
const integrity = check.pragma("integrity_check", { simple: true });
check.close();
if (integrity !== "ok") throw new Error(`restore: backup failed integrity_check (${integrity})`);

const target = sqlitePathFromUrl(databaseUrl);
mkdirSync(dirname(target), { recursive: true });

let safetyCopy = null;
if (existsSync(target)) {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  safetyCopy = join(dirname(target), `${basename(target)}.pre-restore.${stamp}.bak`);
  const current = new Database(target, { readonly: true });
  await current.backup(safetyCopy); // includes un-checkpointed WAL pages
  current.close();
}

for (const suffix of ["-wal", "-shm"]) rmSync(`${target}${suffix}`, { force: true });
copyFileSync(source, target);

console.info(JSON.stringify({
  level: "info",
  event: "backup.restored",
  source,
  target,
  safetyCopy,
  integrity,
  at: new Date().toISOString(),
}));
