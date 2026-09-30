import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { internalIngestToken } from "@/lib/internal-ingest";
import { generateDeadlineNotifications } from "@/lib/deadline-notifications";
import { pruneAuditLog } from "@/lib/audit-retention";
import { UnauthorizedError, withApiErrors } from "@/lib/api-error";

// Scheduled deadline reminders (RF-42). Called hourly by the VM cron from inside the web
// container (http://localhost:3000), authenticated with the internal service token. Caddy does
// not expose /api/internal/* publicly. Safe to re-run: reminders are deduplicated.
// The same call applies the audit-log retention (RNF-12).
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function authorized(req: Request) {
  const header = req.headers.get("authorization") ?? "";
  const provided = Buffer.from(header.startsWith("Bearer ") ? header.slice(7) : "");
  const expected = Buffer.from(internalIngestToken());
  return provided.length === expected.length && timingSafeEqual(provided, expected);
}

export const POST = withApiErrors(async function POST(req: Request) {
  if (!authorized(req)) return new UnauthorizedError("Unauthorized").toResponse();
  const summary = { ...(await generateDeadlineNotifications()), auditPruned: await pruneAuditLog() };
  console.info(JSON.stringify({ level: "info", event: "notifications.generated", ...summary }));
  return NextResponse.json(summary);
});
