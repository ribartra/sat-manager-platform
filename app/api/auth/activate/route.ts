import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function POST(req: NextRequest) {
  const { token, password } = await req.json();
  if (!token || !password) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  const invite = await prisma.inviteToken.findUnique({ where: { token }, include: { program: true } });
  if (!invite || invite.usedAt || invite.expiresAt < new Date()) {
    return NextResponse.json({ error: "This invitation link is invalid or has expired." }, { status: 400 });
  }
  if (!invite.programId || !invite.program?.active) {
    return NextResponse.json({ error: "This invitation is not linked to an active program." }, { status: 400 });
  }
  if (invite.parentEmail && !invite.parentConsentAt) {
    return NextResponse.json({ error: "A parent or guardian must authorize this enrollment before activation." }, { status: 403 });
  }

  const programId = invite.programId;
  const hash = await bcrypt.hash(password, 10);

  await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        name: invite.name,
        email: invite.email,
        phone: invite.phone ?? null,
        startDate: invite.startDate ?? null,
        passwordHash: hash,
        role: "STUDENT",
        active: true,
        validationStatus: "APPROVED",
        validationReviewedAt: new Date(),
      },
    });
    await tx.programEnrollment.create({
      data: {
        programId,
        studentId: user.id,
        active: true,
      },
    });
    if (invite.parentEmail) {
      const parent = await tx.user.upsert({
        where: { email: invite.parentEmail },
        update: {
          name: invite.parentName ?? invite.parentEmail,
          phone: invite.parentPhone ?? null,
          role: "PARENT",
          active: true,
          validationStatus: "APPROVED",
          validationReviewedAt: new Date(),
        },
        create: {
          name: invite.parentName ?? invite.parentEmail,
          email: invite.parentEmail,
          phone: invite.parentPhone ?? null,
          role: "PARENT",
          active: true,
          validationStatus: "APPROVED",
          validationReviewedAt: new Date(),
        },
      });
      await tx.parentStudent.upsert({
        where: { parentId_studentId: { parentId: parent.id, studentId: user.id } },
        update: { authorizedAt: invite.parentConsentAt },
        create: { parentId: parent.id, studentId: user.id, authorizedAt: invite.parentConsentAt },
      });
    }
    await tx.inviteToken.update({ where: { id: invite.id }, data: { usedAt: new Date() } });
    return user;
  });

  return NextResponse.json({ ok: true });
}
