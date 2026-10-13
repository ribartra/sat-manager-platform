import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { checkRateLimit, rateLimitKey, rateLimitResponse } from "@/lib/rate-limit";
import { hashPublicToken } from "@/lib/token-security";
import { captureCaughtError, writeAudit } from "@/lib/audit";
import { requiresParentAuthorization, resolveParentAccount } from "@/lib/consent";
import { passwordPolicyError } from "@/lib/password-policy";
import { BadRequestError, ConflictError, ForbiddenError, InternalServerError, withApiErrors } from "@/lib/api-error";

export const POST = withApiErrors(async function POST(req: NextRequest) {
  const { token, password } = await req.json();
  if (!token || !password) return new BadRequestError("Something is missing. Please fill in the form again.").toResponse();
  const limited = checkRateLimit(rateLimitKey(req, "activate", token.slice(0, 12)), 10, 15 * 60 * 1000);
  if (!limited.allowed) return rateLimitResponse(limited.resetAt);

  try {
    const tokenHash = hashPublicToken(token);
    const invite = await prisma.inviteToken.findFirst({
      where: { OR: [{ tokenHash }, { token }] },
      include: { program: true },
    });
    if (!invite || invite.usedAt || invite.expiresAt < new Date()) {
      await writeAudit({
        action: "USER_CREATE_FAILED",
        targetType: "InviteToken",
        targetId: invite?.id ?? token.slice(0, 12),
        outcome: "failure",
        metadata: {
          reason: !invite ? "not_found" : invite.usedAt ? "already_used" : "expired",
        },
      });
      return new BadRequestError("This invitation link doesn't work or has expired. Ask your teacher for a new one.").toResponse();
    }
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

        await tx.inviteToken.update({ where: { id: invite.id }, data: { usedAt: new Date() } });
      });

      await writeAudit({
        userId: parentId,
        action: "USER_ACTIVATED",
        targetType: "User",
        targetId: parentId,
        outcome: "success",
        metadata: { role: "PARENT", inviteId: invite.id, email: invite.email },
      });

      return NextResponse.json({ ok: true });
    }

    // Student account creation flow
    const requiresParentConsent = requiresParentAuthorization(invite);
    if (requiresParentConsent) {
      await writeAudit({
        action: "USER_CREATE_FAILED",
        targetType: "InviteToken",
        targetId: invite.id,
        outcome: "failure",
        metadata: { reason: "parent_consent_required", email: invite.email },
      });
      return new ForbiddenError(
        `Your parent or guardian needs to authorize your account first. We sent an email to ${invite.parentEmail}. Once they accept, come back to this link to finish setting up.`,
      ).toResponse();
    }

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
          name: invite.name,
          email: invite.email,
          phone: invite.phone ?? null,
          startDate: invite.startDate ?? null,
          birthDate: invite.birthDate ?? null,
          passwordHash: hash,
          role: "STUDENT",
          active: true,
          validationStatus: "APPROVED",
          validationReviewedAt: new Date(),
        },
      });
      studentId = user.id;
      await tx.programEnrollment.create({
        data: {
          programId,
          studentId: user.id,
          status: "APPROVED",
          active: true,
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
                      name: invite.parentName ?? invite.parentEmail,
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

      await tx.inviteToken.update({ where: { id: invite.id }, data: { usedAt: new Date() } });
    });

    await writeAudit({
      userId: studentId,
      action: "USER_ACTIVATED",
      targetType: "User",
      targetId: studentId,
      outcome: "success",
      metadata: { role: "STUDENT", inviteId: invite.id, email: invite.email, programId },
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
