import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { checkRateLimit, rateLimitKey, rateLimitResponse } from "@/lib/rate-limit";
import { hashPublicToken } from "@/lib/token-security";
import { passwordPolicyError } from "@/lib/password-policy";
import { forgetSessionState } from "@/lib/session-state";
import { captureCaughtError, writeAudit } from "@/lib/audit";

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

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (!token) return NextResponse.json({ error: "Missing token" }, { status: 400 });
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
    return NextResponse.json({ error: "Invalid or expired authorization link" }, { status: 400 });
  }

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
  });
}

export async function POST(req: NextRequest) {
  const { token, password } = await req.json();
  if (!token) return NextResponse.json({ error: "Missing token" }, { status: 400 });
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
      return NextResponse.json({ error: "Invalid or expired authorization link" }, { status: 400 });
    }

    const policyError = passwordPolicyError(password, invite.parentEmail);
    if (policyError) return NextResponse.json({ error: policyError }, { status: 400 });

    const passwordHash = await bcrypt.hash(password, 10);
    const consentAt = new Date();
    const parentEmail = invite.parentEmail;

    const parent = await prisma.$transaction(async (tx) => {
      const upserted = await tx.user.upsert({
        where: { email: parentEmail },
        update: {
          name: invite.parentName ?? parentEmail,
          phone: invite.parentPhone ?? null,
          role: "PARENT",
          passwordHash,
          sessionVersion: { increment: 1 },
          active: true,
          validationStatus: "APPROVED",
          validationReviewedAt: consentAt,
        },
        create: {
          name: invite.parentName ?? parentEmail,
          email: parentEmail,
          phone: invite.parentPhone ?? null,
          role: "PARENT",
          passwordHash,
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
        },
      });

      // If the student already activated, ensure ParentStudent link exists.
      const student = await tx.user.findUnique({ where: { email: invite.email } });
      if (student) {
        await tx.parentStudent.upsert({
          where: { parentId_studentId: { parentId: upserted.id, studentId: student.id } },
          update: { authorizedAt: consentAt },
          create: { parentId: upserted.id, studentId: student.id, authorizedAt: consentAt },
        });
      }

      return upserted;
    });
    forgetSessionState(parent.id);

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
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    await captureCaughtError("auth.parent-consent", error, {
      metadata: { tokenPrefix: String(token).slice(0, 8) },
    });
    return NextResponse.json({ error: "Authorization failed." }, { status: 500 });
  }
}
