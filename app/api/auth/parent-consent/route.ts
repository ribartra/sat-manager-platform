import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (!token) return NextResponse.json({ error: "Missing token" }, { status: 400 });

  const invite = await prisma.inviteToken.findUnique({ where: { parentConsentToken: token } });
  if (!invite || invite.usedAt || invite.expiresAt < new Date() || !invite.parentEmail) {
    return NextResponse.json({ error: "Invalid or expired authorization link" }, { status: 400 });
  }

  return NextResponse.json({
    studentName: invite.name,
    studentEmail: invite.email,
    parentName: invite.parentName,
    parentEmail: invite.parentEmail,
    approved: Boolean(invite.parentConsentAt),
  });
}

export async function POST(req: NextRequest) {
  const { token, password } = await req.json();
  if (!token) return NextResponse.json({ error: "Missing token" }, { status: 400 });
  if (!password || typeof password !== "string" || password.length < 6) {
    return NextResponse.json({ error: "Password must be at least 6 characters." }, { status: 400 });
  }

  const invite = await prisma.inviteToken.findUnique({ where: { parentConsentToken: token } });
  if (!invite || invite.usedAt || invite.expiresAt < new Date() || !invite.parentEmail) {
    return NextResponse.json({ error: "Invalid or expired authorization link" }, { status: 400 });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const consentAt = new Date();

  await prisma.$transaction([
    prisma.user.upsert({
      where: { email: invite.parentEmail },
      update: {
        name: invite.parentName ?? invite.parentEmail,
        phone: invite.parentPhone ?? null,
        role: "PARENT",
        passwordHash,
        active: true,
      },
      create: {
        name: invite.parentName ?? invite.parentEmail,
        email: invite.parentEmail,
        phone: invite.parentPhone ?? null,
        role: "PARENT",
        passwordHash,
        active: true,
      },
    }),
    prisma.inviteToken.update({
      where: { id: invite.id },
      data: {
        parentConsentAt: consentAt,
        parentConsentIp: req.headers.get("x-forwarded-for") ?? req.headers.get("x-real-ip"),
      },
    }),
  ]);

  await prisma.auditLog.create({
    data: {
      userId: invite.invitedById ?? (await prisma.user.findUniqueOrThrow({ where: { email: invite.parentEmail } })).id,
      action: "PARENT_CONSENT_RECORDED",
      targetType: "InviteToken",
      targetId: invite.id,
      metadata: JSON.stringify({ parentEmail: invite.parentEmail, studentEmail: invite.email }),
    },
  });

  return NextResponse.json({ ok: true });
}
