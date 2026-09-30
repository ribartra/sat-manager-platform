import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { notify } from "@/lib/notify";
import { captureCaughtError, writeAudit } from "@/lib/audit";
import { passwordPolicyError } from "@/lib/password-policy";
import { revokeUserSessions } from "@/lib/session-state";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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
      return NextResponse.json({ error: policyError ?? "Current password is required." }, { status: 400 });
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
      return NextResponse.json({ error: "User cannot change password." }, { status: 400 });
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
      return NextResponse.json({ error: "Current password is incorrect." }, { status: 400 });
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
    return NextResponse.json({ error: "Password change failed." }, { status: 500 });
  }
}
