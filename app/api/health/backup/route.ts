import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { withApiErrors } from "@/lib/api-error";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Backups run every 6 h; two missed runs (plus slack) means the backup is broken. */
const MAX_AGE_HOURS = 13;

function statusFile() {
  if (process.env.BACKUP_STATUS_FILE) return process.env.BACKUP_STATUS_FILE;
  const dbUrl = process.env.DATABASE_URL ?? "file:./dev.db";
  return path.join(path.dirname(path.resolve(dbUrl.replace(/^file:/, ""))), "backup-status.json");
}

// Backup freshness probe for the Cloud Monitoring uptime check (RNF-15): 200 while the last
// successful backup (deploy/sat-db-backup.sh → backup-status.json) is recent, 503 when it is
// stale or missing. Separate from /api/health so a backup problem never restarts the container.
// Public on purpose: returns only the age, no file names or locations.
export const GET = withApiErrors(async function GET() {
  let lastSuccessAt: Date | null = null;
  try {
    const status = JSON.parse(await readFile(statusFile(), "utf8")) as { lastSuccessAt?: string };
    lastSuccessAt = status.lastSuccessAt ? new Date(status.lastSuccessAt) : null;
  } catch {
    lastSuccessAt = null;
  }
  if (!lastSuccessAt || Number.isNaN(lastSuccessAt.getTime())) {
    return NextResponse.json({ status: "error", backup: "missing" }, { status: 503 });
  }
  const ageHours = Math.round(((Date.now() - lastSuccessAt.getTime()) / 36e5) * 10) / 10;
  const fresh = ageHours <= MAX_AGE_HOURS;
  return NextResponse.json(
    { status: fresh ? "ok" : "error", backup: fresh ? "fresh" : "stale", ageHours, maxAgeHours: MAX_AGE_HOURS },
    { status: fresh ? 200 : 503 },
  );
});
