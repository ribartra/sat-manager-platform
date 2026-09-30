import { NextRequest, NextResponse } from "next/server";
import { requireTeacherOrAdmin } from "@/lib/rbac";
import prisma from "@/lib/prisma";
import { absoluteAppUrl, sendParentConsentEmail, sendStudentInviteEmail } from "@/lib/email";
import { hashPublicToken, newPublicToken } from "@/lib/token-security";
import { captureCaughtError, writeAudit } from "@/lib/audit";
import { BadRequestError, ConflictError, ForbiddenError, InternalServerError, NotFoundError, withApiErrors } from "@/lib/api-error";

export const POST = withApiErrors(async function POST(req: NextRequest) {
  const session = await requireTeacherOrAdmin();
  if (!session) {
    return new ForbiddenError("Forbidden").toResponse();
  }

  try {
    const { name, email, phone, startDate, programId, isMinor, parentName, parentEmail, parentPhone } = await req.json();
    if (!name || !email || !programId) return new BadRequestError("Name, email, and program are required.").toResponse();
    if (isMinor && !parentEmail) return new BadRequestError("Parent email is required for minor students.").toResponse();

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) return new ConflictError("A user with that email already exists.").toResponse();

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

    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7);

    const token = newPublicToken();
    const tokenHash = hashPublicToken(token);

    // When a parent email is provided, pre-generate the consent token the
    // /auth/parent-consent page expects and email its link to the parent.
    const parentConsentToken = parentEmail ? newPublicToken() : null;
    const parentConsentTokenHash = parentConsentToken ? hashPublicToken(parentConsentToken) : null;

    const invite = await prisma.inviteToken.create({
      data: {
        role: "STUDENT",
        name,
        email,
        phone: phone || null,
        startDate: startDate ? new Date(startDate) : null,
        invitedById: session.user.id,
        programId: program.id,
        isMinor: Boolean(isMinor),
        parentName: parentName || null,
        parentEmail: parentEmail || null,
        parentPhone: parentPhone || null,
        parentConsentToken: parentConsentTokenHash ? `hashed:${parentConsentTokenHash}` : null,
        parentConsentTokenHash,
        token: `hashed:${tokenHash}`,
        tokenHash,
        expiresAt,
      },
    });

    await writeAudit({
      userId: session.user.id,
      action: "INVITE_CREATED",
      targetType: "InviteToken",
      targetId: invite.id,
      outcome: "success",
      metadata: { email, programId: program.id, isMinor: Boolean(isMinor), hasParentEmail: Boolean(parentEmail) },
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

    if (parentEmail && parentConsentToken) {
      const consentUrl = absoluteAppUrl(`/auth/parent-consent?token=${parentConsentToken}`);
      const consentEmail = await sendParentConsentEmail(parentEmail, parentName || null, name, consentUrl);
      await writeAudit({
        userId: session.user.id,
        action: consentEmail.sent ? "INVITE_EMAIL_SENT" : "INVITE_EMAIL_FAILED",
        targetType: "InviteToken",
        targetId: invite.id,
        outcome: consentEmail.sent ? "success" : "failure",
        metadata: {
          kind: "parent_consent",
          to: parentEmail,
          reason: consentEmail.sent ? undefined : consentEmail.reason,
        },
      });
    }

    return NextResponse.json({ ok: true, inviteUrl });
  } catch (error) {
    await captureCaughtError("students.invite", error, { userId: session.user.id });
    return new InternalServerError("Failed to create invitation.").toResponse();
  }
});
