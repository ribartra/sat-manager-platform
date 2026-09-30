import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { notify } from "@/lib/notify";
import { captureCaughtError, writeAudit } from "@/lib/audit";
import { passwordPolicyError } from "@/lib/password-policy";
import { revokeUserSessions } from "@/lib/session-state";
import { BadRequestError, InternalServerError, UnauthorizedError, withApiErrors } from "@/lib/api-error";

export const POST = withApiErrors(async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return new UnauthorizedError("Unauthorized").toResponse();

  try {
    const { currentPassword, newPassword } = await req.json();
    const policyError = passwordPolicyError(newPassword, session.user.email);
    if (!currentPassword || policyError) {
      await writeAudit({
        userId: session.user.id,
        action: "PASSWORD_CHANGE_FAILED",
        targetType: "User",
        targetId: session.user.id,
        outcome: "failure",
        metadata: { reason: "validation" },
      });
      return new BadRequestError(policyError ?? "Current password is required.").toResponse();
    }

    const user = await prisma.user.findUnique({ where: { id: session.user.id } });
    if (!user?.passwordHash) {
      await writeAudit({
        userId: session.user.id,
        action: "PASSWORD_CHANGE_FAILED",
        targetType: "User",
        targetId: session.user.id,
        outcome: "failure",
        metadata: { reason: "no_password" },
      });
      return new BadRequestError("User cannot change password.").toResponse();
    }

    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) {
      await writeAudit({
        userId: session.user.id,
        action: "PASSWORD_CHANGE_FAILED",
        targetType: "User",
        targetId: session.user.id,
        outcome: "failure",
        metadata: { reason: "bad_current_password" },
      });
      return new BadRequestError("Current password is incorrect.").toResponse();
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({ where: { id: user.id }, data: { passwordHash } });
    // Sign out every other device; the client signs this one back in with the new password.
    await revokeUserSessions(user.id);

    await writeAudit({
      userId: user.id,
      action: "PASSWORD_CHANGED",
      targetType: "User",
      targetId: user.id,
      outcome: "success",
    });

    await notify(user.id, {
      title: "Password changed",
      body: "Your password was updated successfully. If you did not make this change, contact support immediately.",
    }).catch(() => {});

    return NextResponse.json({ ok: true, email: user.email, reauthenticate: true });
  } catch (error) {
    await captureCaughtError("auth.change-password", error, { userId: session.user.id });
    return new InternalServerError("Password change failed.").toResponse();
  }
});
