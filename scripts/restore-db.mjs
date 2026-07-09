import "dotenv/config";
import { copyFileSync, existsSync, mkdirSync, statSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";

function sqlitePathFromUrl(databaseUrl) {
  if (!databaseUrl.startsWith("file:")) {
    throw new Error("restore: DATABASE_URL must use a SQLite file: URL");
  }

  const rawPath = databaseUrl.slice("file:".length);
  return resolve(rawPath.startsWith("./") ? rawPath : rawPath);
}

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("restore: DATABASE_URL is required");

const backupFile = process.env.BACKUP_FILE;
if (!backupFile) throw new Error("restore: BACKUP_FILE is required");

const source = resolve(backupFile);
statSync(source);

const target = sqlitePathFromUrl(databaseUrl);
mkdirSync(dirname(target), { recursive: true });

let safetyCopy = null;
if (existsSync(target)) {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  safetyCopy = join(dirname(target), `${basename(target)}.pre-restore.${stamp}.bak`);
  copyFileSync(target, safetyCopy);
}

copyFileSync(source, target);

console.info(JSON.stringify({
  level: "info",
  event: "backup.restored",
  source,
  target,
  safetyCopy,
  at: new Date().toISOString(),
}));
