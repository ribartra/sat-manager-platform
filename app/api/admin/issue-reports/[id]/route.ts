import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { assertAdmin } from "@/lib/rbac";
import { BadRequestError, NotFoundError, ServiceUnavailableError, withApiErrors } from "@/lib/api-error";
import { emailIssueReport, reopenIssueReport, resolveIssueReport, sendIssueReportToAgent } from "@/lib/issue-report-server";

type Ctx = { params: Promise<{ id: string }> };

async function exists(id: string) {
  const report = await prisma.issueReport.findUnique({ where: { id }, select: { id: true } });
  if (!report) throw new NotFoundError("Report not found.");
}

// PATCH /api/admin/issue-reports/[id] — { status: "RESOLVED", note?, ref? } (fixed by an admin) | { status: "OPEN" } (reopen)
export const PATCH = withApiErrors(async function PATCH(req: NextRequest, { params }: Ctx) {
  const session = await assertAdmin();
  const { id } = await params;
  const body = (await req.json().catch(() => null)) as { status?: string; note?: string; ref?: string } | null;
  if (body?.status !== "OPEN" && body?.status !== "RESOLVED") throw new BadRequestError("Status must be OPEN or RESOLVED.");
  await exists(id);
  if (body.status === "RESOLVED") await resolveIssueReport({ id, source: "ADMIN", userId: session.user.id, note: body.note, ref: body.ref });
  else await reopenIssueReport(id, "ADMIN", session.user.id, body.note);
  return NextResponse.json({ ok: true });
});

// POST /api/admin/issue-reports/[id] — { action: "email" } resend the email | { action: "agent" } send to the coding agent
export const POST = withApiErrors(async function POST(req: NextRequest, { params }: Ctx) {
  await assertAdmin();
  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as { action?: string };
  await exists(id);
  if (body.action === "agent") {
    const result = await sendIssueReportToAgent(id);
    if (result.reason === "DISABLED") throw new BadRequestError("Set the coding agent URL in Admin → Settings first.");
    if (!result.sent) throw new ServiceUnavailableError(`The coding agent did not accept it (${result.reason}).`);
    return NextResponse.json({ ok: true });
  }
  const result = await emailIssueReport(id);
  if (!result.sent) throw new ServiceUnavailableError(result.reason === "SMTP_NOT_CONFIGURED" ? "Email is not set up (Admin → Settings)." : "The email could not be sent. Try again.");
  return NextResponse.json({ ok: true });
});
