import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { checkRateLimit, rateLimitKey, rateLimitResponse } from "@/lib/rate-limit";
import { hashPublicToken } from "@/lib/token-security";
import { passwordPolicyError } from "@/lib/password-policy";
import { captureCaughtError, writeAudit } from "@/lib/audit";
import { ApiError, BadRequestError, ConflictError, InternalServerError, withApiErrors } from "@/lib/api-error";
import { PARENT_CONSENT_VERSION, resolveParentAccount } from "@/lib/consent";

async function findInviteByParentConsentToken(token: string) {
  const parentConsentTokenHash = hashPublicToken(token);
  const invite = await prisma.inviteToken.findFirst({
    where: { OR: [{ parentConsentTokenHash }, { parentConsentToken: token }] },
  });
  if (invite && !invite.parentConsentTokenHash) {
    await prisma.inviteToken.update({
      where: { id: invite.id },
      data: { parentConsentTokenHash, parentConsentToken: `hashed:${parentConsentTokenHash}` },
    });
  }
  return invite;
}

function consentLinkFailureReason(invite: {
  expiresAt: Date;
  parentEmail: string | null;
} | null): "not_found" | "no_parent_email" | "expired" | null {
  if (!invite) return "not_found";
  if (!invite.parentEmail) return "no_parent_email";
  if (invite.expiresAt < new Date()) return "expired";
  // Note: do NOT reject when invite.usedAt is set — the student may activate
  // first; the parent must still be able to set their password / record consent.
  return null;
}

export const GET = withApiErrors(async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (!token) return new BadRequestError("Missing token").toResponse();
  const limited = checkRateLimit(rateLimitKey(req, "parent-consent-info", token.slice(0, 12)), 20, 15 * 60 * 1000);
  if (!limited.allowed) return rateLimitResponse(limited.resetAt);

  const invite = await findInviteByParentConsentToken(token);
  const failReason = consentLinkFailureReason(invite);
  if (failReason || !invite?.parentEmail) {
    await writeAudit({
      action: "PARENT_CONSENT_VIEW_FAILED",
      targetType: "InviteToken",
      targetId: invite?.id ?? token.slice(0, 12),
      outcome: "failure",
      metadata: {
        reason: failReason ?? "no_parent_email",
        usedAt: invite?.usedAt?.toISOString() ?? null,
      },
    });
    return new BadRequestError("Invalid or expired authorization link").toResponse();
  }

  const account = await resolveParentAccount(prisma, invite.parentEmail);

  await writeAudit({
    action: "PARENT_CONSENT_VIEWED",
    targetType: "InviteToken",
    targetId: invite.id,
    outcome: "success",
    metadata: {
      parentEmail: invite.parentEmail,
      studentEmail: invite.email,
      alreadyApproved: Boolean(invite.parentConsentAt),
      studentActivated: Boolean(invite.usedAt),
    },
  });

  return NextResponse.json({
    studentName: invite.name,
    studentEmail: invite.email,
    parentName: invite.parentName,
    parentEmail: invite.parentEmail,
    approved: Boolean(invite.parentConsentAt),
    // An existing parent account is linked as-is (no new password); any other account type
    // cannot be used as a parent email.
    existingParent: account.kind === "parent",
    accountConflict: account.kind === "conflict",
    consentVersion: PARENT_CONSENT_VERSION,
  });
});

export const POST = withApiErrors(async function POST(req: NextRequest) {
  const { token, password } = await req.json();
  if (!token) return new BadRequestError("Missing token").toResponse();
  const limited = checkRateLimit(rateLimitKey(req, "parent-consent", token.slice(0, 12)), 10, 15 * 60 * 1000);
  if (!limited.allowed) return rateLimitResponse(limited.resetAt);

  try {
    const invite = await findInviteByParentConsentToken(token);
    const failReason = consentLinkFailureReason(invite);
    if (failReason || !invite?.parentEmail) {
      await writeAudit({
        action: "PARENT_CONSENT_VIEW_FAILED",
        targetType: "InviteToken",
        targetId: invite?.id ?? token.slice(0, 12),
        outcome: "failure",
        metadata: {
          reason: failReason ?? "no_parent_email",
          phase: "submit",
        },
      });
      return new BadRequestError("Invalid or expired authorization link").toResponse();
    }

    const consentAt = new Date();
    const parentEmail = invite.parentEmail;
    const account = await resolveParentAccount(prisma, parentEmail);

    if (account.kind === "conflict") {
      await writeAudit({
        action: "PARENT_CONSENT_VIEW_FAILED",
        targetType: "InviteToken",
        targetId: invite.id,
        outcome: "failure",
        metadata: { reason: "parent_email_belongs_to_other_role", existingRole: account.role, phase: "submit" },
      });
      return new ConflictError(
        "This email already belongs to a non-parent account. Ask the teacher to use a different parent/guardian email.",
      ).toResponse();
    }

    // New parents choose a password; an existing parent keeps theirs (the link only records consent).
    let passwordHash: string | null = null;
    if (account.kind === "new") {
      const policyError = passwordPolicyError(password, parentEmail);
      if (policyError) return new BadRequestError(policyError).toResponse();
      passwordHash = await bcrypt.hash(password, 10);
    }

    const parent = await prisma.$transaction(async (tx) => {
      // Re-check inside the transaction: the email may have been taken since.
      const current = await resolveParentAccount(tx, parentEmail);
      if (current.kind === "conflict") throw new ConflictError("This email already belongs to a non-parent account.");

      const linked =
        current.kind === "parent"
          ? await tx.user.findUniqueOrThrow({ where: { id: current.id } })
          : await tx.user.create({
              data: {
                name: invite.parentName ?? parentEmail,
                email: parentEmail,
                phone: invite.parentPhone ?? null,
                role: "PARENT",
                passwordHash: passwordHash!,
                active: true,
                validationStatus: "APPROVED",
                validationReviewedAt: consentAt,
              },
            });

      await tx.inviteToken.update({
        where: { id: invite.id },
        data: {
          parentConsentAt: consentAt,
          parentConsentIp: req.headers.get("x-forwarded-for") ?? req.headers.get("x-real-ip"),
          parentConsentVersion: PARENT_CONSENT_VERSION,
        },
      });

      // If the student already activated, ensure ParentStudent link exists.
      const student = await tx.user.findUnique({ where: { email: invite.email } });
      if (student) {
        await tx.parentStudent.upsert({
          where: { parentId_studentId: { parentId: linked.id, studentId: student.id } },
          update: { authorizedAt: consentAt },
          create: { parentId: linked.id, studentId: student.id, authorizedAt: consentAt },
        });
      }

      return linked;
    });

    await writeAudit({
      userId: parent.id,
      action: "PARENT_CONSENT_RECORDED",
      targetType: "InviteToken",
      targetId: invite.id,
      outcome: "success",
      metadata: {
        parentEmail,
        studentEmail: invite.email,
        studentAlreadyActivated: Boolean(invite.usedAt),
        invitedById: invite.invitedById,
        consentVersion: PARENT_CONSENT_VERSION,
        parentAccount: account.kind,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof ApiError) return error.toResponse();
    await captureCaughtError("auth.parent-consent", error, {
      metadata: { tokenPrefix: String(token).slice(0, 8) },
    });
    return new InternalServerError("Authorization failed.").toResponse();
  }
});
