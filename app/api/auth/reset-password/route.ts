import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { checkRateLimit, rateLimitKey, rateLimitResponse } from "@/lib/rate-limit";
import { hashPublicToken } from "@/lib/token-security";
import { captureCaughtError, writeAudit } from "@/lib/audit";
import { passwordPolicyError } from "@/lib/password-policy";
import { forgetSessionState } from "@/lib/session-state";
import { BadRequestError, InternalServerError, withApiErrors } from "@/lib/api-error";

export const POST = withApiErrors(async function POST(req: NextRequest) {
  const { token, password } = await req.json();
  if (!token || !password) return new BadRequestError("Something is missing. Please fill in the form again.").toResponse();
  const limited = checkRateLimit(rateLimitKey(req, "reset-password", token.slice(0, 12)), 10, 15 * 60 * 1000);
  if (!limited.allowed) return rateLimitResponse(limited.resetAt);

  try {
    const tokenHash = hashPublicToken(token);
    const reset = await prisma.passwordResetToken.findFirst({ where: { OR: [{ tokenHash }, { token }] } });
    if (!reset || reset.usedAt || reset.expiresAt < new Date()) {
      await writeAudit({
        action: "PASSWORD_RESET_FAILED",
        targetType: "PasswordResetToken",
        targetId: reset?.id ?? token.slice(0, 12),
        outcome: "failure",
        metadata: {
          reason: !reset ? "not_found" : reset.usedAt ? "already_used" : "expired",
        },
      });
      return new BadRequestError("This link doesn't work or has expired. Ask for a new reset link.").toResponse();
    }
    if (!reset.tokenHash) {
      await prisma.passwordResetToken.update({ where: { id: reset.id }, data: { tokenHash, token: `hashed:${tokenHash}` } });
    }

    const account = await prisma.user.findUnique({ where: { id: reset.userId }, select: { email: true } });
    const policyError = passwordPolicyError(password, account?.email);
    if (policyError) return new BadRequestError(policyError).toResponse();

    const hash = await bcrypt.hash(password, 10);
    // A reset signs the account out on every device (sessionVersion bump).
    await prisma.$transaction([
      prisma.user.update({ where: { id: reset.userId }, data: { passwordHash: hash, sessionVersion: { increment: 1 } } }),
      prisma.passwordResetToken.update({ where: { id: reset.id }, data: { usedAt: new Date() } }),
    ]);

    forgetSessionState(reset.userId);
    await writeAudit({
      userId: reset.userId,
      action: "PASSWORD_RESET_COMPLETED",
      targetType: "User",
      targetId: reset.userId,
      outcome: "success",
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    await captureCaughtError("auth.reset-password", error, {
      metadata: { tokenPrefix: String(token).slice(0, 8) },
    });
    return new InternalServerError("We couldn't reset your password. Please try again.").toResponse();
  }
});
