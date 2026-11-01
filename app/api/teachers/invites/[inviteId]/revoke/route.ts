import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { assertTeacherManager } from "@/lib/rbac";
import { teacherProgramIds } from "@/lib/program-scope";
import { writeAudit } from "@/lib/audit";
import { ConflictError, NotFoundError, withApiErrors } from "@/lib/api-error";

interface RouteContext {
  params: Promise<{ inviteId: string }>;
}

/**
 * Master teacher revokes a pending TEACHER invitation (Teachers menu): only invitations to one of
 * his programs (or sent by him). The link stops working at once. Student invitations are not here
 * (admins revoke those: /api/admin/invites/[id]/revoke).
 */
export const POST = withApiErrors(async function POST(_req: Request, { params }: RouteContext) {
  const session = await assertTeacherManager();
  const { inviteId } = await params;
  const programIds = await teacherProgramIds(session.user);
  const invite = await prisma.inviteToken.findFirst({
    where: { id: inviteId, role: "TEACHER", OR: [{ invitedById: session.user.id }, { programId: { in: programIds } }] },
    select: { id: true, email: true },
  });
  if (!invite) throw new NotFoundError("Invitation not found");
  // Race guard: only an open (unused, not revoked) invitation can be revoked.
  const revoked = await prisma.inviteToken.updateMany({ where: { id: invite.id, usedAt: null, revokedAt: null }, data: { revokedAt: new Date() } });
  if (revoked.count === 0) throw new ConflictError("This invitation was already used or revoked.");
  await writeAudit({ userId: session.user.id, action: "INVITE_REVOKED", targetType: "InviteToken", targetId: invite.id, outcome: "success", metadata: { email: invite.email, role: "TEACHER" } });
  return NextResponse.json({ ok: true });
});
