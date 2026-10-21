import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { writeAudit } from "@/lib/audit";
import { checkRateLimit, clientIpFromHeaders } from "@/lib/rate-limit";
import { BadRequestError, NotFoundError, RateLimitError, ServiceUnavailableError, UnauthorizedError, withApiErrors } from "@/lib/api-error";
import { callbackTokenConfigured, verifyCallbackToken } from "@/lib/coder-agent-settings";
import { addIssueEvent, getIssueReportForAgent, resolveIssueReport } from "@/lib/issue-report-server";

// Coding agent callback for "Report a problem" (contract: docs/coder-agent-api.md). No user session:
// the agent sends `Authorization: Bearer <callback token>` from Admin → Settings → Coding agent.
//   GET  → the report (target, screenshot base64, resolution)
//   POST { status: "IN_PROGRESS" | "RESOLVED" | "NOTE", message?, ref?, ticketId? }
//        IN_PROGRESS = the agent took it; RESOLVED = fixed ("levantado"): reporter notified, admin emailed.
type Ctx = { params: Promise<{ id: string }> };

async function authorize(req: NextRequest) {
  const limit = checkRateLimit(`agent-callback:${clientIpFromHeaders(req.headers)}`, 60, 60_000);
  if (!limit.allowed) throw new RateLimitError((limit.resetAt - Date.now()) / 1000);
  if (!(await callbackTokenConfigured())) throw new ServiceUnavailableError("The coding agent callback is not set up (Admin → Settings → Coding agent).");
  const header = req.headers.get("authorization") ?? "";
  const token = header.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : null;
  if (!(await verifyCallbackToken(token))) throw new UnauthorizedError("Invalid agent token.");
}

export const GET = withApiErrors(async function GET(req: NextRequest, { params }: Ctx) {
  await authorize(req);
  const { id } = await params;
  const payload = await getIssueReportForAgent(id);
  if (!payload) throw new NotFoundError("Report not found.");
  return NextResponse.json(payload);
});

const STATUSES = new Set(["IN_PROGRESS", "RESOLVED", "NOTE"]);
const text = (v: unknown, max: number) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);

export const POST = withApiErrors(async function POST(req: NextRequest, { params }: Ctx) {
  await authorize(req);
  const { id } = await params;
  const body = (await req.json().catch(() => null)) as { status?: string; message?: unknown; ref?: unknown; ticketId?: unknown } | null;
  if (!body || !STATUSES.has(body.status ?? "")) throw new BadRequestError("status must be IN_PROGRESS, RESOLVED or NOTE.");
  const report = await prisma.issueReport.findUnique({ where: { id }, select: { id: true, status: true } });
  if (!report) throw new NotFoundError("Report not found.");
  const message = text(body.message, 4000);
  const ref = text(body.ref, 1000);
  const ticketId = text(typeof body.ticketId === "number" ? String(body.ticketId) : body.ticketId, 200);
  if (ticketId) await prisma.issueReport.update({ where: { id }, data: { agentTicketId: ticketId } });

  if (body.status === "RESOLVED") {
    await resolveIssueReport({ id, source: "AGENT", note: message, ref });
  } else if (body.status === "IN_PROGRESS") {
    if (report.status !== "RESOLVED") await prisma.issueReport.update({ where: { id }, data: { status: "IN_PROGRESS" } });
    await addIssueEvent(id, "AGENT", "IN_PROGRESS", { message, ref });
  } else {
    await addIssueEvent(id, "AGENT", "NOTE", { message, ref });
  }
  await writeAudit({ action: "ISSUE_REPORT_AGENT_UPDATE", targetType: "IssueReport", targetId: id, metadata: { status: body.status, ref, ticketId } });
  const updated = await prisma.issueReport.findUnique({ where: { id }, select: { status: true, resolvedBySource: true, resolvedAt: true } });
  return NextResponse.json({ ok: true, id, ...updated });
});
