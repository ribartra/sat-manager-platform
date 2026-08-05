import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { absoluteAppUrl, sendPasswordResetEmail } from "@/lib/email";
import { checkRateLimit, rateLimitKey, rateLimitResponse } from "@/lib/rate-limit";
import { hashPublicToken, newPublicToken } from "@/lib/token-security";

export async function POST(req: NextRequest) {
  const { email } = await req.json();
  if (!email) return NextResponse.json({ ok: true }); // silent
  const limited = checkRateLimit(rateLimitKey(req, "forgot-password", email), 5, 15 * 60 * 1000);
  if (!limited.allowed) return rateLimitResponse(limited.resetAt);

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return NextResponse.json({ ok: true }); // don't leak existence

  const token = newPublicToken();
  const tokenHash = hashPublicToken(token);
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60); // 1 hour

  await prisma.passwordResetToken.create({
    data: { userId: user.id, token: `hashed:${tokenHash}`, tokenHash, expiresAt },
  });

  const resetUrl = absoluteAppUrl(`/auth/reset-password?token=${token}`);
  await sendPasswordResetEmail(email, user.name, resetUrl);

  return NextResponse.json({ ok: true });
}
