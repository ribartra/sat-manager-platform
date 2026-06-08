import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (!token) return NextResponse.json({ error: "Missing token" }, { status: 400 });

  const invite = await prisma.inviteToken.findUnique({ where: { token }, include: { program: true } });
  if (!invite || invite.usedAt || invite.expiresAt < new Date()) {
    return NextResponse.json({ error: "Invalid or expired token" }, { status: 400 });
  }

  return NextResponse.json({
    name: invite.name,
    email: invite.email,
    phone: invite.phone,
    startDate: invite.startDate?.toISOString().slice(0, 10) ?? null,
    programName: invite.program?.name ?? null,
    requiresParentConsent: Boolean(invite.parentEmail),
    parentConsentApproved: Boolean(invite.parentConsentAt),
  });
}
