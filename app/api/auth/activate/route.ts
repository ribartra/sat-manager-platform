import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { checkRateLimit, rateLimitKey, rateLimitResponse } from "@/lib/rate-limit";
import { hashPublicToken } from "@/lib/token-security";
import { captureCaughtError, writeAudit } from "@/lib/audit";
import { inviteUnusableReason, resolveParentAccount, TERMS_VERSION } from "@/lib/consent";
import { passwordPolicyError } from "@/lib/password-policy";
import { BadRequestError, ConflictError, InternalServerError, ValidationError, withApiErrors } from "@/lib/api-error";
import { formatOptionalPersonName, formatPersonName } from "@/lib/person-name";

export const POST = withApiErrors(async function POST(req: NextRequest) {
  const { token, password, acceptTerms } = await req.json();
  if (!token || !password) return new BadRequestError("Something is missing. Please fill in the form again.").toResponse();
  const limited = checkRateLimit(rateLimitKey(req, "activate", token.slice(0, 12)), 10, 15 * 60 * 1000);
  if (!limited.allowed) return rateLimitResponse(limited.resetAt);

  try {
    const tokenHash = hashPublicToken(token);
    const invite = await prisma.inviteToken.findFirst({
      where: { OR: [{ tokenHash }, { token }] },
      include: { program: true },
    });
    const unusable = inviteUnusableReason(invite);
    if (!invite || unusable) {
      await writeAudit({
        action: "USER_CREATE_FAILED",
        targetType: "InviteToken",
        targetId: invite?.id ?? token.slice(0, 12),
        outcome: "failure",
        metadata: { reason: unusable },
      });
      return new BadRequestError("This invitation link doesn't work or has expired. Ask your teacher for a new one.").toResponse();
    }
    // Consent is recorded as accepting the Terms of Use (with the clause for students under 18).
    if (acceptTerms !== true) {
      return new ValidationError("Please accept the Terms of Use and the Privacy Policy to continue.", ["acceptTerms"]).toResponse();
    }
    const termsAcceptedAt = new Date();
    if (!invite.tokenHash) {
      await prisma.inviteToken.update({ where: { id: invite.id }, data: { tokenHash, token: `hashed:${tokenHash}` } });
    }

    const policyError = passwordPolicyError(password, invite.email);
    if (policyError) return new BadRequestError(policyError).toResponse();

    const hash = await bcrypt.hash(password, 10);

    // Parent account creation flow
    if (invite.role === "PARENT") {
      const existingUser = await prisma.user.findUnique({ where: { email: invite.email } });
      if (existingUser) {
        await writeAudit({
          action: "USER_CREATE_FAILED",
          targetType: "InviteToken",
          targetId: invite.id,
          outcome: "failure",
          metadata: { reason: "email_exists", email: invite.email },
        });
        return new ConflictError("There's already an account with this email. Try signing in instead.").toResponse();
      }

      let parentId = "";
      await prisma.$transaction(async (tx) => {
        const parent = await tx.user.create({
          data: {
            name: formatPersonName(invite.name),
            email: invite.email,
            phone: invite.phone ?? null,
            passwordHash: hash,
            role: "PARENT",
            active: true,
            validationStatus: "APPROVED",
            validationReviewedAt: new Date(),
            termsAcceptedAt,
            termsVersion: TERMS_VERSION,
          },
        });
        parentId = parent.id;

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

        await tx.inviteToken.update({ where: { id: invite.id }, data: { usedAt: new Date(), termsAcceptedAt, termsVersion: TERMS_VERSION } });
      });

      await writeAudit({
        userId: parentId,
        action: "USER_ACTIVATED",
        targetType: "User",
        targetId: parentId,
        outcome: "success",
        metadata: { role: "PARENT", inviteId: invite.id, email: invite.email, termsVersion: TERMS_VERSION },
      });

      return NextResponse.json({ ok: true });
    }

    // Teacher invited by the master teacher (Teachers menu): an approved teacher account that JOINS
    // the inviter's program (the program is the tenant: shared bank; each teacher has own students).
    if (invite.role === "TEACHER") {
      const now = new Date();
      const programOpen =
        invite.program && !invite.program.deletedAt && invite.program.active && invite.program.startDate <= now &&
        (invite.program.endDate === null || invite.program.endDate > now);
      if (!invite.programId || !programOpen) {
        await writeAudit({ action: "USER_CREATE_FAILED", targetType: "InviteToken", targetId: invite.id, outcome: "failure", metadata: { reason: "program_unavailable", email: invite.email, role: "TEACHER" } });
        return new BadRequestError("This invitation isn't linked to an open program. Ask for a new one.").toResponse();
      }
      const teacherProgramId = invite.programId;
      const existing = await prisma.user.findUnique({ where: { email: invite.email }, select: { id: true } });
      if (existing) {
        await writeAudit({ action: "USER_CREATE_FAILED", targetType: "InviteToken", targetId: invite.id, outcome: "failure", metadata: { reason: "email_exists", email: invite.email, role: "TEACHER" } });
        return new ConflictError("There's already an account with this email. Try signing in instead.").toResponse();
      }
      let teacherId = "";
      await prisma.$transaction(async (tx) => {
        const teacher = await tx.user.create({
          data: {
            name: formatPersonName(invite.name),
            email: invite.email,
            passwordHash: hash,
            role: "TEACHER",
            active: true,
            validationStatus: "APPROVED",
            validationReviewedAt: new Date(),
            termsAcceptedAt,
            termsVersion: TERMS_VERSION,
          },
        });
        teacherId = teacher.id;
        await tx.programTeacher.create({ data: { programId: teacherProgramId, teacherId: teacher.id } });
        await tx.inviteToken.update({ where: { id: invite.id }, data: { usedAt: new Date(), termsAcceptedAt, termsVersion: TERMS_VERSION } });
      });
      await writeAudit({
        userId: teacherId,
        action: "USER_ACTIVATED",
        targetType: "User",
        targetId: teacherId,
        outcome: "success",
        metadata: { role: "TEACHER", inviteId: invite.id, email: invite.email, invitedById: invite.invitedById, programId: teacherProgramId, termsVersion: TERMS_VERSION },
      });
      return NextResponse.json({ ok: true, role: "TEACHER" });
    }

    // Student account creation flow. A parent's authorization no longer blocks it (policy
    // 2026-10-22): the student accepts the Terms above, which include the clause for minors.
    const now = new Date();
    const programAvailable =
      invite.program?.active &&
      invite.program.startDate <= now &&
      (invite.program.endDate === null || invite.program.endDate > now);

    if (!invite.programId || !programAvailable) {
      await writeAudit({
        action: "USER_CREATE_FAILED",
        targetType: "InviteToken",
        targetId: invite.id,
        outcome: "failure",
        metadata: { reason: "program_unavailable", email: invite.email },
      });
      return new BadRequestError("This invitation isn't linked to an open program. Ask your teacher for a new one.").toResponse();
    }

    const programId = invite.programId;
    let studentId = "";
    let parentConflictRole: string | null = null;

    await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          name: formatPersonName(invite.name),
          email: invite.email,
          phone: invite.phone ?? null,
          startDate: invite.startDate ?? null,
          birthDate: invite.birthDate ?? null,
          passwordHash: hash,
          role: "STUDENT",
          active: true,
          validationStatus: "APPROVED",
          validationReviewedAt: new Date(),
          termsAcceptedAt,
          termsVersion: TERMS_VERSION,
        },
      });
      studentId = user.id;
      // Owner teacher = who invited the student (a teacher only sees the students they own). An
      // invitation sent by an admin goes to the program's first current teacher.
      const inviter = invite.invitedById ? await tx.user.findUnique({ where: { id: invite.invitedById }, select: { role: true } }) : null;
      const ownerId =
        inviter?.role === "TEACHER"
          ? invite.invitedById
          : (await tx.programTeacher.findFirst({ where: { programId, endDate: null }, orderBy: { startDate: "asc" }, select: { teacherId: true } }))?.teacherId ?? null;
      await tx.programEnrollment.create({
        data: {
          programId,
          studentId: user.id,
          status: "APPROVED",
          active: true,
          teacherId: ownerId,
        },
      });

      if (invite.parentEmail) {
        // Create or link a PARENT account only; never convert an existing student/teacher/admin.
        const account = await resolveParentAccount(tx, invite.parentEmail);
        if (account.kind === "conflict") {
          parentConflictRole = account.role;
        } else {
          const parentId =
            account.kind === "parent"
              ? account.id
              : (
                  await tx.user.create({
                    data: {
                      name: formatOptionalPersonName(invite.parentName) ?? invite.parentEmail,
                      email: invite.parentEmail,
                      phone: invite.parentPhone ?? null,
                      role: "PARENT",
                      active: true,
                      validationStatus: "APPROVED",
                      validationReviewedAt: new Date(),
                    },
                  })
                ).id;
          await tx.parentStudent.upsert({
            where: { parentId_studentId: { parentId, studentId: user.id } },
            update: { authorizedAt: new Date() },
            create: { parentId, studentId: user.id, authorizedAt: new Date() },
          });
        }
      }

      await tx.inviteToken.update({ where: { id: invite.id }, data: { usedAt: new Date(), termsAcceptedAt, termsVersion: TERMS_VERSION } });
    });

    await writeAudit({
      userId: studentId,
      action: "USER_ACTIVATED",
      targetType: "User",
      targetId: studentId,
      outcome: "success",
      metadata: { role: "STUDENT", inviteId: invite.id, email: invite.email, programId, isMinor: invite.isMinor, termsVersion: TERMS_VERSION },
    });
    if (parentConflictRole) {
      await writeAudit({
        userId: studentId,
        action: "PARENT_LINK_SKIPPED",
        targetType: "InviteToken",
        targetId: invite.id,
        outcome: "failure",
        metadata: { reason: "parent_email_belongs_to_other_role", existingRole: parentConflictRole },
      });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    await captureCaughtError("auth.activate", error, {
      metadata: { tokenPrefix: String(token).slice(0, 8) },
    });
    return new InternalServerError("We couldn't set up your account. Please try again.").toResponse();
  }
});
