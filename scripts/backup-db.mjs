import "dotenv/config";
import { copyFileSync, mkdirSync, statSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";

function sqlitePathFromUrl(databaseUrl) {
  if (!databaseUrl.startsWith("file:")) {
    throw new Error("backup: DATABASE_URL must use a SQLite file: URL");
  }

  const rawPath = databaseUrl.slice("file:".length);
  return resolve(rawPath.startsWith("./") ? rawPath : rawPath);
}

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("backup: DATABASE_URL is required");
}

const source = sqlitePathFromUrl(databaseUrl);
statSync(source);

const backupDir = resolve(process.env.BACKUP_DIR ?? "backups");
mkdirSync(backupDir, { recursive: true });

const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const target = join(backupDir, `${basename(source)}.${stamp}.bak`);
copyFileSync(source, target);

console.info(JSON.stringify({
  level: "info",
  event: "backup.created",
  source: join(dirname(source), basename(source)),
  target,
  at: new Date().toISOString(),
}));
