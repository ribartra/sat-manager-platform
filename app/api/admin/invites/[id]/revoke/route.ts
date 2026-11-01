import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { assertAdmin } from "@/lib/rbac";
import { writeAudit } from "@/lib/audit";
import { ConflictError, NotFoundError, withApiErrors } from "@/lib/api-error";

type Ctx = { params: Promise<{ id: string }> };

// POST /api/admin/invites/[id]/revoke — admin cancels an open invitation (e.g. wrong data). The link
// stops working and the one-open-invitation slot for that email is free again (lib/consent.ts).
// Teachers cannot do this: per the policy their invitation waits until it expires.
export const POST = withApiErrors(async function POST(_req: Request, { params }: Ctx) {
  const session = await assertAdmin();
  const { id } = await params;
  const invite = await prisma.inviteToken.findUnique({ where: { id }, select: { id: true, email: true, usedAt: true, revokedAt: true } });
  if (!invite) throw new NotFoundError("Invitation not found.");
  if (invite.usedAt) throw new ConflictError("This invitation was already used; the account exists.");
  if (invite.revokedAt) throw new ConflictError("This invitation was already cancelled.");

  const revokedAt = new Date();
  const updated = await prisma.inviteToken.updateMany({ where: { id, usedAt: null, revokedAt: null }, data: { revokedAt } });
  if (updated.count === 0) throw new ConflictError("This invitation changed meanwhile. Reload the page.");
  await writeAudit({
    userId: session.user.id,
    action: "INVITE_REVOKED",
    targetType: "InviteToken",
    targetId: id,
    outcome: "success",
    metadata: { email: invite.email },
  });
  return NextResponse.json({ ok: true, revokedAt: revokedAt.toISOString() });
});
