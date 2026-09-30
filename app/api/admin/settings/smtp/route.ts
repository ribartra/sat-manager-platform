import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAdmin } from "@/lib/rbac";
import { getSmtpSummary, saveSmtpConfig } from "@/lib/smtp-settings";
import { sendTransactionalEmail } from "@/lib/email";
import { BadRequestError, ForbiddenError, withApiErrors } from "@/lib/api-error";

export const GET = withApiErrors(async function GET() {
  const session = await requireAdmin();
  if (!session) return new ForbiddenError("Forbidden").toResponse();
  return NextResponse.json(await getSmtpSummary());
});

export const PATCH = withApiErrors(async function PATCH(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return new ForbiddenError("Forbidden").toResponse();

  const body = (await req.json().catch(() => ({}))) as {
    host?: string;
    port?: string | number;
    user?: string;
    from?: string;
    password?: string;
  };

  await saveSmtpConfig(body);
  const summary = await getSmtpSummary();

  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: "UPDATE_SMTP_SETTINGS",
      targetType: "AppSetting",
      targetId: "SMTP",
      metadata: JSON.stringify({
        host: summary.host,
        port: summary.port,
        user: summary.user,
        from: summary.from,
        passwordChanged: typeof body.password === "string" && body.password.trim().length > 0,
      }),
    },
  });

  return NextResponse.json(summary);
});

// Send a test email to verify the current SMTP configuration.
export const POST = withApiErrors(async function POST(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return new ForbiddenError("Forbidden").toResponse();

  const body = (await req.json().catch(() => ({}))) as { to?: string };
  const to = typeof body.to === "string" && body.to.trim() ? body.to.trim() : session.user.email;
  if (!to) return new BadRequestError("No recipient available.").toResponse();

  const result = await sendTransactionalEmail({
    to,
    subject: "SAT Practice — SMTP test email",
    text: "This is a test email confirming your SMTP configuration works. If you received it, sending is set up correctly.",
    html: "<p>This is a test email confirming your <strong>SMTP configuration</strong> works.</p><p>If you received it, sending is set up correctly.</p>",
  });

  if (!result.sent) {
    return NextResponse.json(
      { ok: false, reason: result.reason ?? "SEND_FAILED", to },
      { status: result.reason === "SMTP_NOT_CONFIGURED" ? 400 : 502 }
    );
  }
  return NextResponse.json({ ok: true, to });
});
