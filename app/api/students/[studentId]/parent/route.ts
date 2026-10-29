import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { assertTeacherOrAdmin } from "@/lib/rbac";
import { studentAccessWhereFor } from "@/lib/program-scope";
import { resolveParentAccount } from "@/lib/consent";
import { hashPublicToken, newPublicToken } from "@/lib/token-security";
import { absoluteAppUrl, sendParentAccessEmail } from "@/lib/email";
import { writeAudit } from "@/lib/audit";
import { BadRequestError, ConflictError, NotFoundError, withApiErrors } from "@/lib/api-error";
import { formatOptionalPersonName } from "@/lib/person-name";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ACCESS_LINK_DAYS = 7;

// "Add parent email" on the teacher's student page. Consent is given by accepting the Terms at
// activation, so there is no approval step: the parent account is created (or an existing parent
// account is reused, never another kind of account), linked at once, and emailed a sign-in link.
export const POST = withApiErrors(async function POST(req: NextRequest, { params }: { params: Promise<{ studentId: string }> }) {
  const session = await assertTeacherOrAdmin();
  const { studentId } = await params;
  const student = await prisma.user.findFirst({
    where: { id: studentId, ...studentAccessWhereFor(session.user) },
    select: { id: true, name: true, email: true },
  });
  if (!student) throw new NotFoundError("Student not found.");

  const body = await req.json().catch(() => ({}));
  const parentEmail = String(body?.parentEmail ?? "").trim().toLowerCase();
  const parentName = formatOptionalPersonName(String(body?.parentName ?? ""));
  if (!EMAIL_RE.test(parentEmail)) throw new BadRequestError("Enter the parent's email address.");
  if (parentEmail === student.email.toLowerCase()) {
    throw new BadRequestError("Use the parent's own email, not the student's.");
  }
  const account = await resolveParentAccount(prisma, parentEmail);
  if (account.kind === "conflict") {
    throw new ConflictError("This email belongs to another kind of account. Use another parent or guardian email.");
  }

  const now = new Date();
  const parent = await prisma.$transaction(async (tx) => {
    const parent =
      account.kind === "parent"
        ? await tx.user.findUniqueOrThrow({ where: { id: account.id }, select: { id: true, name: true, passwordHash: true } })
        : await tx.user.create({
            data: { name: parentName ?? parentEmail, email: parentEmail, role: "PARENT", active: true, validationStatus: "APPROVED", validationReviewedAt: now },
            select: { id: true, name: true, passwordHash: true },
          });
    await tx.parentStudent.upsert({
      where: { parentId_studentId: { parentId: parent.id, studentId: student.id } },
      update: { authorizedAt: now },
      create: { parentId: parent.id, studentId: student.id, authorizedAt: now },
    });
    return parent;
  });
  await writeAudit({
    userId: session.user.id,
    action: "PARENT_LINKED",
    targetType: "User",
    targetId: student.id,
    outcome: "success",
    metadata: { parentId: parent.id, parentEmail, newAccount: account.kind === "new" },
  });

  // A parent without a password gets a link to set one; an existing parent just signs in.
  const setPassword = !parent.passwordHash;
  let url = absoluteAppUrl("/login");
  if (setPassword) {
    const token = newPublicToken();
    const tokenHash = hashPublicToken(token);
    await prisma.passwordResetToken.create({
      data: { userId: parent.id, token: `hashed:${tokenHash}`, tokenHash, expiresAt: new Date(now.getTime() + ACCESS_LINK_DAYS * 24 * 60 * 60 * 1000) },
    });
    url = absoluteAppUrl(`/auth/reset-password?token=${token}`);
  }
  const sent = await sendParentAccessEmail(parentEmail, parent.name, student.name, url, { setPassword });
  await writeAudit({
    userId: session.user.id,
    action: sent.sent ? "INVITE_EMAIL_SENT" : "INVITE_EMAIL_FAILED",
    targetType: "User",
    targetId: parent.id,
    outcome: sent.sent ? "success" : "failure",
    metadata: { kind: "parent_access", to: parentEmail, reason: sent.sent ? undefined : sent.reason },
  });
  return NextResponse.json({ ok: true, parentEmail, emailSent: sent.sent });
});
