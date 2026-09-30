import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { internalIngestToken } from "@/lib/internal-ingest";
import { generateDeadlineNotifications } from "@/lib/deadline-notifications";

// Scheduled deadline reminders (RF-42). Called hourly by the VM cron from inside the web
// container (http://localhost:3000), authenticated with the internal service token. Caddy does
// not expose /api/internal/* publicly. Safe to re-run: reminders are deduplicated.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function authorized(req: Request) {
  const header = req.headers.get("authorization") ?? "";
  const provided = Buffer.from(header.startsWith("Bearer ") ? header.slice(7) : "");
  const expected = Buffer.from(internalIngestToken());
  return provided.length === expected.length && timingSafeEqual(provided, expected);
}

export async function POST(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const summary = await generateDeadlineNotifications();
  console.info(JSON.stringify({ level: "info", event: "notifications.generated", ...summary }));
  return NextResponse.json(summary);
}
