import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { checkRateLimit, rateLimitKey, rateLimitResponse } from "@/lib/rate-limit";
import { hashPublicToken } from "@/lib/token-security";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (!token) return NextResponse.json({ error: "Missing token" }, { status: 400 });
  const limited = checkRateLimit(rateLimitKey(req, "invite-info", token.slice(0, 12)), 20, 15 * 60 * 1000);
  if (!limited.allowed) return rateLimitResponse(limited.resetAt);

  const tokenHash = hashPublicToken(token);
  const invite = await prisma.inviteToken.findFirst({
    where: { OR: [{ tokenHash }, { token }] },
    include: { program: true },
  });
  if (!invite || invite.usedAt || invite.expiresAt < new Date()) {
    return NextResponse.json({ error: "Invalid or expired token" }, { status: 400 });
  }
  if (!invite.tokenHash) {
    await prisma.inviteToken.update({ where: { id: invite.id }, data: { tokenHash, token: `hashed:${tokenHash}` } });
  }

  return NextResponse.json({
    role: invite.role,
    name: invite.name,
    email: invite.email,
    phone: invite.phone,
    startDate: invite.startDate?.toISOString().slice(0, 10) ?? null,
    programName: invite.program?.name ?? null,
    requiresParentConsent: false,
    parentConsentApproved: true,
  });
}
