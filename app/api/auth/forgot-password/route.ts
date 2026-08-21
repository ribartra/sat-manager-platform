import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { absoluteAppUrl, sendPasswordResetEmail } from "@/lib/email";
import { checkRateLimit, rateLimitKey, rateLimitResponse } from "@/lib/rate-limit";
import { hashPublicToken, newPublicToken } from "@/lib/token-security";
import { captureCaughtError, writeAudit } from "@/lib/audit";

export async function POST(req: NextRequest) {
  const { email } = await req.json();
  if (!email) return NextResponse.json({ ok: true }); // silent
  const limited = checkRateLimit(rateLimitKey(req, "forgot-password", email), 5, 15 * 60 * 1000);
  if (!limited.allowed) return rateLimitResponse(limited.resetAt);

  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      await writeAudit({
        action: "PASSWORD_RESET_REQUESTED",
        targetType: "User",
        targetId: email,
        outcome: "info",
        metadata: { email, found: false },
      });
      return NextResponse.json({ ok: true }); // don't leak existence
    }

    const token = newPublicToken();
    const tokenHash = hashPublicToken(token);
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60); // 1 hour

    await prisma.passwordResetToken.create({
      data: { userId: user.id, token: `hashed:${tokenHash}`, tokenHash, expiresAt },
    });

    const resetUrl = absoluteAppUrl(`/auth/reset-password?token=${token}`);
    const emailResult = await sendPasswordResetEmail(email, user.name, resetUrl);

    await writeAudit({
      userId: user.id,
      action: "PASSWORD_RESET_REQUESTED",
      targetType: "User",
      targetId: user.id,
      outcome: emailResult.sent ? "success" : "failure",
      metadata: { email, emailSent: emailResult.sent, reason: emailResult.sent ? undefined : emailResult.reason },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    await captureCaughtError("auth.forgot-password", error, { metadata: { email } });
    return NextResponse.json({ ok: true });
  }
}
