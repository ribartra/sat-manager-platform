import { NextRequest, NextResponse } from "next/server";
import { requireTeacherOrAdmin } from "@/lib/rbac";
import prisma from "@/lib/prisma";
import { absoluteAppUrl, sendStudentInviteEmail } from "@/lib/email";
import { hashPublicToken, newPublicToken } from "@/lib/token-security";
import { captureCaughtError, writeAudit } from "@/lib/audit";
import { INVITE_DAYS, openInviteWhere, resolveIsMinor, resolveParentAccount, TERMS_VERSION } from "@/lib/consent";
import { formatDate } from "@/lib/utils";
import { BadRequestError, ConflictError, ForbiddenError, InternalServerError, NotFoundError, ValidationError, withApiErrors } from "@/lib/api-error";
import { formatOptionalPersonName, formatPersonName } from "@/lib/person-name";

export const POST = withApiErrors(async function POST(req: NextRequest) {
  const session = await requireTeacherOrAdmin();
  if (!session) {
    return new ForbiddenError("Forbidden").toResponse();
  }

  try {
    const { name: nameRaw, email: emailRaw, phone, startDate, birthDate: birthDateRaw, programId, parentName: parentNameRaw, parentEmail: parentEmailRaw, parentPhone } = await req.json();
    const name = formatPersonName(String(nameRaw ?? ""));
    const parentName = formatOptionalPersonName(parentNameRaw);
    const email = String(emailRaw ?? "").trim().toLowerCase();
    const parentEmail = String(parentEmailRaw ?? "").trim().toLowerCase() || null;
    if (!name || !email || !programId) return new BadRequestError("Name, email, and program are required.").toResponse();
    if (!birthDateRaw) return new BadRequestError("Enter the student's birth date.").toResponse();
    const birthDate = new Date(birthDateRaw);
    if (Number.isNaN(birthDate.getTime()) || birthDate > new Date()) {
      return new BadRequestError("Birth date is not valid.").toResponse();
    }
    // Kept for the record and the activation page. Consent (also for minors) is the student's
    // acceptance of the Terms of Use at activation; a parent's authorization no longer blocks it.
    const isMinor = resolveIsMinor(birthDate, false);

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) return new ConflictError("A user with that email already exists.").toResponse();

    // The parent email is optional and only links a parent account at activation. It can never be
    // an account of another kind (a student's own login, for example).
    if (parentEmail) {
      if (parentEmail === email) return new ValidationError("The parent email must be different from the student's email.", ["parentEmail"]).toResponse();
      const parentAccount = await resolveParentAccount(prisma, parentEmail);
      if (parentAccount.kind === "conflict") {
        return new ValidationError(
          "That parent email already belongs to another kind of account (for example, a student). Use a different parent email or leave it empty.",
          ["parentEmail"],
        ).toResponse();
      }
    }

    const now = new Date();
    const program = await prisma.program.findFirst({
      where: {
        id: programId,
        active: true,
        startDate: { lte: now },
        OR: [{ endDate: null }, { endDate: { gt: now } }],
        ...(session.user.role === "TEACHER"
          ? { teachers: { some: { teacherId: session.user.id, endDate: null, teacher: { active: true } } } }
          : {}),
      },
    });
    if (!program) return new NotFoundError("Program not found or unavailable.").toResponse();

    const expiresAt = new Date(now.getTime() + 1000 * 60 * 60 * 24 * INVITE_DAYS);

    const token = newPublicToken();
    const tokenHash = hashPublicToken(token);

    // Policy: one invitation per student until it expires. Checked and created in one transaction so
    // two clicks cannot both create one.
    const outcome = await prisma.$transaction(async (tx) => {
      const open = await tx.inviteToken.findFirst({ where: openInviteWhere(email, now), orderBy: { expiresAt: "desc" } });
      if (open) return { open };
      const invite = await tx.inviteToken.create({
        data: {
          role: "STUDENT",
          name,
          email,
          phone: phone || null,
          startDate: startDate ? new Date(startDate) : null,
          invitedById: session.user.id,
          programId: program.id,
          birthDate,
          isMinor,
          parentConsentRequired: false,
          parentName: parentEmail ? parentName || null : null,
          parentEmail,
          parentPhone: parentEmail ? parentPhone || null : null,
          token: `hashed:${tokenHash}`,
          tokenHash,
          expiresAt,
        },
      });
      return { invite };
    });

    if ("open" in outcome && outcome.open) {
      const open = outcome.open;
      await writeAudit({
        userId: session.user.id,
        action: "INVITE_CREATE_FAILED",
        targetType: "InviteToken",
        targetId: open.id,
        outcome: "failure",
        metadata: { reason: "open_invite_exists", email, expiresAt: open.expiresAt.toISOString() },
      });
      return new ConflictError(
        `This student already has an invitation. The link in their email works until ${formatDate(open.expiresAt)}; you can send a new one after that.`,
        { code: "INVITE_ALREADY_OPEN", extra: { expiresAt: open.expiresAt.toISOString() } },
      ).toResponse();
    }
    const invite = outcome.invite!;

    await writeAudit({
      userId: session.user.id,
      action: "INVITE_CREATED",
      targetType: "InviteToken",
      targetId: invite.id,
      outcome: "success",
      metadata: { email, programId: program.id, isMinor, hasParentEmail: Boolean(parentEmail), termsVersion: TERMS_VERSION },
    });

    const inviteUrl = absoluteAppUrl(`/auth/activate?token=${token}`);
    const inviteEmail = await sendStudentInviteEmail(email, name, inviteUrl);
    await writeAudit({
      userId: session.user.id,
      action: inviteEmail.sent ? "INVITE_EMAIL_SENT" : "INVITE_EMAIL_FAILED",
      targetType: "InviteToken",
      targetId: invite.id,
      outcome: inviteEmail.sent ? "success" : "failure",
      metadata: { to: email, reason: inviteEmail.sent ? undefined : inviteEmail.reason },
    });

    return NextResponse.json({ ok: true, inviteUrl });
  } catch (error) {
    await captureCaughtError("students.invite", error, { userId: session.user.id });
    return new InternalServerError("Failed to create invitation.").toResponse();
  }
});
