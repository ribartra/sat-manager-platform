import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { forgetSessionState } from "@/lib/session-state";
import { requireAdmin } from "@/lib/rbac";
import { BadRequestError, ForbiddenError, NotFoundError, withApiErrors } from "@/lib/api-error";

interface RouteContext {
  params: Promise<{ userId: string }>;
}

export const POST = withApiErrors(async function POST(_req: Request, { params }: RouteContext) {
  const session = await requireAdmin();
  if (!session) return new ForbiddenError("Forbidden").toResponse();

  const { userId } = await params;
  if (userId === session.user.id) {
    return new BadRequestError("Administrators cannot disable their own account.").toResponse();
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return new NotFoundError("User not found.").toResponse();

  const updated = await prisma.user.update({
    where: { id: userId },
    data: { active: !user.active },
    select: { id: true, active: true },
  });
  // Deactivation ends the user's sessions on their next request.
  forgetSessionState(userId);

  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: updated.active ? "ENABLE_USER" : "DISABLE_USER",
      targetType: "User",
      targetId: userId,
      metadata: JSON.stringify({ role: user.role }),
    },
  });

  return NextResponse.json(updated);
});
