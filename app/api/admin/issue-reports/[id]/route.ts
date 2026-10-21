import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { assertAdmin } from "@/lib/rbac";
import { BadRequestError, NotFoundError, ServiceUnavailableError, withApiErrors } from "@/lib/api-error";
import { emailIssueReport } from "@/lib/issue-report-server";

type Ctx = { params: Promise<{ id: string }> };

// PATCH /api/admin/issue-reports/[id] — { status: "OPEN" | "RESOLVED" }
export const PATCH = withApiErrors(async function PATCH(req: NextRequest, { params }: Ctx) {
  const session = await assertAdmin();
  const { id } = await params;
  const body = (await req.json().catch(() => null)) as { status?: string } | null;
  if (body?.status !== "OPEN" && body?.status !== "RESOLVED") throw new BadRequestError("Status must be OPEN or RESOLVED.");
  const exists = await prisma.issueReport.findUnique({ where: { id }, select: { id: true } });
  if (!exists) throw new NotFoundError("Report not found.");
  const resolved = body.status === "RESOLVED";
  await prisma.issueReport.update({
    where: { id },
    data: { status: body.status, resolvedAt: resolved ? new Date() : null, resolvedById: resolved ? session.user.id : null },
  });
  return NextResponse.json({ ok: true });
});

// POST /api/admin/issue-reports/[id] — resend the email
export const POST = withApiErrors(async function POST(_req: NextRequest, { params }: Ctx) {
  await assertAdmin();
  const { id } = await params;
  const result = await emailIssueReport(id);
  if (!result.sent && result.reason === "NOT_FOUND") throw new NotFoundError("Report not found.");
  if (!result.sent) throw new ServiceUnavailableError(result.reason === "SMTP_NOT_CONFIGURED" ? "Email is not set up (Admin → Settings)." : "The email could not be sent. Try again.");
  return NextResponse.json({ ok: true });
});
