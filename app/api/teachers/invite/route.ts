import { NextRequest, NextResponse } from "next/server";
import { assertTeacherManager } from "@/lib/rbac";
import prisma from "@/lib/prisma";
import { absoluteAppUrl, sendTeacherInviteEmail } from "@/lib/email";
import { hashPublicToken, newPublicToken } from "@/lib/token-security";
import { writeAudit } from "@/lib/audit";
import { INVITE_DAYS, openInviteWhere } from "@/lib/consent";
import { teacherProgramIds } from "@/lib/program-scope";
import { formatDate } from "@/lib/utils";
import { BadRequestError, ConflictError, withApiErrors } from "@/lib/api-error";

/**
 * Master teacher invites a teacher (Teachers menu). Only accounts with User.canManageTeachers
 * (assertTeacherManager). The invited teacher joins the master's program (the program is the tenant:
 * shared bank; each teacher invites and manages their own students). One open invitation per email.
 */
export const POST = withApiErrors(async function POST(req: NextRequest) {
  const session = await assertTeacherManager();
  const body = (await req.json().catch(() => ({}))) as { name?: unknown; email?: unknown; programId?: unknown };
  const name = String(body.name ?? "").trim();
  const email = String(body.email ?? "").trim().toLowerCase();
  if (!name || !email) throw new BadRequestError("Name and email are required.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new BadRequestError("Enter a valid email.");

  // The program they join: the one chosen (must be one the master teaches) or the master's first one.
  const programIds = await teacherProgramIds(session.user);
  const requested = typeof body.programId === "string" && body.programId ? body.programId : null;
  if (requested && !programIds.includes(requested)) throw new BadRequestError("Choose one of your programs.");
  const programId = requested ?? programIds[0];
  if (!programId) throw new BadRequestError("You don't teach any program yet.");

  const existingUser = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (existingUser) throw new ConflictError("A user with that email already exists.");

  const now = new Date();
  const token = newPublicToken();
  const tokenHash = hashPublicToken(token);
  const expiresAt = new Date(now.getTime() + 1000 * 60 * 60 * 24 * INVITE_DAYS);
  const outcome = await prisma.$transaction(async (tx) => {
    const open = await tx.inviteToken.findFirst({ where: openInviteWhere(email, now, "TEACHER"), orderBy: { expiresAt: "desc" } });
    if (open) return { open };
    const invite = await tx.inviteToken.create({
      data: { role: "TEACHER", name, email, invitedById: session.user.id, programId, token: `hashed:${tokenHash}`, tokenHash, expiresAt },
    });
    return { invite };
  });
  if ("open" in outcome && outcome.open) {
    throw new ConflictError(`This teacher already has an invitation. The link works until ${formatDate(outcome.open.expiresAt)}.`, {
      code: "INVITE_ALREADY_OPEN",
      extra: { expiresAt: outcome.open.expiresAt.toISOString() },
    });
  }
  const invite = outcome.invite!;
  await writeAudit({ userId: session.user.id, action: "TEACHER_INVITED", targetType: "InviteToken", targetId: invite.id, outcome: "success", metadata: { email, programId } });

  const inviteUrl = absoluteAppUrl(`/auth/activate?token=${token}`);
  const sent = await sendTeacherInviteEmail(email, name, session.user.name, inviteUrl);
  await writeAudit({
    userId: session.user.id,
    action: sent.sent ? "INVITE_EMAIL_SENT" : "INVITE_EMAIL_FAILED",
    targetType: "InviteToken",
    targetId: invite.id,
    outcome: sent.sent ? "success" : "failure",
    metadata: { to: email, role: "TEACHER", reason: sent.sent ? undefined : sent.reason },
  });
  return NextResponse.json({ ok: true, inviteUrl, emailSent: sent.sent });
});
