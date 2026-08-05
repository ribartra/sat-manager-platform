import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { checkRateLimit, rateLimitKey, rateLimitResponse } from "@/lib/rate-limit";
import { hashPublicToken } from "@/lib/token-security";

export async function POST(req: NextRequest) {
  const { token, password } = await req.json();
  if (!token || !password) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  const limited = checkRateLimit(rateLimitKey(req, "activate", token.slice(0, 12)), 10, 15 * 60 * 1000);
  if (!limited.allowed) return rateLimitResponse(limited.resetAt);

  const tokenHash = hashPublicToken(token);
  const invite = await prisma.inviteToken.findFirst({
    where: { OR: [{ tokenHash }, { token }] },
    include: { program: true },
  });
  if (!invite || invite.usedAt || invite.expiresAt < new Date()) {
    return NextResponse.json({ error: "This invitation link is invalid or has expired." }, { status: 400 });
  }
  if (!invite.tokenHash) {
    await prisma.inviteToken.update({ where: { id: invite.id }, data: { tokenHash, token: `hashed:${tokenHash}` } });
  }

  const hash = await bcrypt.hash(password, 10);

  // Parent account creation flow
  if (invite.role === "PARENT") {
    const existingUser = await prisma.user.findUnique({ where: { email: invite.email } });
    if (existingUser) {
      return NextResponse.json({ error: "An account with this email already exists." }, { status: 409 });
    }

    await prisma.$transaction(async (tx) => {
      const parent = await tx.user.create({
        data: {
          name: invite.name,
          email: invite.email,
          phone: invite.phone ?? null,
          passwordHash: hash,
          role: "PARENT",
          active: true,
          validationStatus: "APPROVED",
          validationReviewedAt: new Date(),
        },
      });

      // Link to student if they already activated their account
      if (invite.linkedStudentEmail) {
        const student = await tx.user.findUnique({ where: { email: invite.linkedStudentEmail } });
        if (student) {
          await tx.parentStudent.upsert({
            where: { parentId_studentId: { parentId: parent.id, studentId: student.id } },
            update: { authorizedAt: new Date() },
            create: { parentId: parent.id, studentId: student.id, authorizedAt: new Date() },
          });
        }
      }

      await tx.inviteToken.update({ where: { id: invite.id }, data: { usedAt: new Date() } });
    });

    return NextResponse.json({ ok: true });
  }

  // Student account creation flow
  const now = new Date();
  const programAvailable =
    invite.program?.active &&
    invite.program.startDate <= now &&
    (invite.program.endDate === null || invite.program.endDate > now);

  if (!invite.programId || !programAvailable) {
    return NextResponse.json({ error: "This invitation is not linked to an active program." }, { status: 400 });
  }

  const programId = invite.programId;

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
        status: "APPROVED",
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
        update: { authorizedAt: new Date() },
        create: { parentId: parent.id, studentId: user.id, authorizedAt: new Date() },
      });
    }

    await tx.inviteToken.update({ where: { id: invite.id }, data: { usedAt: new Date() } });
  });

  return NextResponse.json({ ok: true });
}
