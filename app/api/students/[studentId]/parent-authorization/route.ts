import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { assertTeacherOrAdmin } from "@/lib/rbac";
import { studentAccessWhereFor } from "@/lib/program-scope";
import { resolveParentAccount } from "@/lib/consent";
import { hashPublicToken, newPublicToken } from "@/lib/token-security";
import { writeAudit } from "@/lib/audit";
import { parentAuthorizationState, sendParentAuthorizationLink } from "@/lib/parent-authorization";
import { BadRequestError, ConflictError, NotFoundError, ServiceUnavailableError, withApiErrors } from "@/lib/api-error";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// "Ask parent to authorize" for a student who already has an account. The student keeps using the
// platform while the parent decides; the parent's acceptance links them (ParentStudent.authorizedAt)
// through the same /auth/parent-consent page used for new invitations.
export const POST = withApiErrors(async function POST(req: NextRequest, { params }: { params: Promise<{ studentId: string }> }) {
  const session = await assertTeacherOrAdmin();
  const { studentId } = await params;
  const student = await prisma.user.findFirst({
    where: { id: studentId, ...studentAccessWhereFor(session.user) },
    select: { id: true, name: true, email: true },
  });
  if (!student) throw new NotFoundError("Student not found.");

  const body = await req.json().catch(() => ({}));
  const resend = body?.resend === true;
  const state = await parentAuthorizationState(student);
  if (state.status === "authorized") {
    throw new ConflictError(`${state.parentName} (${state.parentEmail}) already authorized this student.`);
  }

  let inviteId: string;
  if (resend) {
    if (state.status !== "waiting") throw new BadRequestError("There is no request to resend. Ask a parent to authorize first.");
    inviteId = state.inviteId;
  } else {
    const parentEmail = String(body?.parentEmail ?? "").trim().toLowerCase();
    const parentName = String(body?.parentName ?? "").trim() || null;
    if (!EMAIL_RE.test(parentEmail)) throw new BadRequestError("Enter the parent's email address.");
    if (parentEmail === student.email.toLowerCase()) {
      throw new BadRequestError("Use the parent's own email, not the student's.");
    }
    const account = await resolveParentAccount(prisma, parentEmail);
    if (account.kind === "conflict") {
      throw new ConflictError("This email is already used by a different kind of account. Use another parent or guardian email.");
    }

    if (state.status === "waiting") {
      // A new request replaces the pending one (e.g. the teacher fixed a typo in the email).
      await prisma.inviteToken.update({ where: { id: state.inviteId }, data: { parentEmail, parentName } });
      inviteId = state.inviteId;
    } else {
      // Consent-only record: the student account already exists, so the activation token is
      // marked used and can never create an account.
      const activationHash = hashPublicToken(newPublicToken());
      const now = new Date();
      const created = await prisma.inviteToken.create({
        data: {
          role: "STUDENT",
          name: student.name,
          email: student.email,
          invitedById: session.user.id,
          isMinor: false,
          parentConsentRequired: true,
          parentName,
          parentEmail,
          token: `hashed:${activationHash}`,
          tokenHash: activationHash,
          usedAt: now,
          expiresAt: now,
        },
      });
      inviteId = created.id;
    }
  }

  await writeAudit({
    userId: session.user.id,
    action: "PARENT_AUTHORIZATION_REQUESTED",
    targetType: "User",
    targetId: student.id,
    outcome: "success",
    metadata: { inviteId, resend },
  });

  const result = await sendParentAuthorizationLink(inviteId, {
    actorId: session.user.id,
    existingStudent: true,
    reason: resend ? "teacher_resend" : "teacher_request",
  });
  if (!result.sent) {
    throw new ServiceUnavailableError("The request was saved, but the email couldn't be sent. Try \"Resend\" in a moment.");
  }
  const invite = await prisma.inviteToken.findUniqueOrThrow({ where: { id: inviteId }, select: { parentEmail: true } });
  return NextResponse.json({ ok: true, parentEmail: invite.parentEmail });
});
