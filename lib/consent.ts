import type { Prisma } from "@/app/generated/prisma/client";

/**
 * Parent/guardian consent text. Bump PARENT_CONSENT_VERSION whenever the wording changes: the
 * version the parent accepted is stored on the invite (InviteToken.parentConsentVersion).
 */
export const PARENT_CONSENT_VERSION = "2026-10-02";
export const PARENT_CONSENT_STATEMENT =
  "By authorizing, you confirm that you are this student's parent or legal guardian and that the student may create an account and be associated with the teacher who issued the invitation.";

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

/** Parent authorization is needed when the teacher asked for it or the student is a minor (always). */
export function requiresParentAuthorization(invite: {
  parentConsentRequired: boolean;
  isMinor: boolean;
  parentEmail: string | null;
  parentConsentAt: Date | null;
}) {
  return Boolean((invite.parentConsentRequired || invite.isMinor) && invite.parentEmail && !invite.parentConsentAt);
}
