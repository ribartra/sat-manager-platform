import type { Prisma } from "@/app/generated/prisma/client";

/**
 * Parent/guardian consent text. Bump PARENT_CONSENT_VERSION whenever the wording changes: the
 * version the parent accepted is stored on the invite (InviteToken.parentConsentVersion).
 */
export const PARENT_CONSENT_VERSION = "2026-10-02";
export const PARENT_CONSENT_STATEMENT =
  "By authorizing, you confirm that you are this student's parent or legal guardian and that the student may create an account and be associated with the teacher who issued the invitation.";

/**
 * Terms of Use version (app/terms/page.tsx). Consent, including the clause for students under 18, is
 * recorded as the student accepting these terms at activation (User/InviteToken.termsVersion).
 * Bump it whenever the terms change.
 */
export const TERMS_VERSION = "2026-10-22";

/** Days an invitation link works. Only one open invitation per student email until it expires. */
export const INVITE_DAYS = 7;

/** The open (not used, not revoked, not expired) invitations of a role (student by default) for an email. */
export function openInviteWhere(email: string, now: Date = new Date(), role: "STUDENT" | "TEACHER" = "STUDENT"): Prisma.InviteTokenWhereInput {
  return { role, email, usedAt: null, revokedAt: null, expiresAt: { gt: now } };
}

/** Why an invitation link no longer works, or null when it can still be used. */
export function inviteUnusableReason(invite: { usedAt: Date | null; revokedAt: Date | null; expiresAt: Date } | null) {
  if (!invite) return "not_found";
  if (invite.usedAt) return "already_used";
  if (invite.revokedAt) return "revoked";
  if (invite.expiresAt < new Date()) return "expired";
  return null;
}

export const ADULT_AGE = 18;

/** Whole years between birthDate and `at`. */
export function ageOn(birthDate: Date, at: Date = new Date()) {
  let age = at.getUTCFullYear() - birthDate.getUTCFullYear();
  const beforeBirthday =
    at.getUTCMonth() < birthDate.getUTCMonth() ||
    (at.getUTCMonth() === birthDate.getUTCMonth() && at.getUTCDate() < birthDate.getUTCDate());
  if (beforeBirthday) age -= 1;
  return age;
}

/** Minor status: derived from the birth date when known, otherwise the teacher's flag. */
export function resolveIsMinor(birthDate: Date | null | undefined, manualFlag: boolean) {
  return birthDate ? ageOn(birthDate) < ADULT_AGE : manualFlag;
}

export type ParentAccount =
  | { kind: "new" }
  | { kind: "parent"; id: string }
  | { kind: "conflict"; role: string };

/**
 * What a parent email maps to. Consent and activation may only CREATE a parent account or LINK an
 * existing PARENT; an email that belongs to a student, teacher or admin is a conflict and the
 * account is never converted or given a new password.
 */
export async function resolveParentAccount(
  db: Prisma.TransactionClient | { user: Prisma.TransactionClient["user"] },
  email: string,
): Promise<ParentAccount> {
  const existing = await db.user.findUnique({ where: { email }, select: { id: true, role: true } });
  if (!existing) return { kind: "new" };
  if (existing.role === "PARENT") return { kind: "parent", id: existing.id };
  return { kind: "conflict", role: existing.role };
}

/**
 * Legacy invitations (before TERMS_VERSION 2026-10-22) waiting for a parent's email authorization.
 * Activation no longer waits for it; this only decides whether the parent link can be resent.
 */
export function requiresParentAuthorization(invite: {
  parentConsentRequired: boolean;
  isMinor: boolean;
  parentEmail: string | null;
  parentConsentAt: Date | null;
}) {
  return Boolean((invite.parentConsentRequired || invite.isMinor) && invite.parentEmail && !invite.parentConsentAt);
}
