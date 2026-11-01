import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { forgetSessionState } from "@/lib/session-state";
import { requireAdmin } from "@/lib/rbac";
import { notify } from "@/lib/notify";
import { ForbiddenError, NotFoundError, withApiErrors } from "@/lib/api-error";

interface RouteContext {
  params: Promise<{ teacherId: string }>;
}

export const POST = withApiErrors(async function POST(_req: Request, { params }: RouteContext) {
  const session = await requireAdmin();
  if (!session) return new ForbiddenError("Forbidden").toResponse();

  const { teacherId } = await params;
  const teacher = await prisma.user.findFirst({ where: { id: teacherId, role: "TEACHER" } });
  if (!teacher) return new NotFoundError("Teacher not found").toResponse();

  const updated = await prisma.user.update({
    where: { id: teacherId },
    data: { active: !teacher.active },
  });
  // Deactivation ends the user's sessions on their next request.
  forgetSessionState(teacherId);

  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: updated.active ? "ENABLE_TEACHER" : "DISABLE_TEACHER",
      targetType: "User",
      targetId: teacherId,
    },
  });

  if (updated.active) {
    await notify(teacherId, {
      title: "Account activated",
      body: "Your teacher account has been activated. You can now access the platform.",
      href: "/teacher",
    }).catch(() => {});
  } else {
    await notify(teacherId, {
      title: "Account deactivated",
      body: "Your teacher account has been deactivated. Contact an administrator for more information.",
    }).catch(() => {});
  }

  return NextResponse.json({ active: updated.active });
});
