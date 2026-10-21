import prisma from "@/lib/prisma";
import { absoluteAppUrl, sendParentConsentEmail } from "@/lib/email";
import { hashPublicToken, newPublicToken } from "@/lib/token-security";
import { writeAudit } from "@/lib/audit";

const CONSENT_LINK_DAYS = 7;

/**
 * Issue a fresh parent-authorization link for an invite and email it to the parent.
 * Each call replaces the previous link (only the newest email works) and gives it 7 more days.
 * Used by the student's "Resend email to my parent" and the teacher's "Ask parent to authorize".
 */
export async function sendParentAuthorizationLink(
  inviteId: string,
  options: { actorId?: string | null; existingStudent?: boolean; reason: string },
) {
  const invite = await prisma.inviteToken.findUniqueOrThrow({ where: { id: inviteId } });
  if (!invite.parentEmail) return { sent: false as const, reason: "no_parent_email" };

  const token = newPublicToken();
  const tokenHash = hashPublicToken(token);
  const expiresAt = new Date(Date.now() + CONSENT_LINK_DAYS * 24 * 60 * 60 * 1000);
  await prisma.inviteToken.update({
    where: { id: invite.id },
    data: {
      parentConsentTokenHash: tokenHash,
      parentConsentToken: `hashed:${tokenHash}`,
      // The consent link shares the invite's expiry; an existing student's request has no
      // activation step, so pushing the date is safe. A new student's invite gets 7 more days too.
      expiresAt: invite.expiresAt > expiresAt ? invite.expiresAt : expiresAt,
    },
  });

  const consentUrl = absoluteAppUrl(`/auth/parent-consent?token=${token}`);
  const result = await sendParentConsentEmail(invite.parentEmail, invite.parentName, invite.name, consentUrl, {
    existingStudent: options.existingStudent,
  });
  await writeAudit({
    userId: options.actorId ?? null,
    action: result.sent ? "INVITE_EMAIL_SENT" : "INVITE_EMAIL_FAILED",
    targetType: "InviteToken",
    targetId: invite.id,
    outcome: result.sent ? "success" : "failure",
    metadata: { kind: "parent_consent", reason: options.reason, to: invite.parentEmail, error: result.sent ? undefined : result.reason },
  });
  return result;
}

export type ParentAuthorizationState =
  | { status: "authorized"; parentName: string; parentEmail: string; at: Date | null }
  | { status: "waiting"; parentName: string | null; parentEmail: string; linkExpiresAt: Date; inviteId: string }
  | { status: "none" };

/** What the teacher sees on the student page: an authorized parent, a pending request, or nothing. */
export async function parentAuthorizationState(student: { id: string; email: string }): Promise<ParentAuthorizationState> {
  const link = await prisma.parentStudent.findFirst({
    where: { studentId: student.id, authorizedAt: { not: null } },
    include: { parent: { select: { name: true, email: true } } },
    orderBy: { authorizedAt: "desc" },
  });
  if (link) return { status: "authorized", parentName: link.parent.name, parentEmail: link.parent.email, at: link.authorizedAt };

  const pending = await prisma.inviteToken.findFirst({
    where: { role: "STUDENT", email: student.email, parentEmail: { not: null }, parentConsentAt: null, parentConsentRequired: true, revokedAt: null },
    orderBy: { expiresAt: "desc" },
  });
  if (pending?.parentEmail) {
    return { status: "waiting", parentName: pending.parentName, parentEmail: pending.parentEmail, linkExpiresAt: pending.expiresAt, inviteId: pending.id };
  }
  return { status: "none" };
}
