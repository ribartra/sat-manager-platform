import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { checkRateLimit, rateLimitKey, rateLimitResponse } from "@/lib/rate-limit";
import { hashPublicToken } from "@/lib/token-security";
import { captureCaughtError, writeAudit } from "@/lib/audit";

export async function POST(req: NextRequest) {
  const { token, password } = await req.json();
  if (!token || !password) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
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
      return NextResponse.json({ error: "This link is invalid or has expired." }, { status: 400 });
    }
    if (!reset.tokenHash) {
      await prisma.passwordResetToken.update({ where: { id: reset.id }, data: { tokenHash, token: `hashed:${tokenHash}` } });
    }

    const hash = await bcrypt.hash(password, 10);
    await prisma.$transaction([
      prisma.user.update({ where: { id: reset.userId }, data: { passwordHash: hash } }),
      prisma.passwordResetToken.update({ where: { id: reset.id }, data: { usedAt: new Date() } }),
    ]);

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
    return NextResponse.json({ error: "Password reset failed." }, { status: 500 });
  }
}
