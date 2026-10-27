import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { forgetSessionState } from "@/lib/session-state";
import { assertTeacherManager } from "@/lib/rbac";
import { notify } from "@/lib/notify";
import { BadRequestError, NotFoundError, withApiErrors } from "@/lib/api-error";

interface RouteContext {
  params: Promise<{ teacherId: string }>;
}

/**
 * Master teacher deactivates ("dar de baja") or reactivates a teacher (Teachers menu). Only accounts
 * with User.canManageTeachers; only role: "TEACHER" targets, never yourself (admins are not teachers).
 * Same effect as the admin toggle: the teacher's sessions end on their next request.
 */
export const POST = withApiErrors(async function POST(_req: Request, { params }: RouteContext) {
  const session = await assertTeacherManager();
  const { teacherId } = await params;
  if (teacherId === session.user.id) throw new BadRequestError("You can't deactivate your own account.");
  const teacher = await prisma.user.findFirst({ where: { id: teacherId, role: "TEACHER" }, select: { id: true, active: true } });
  if (!teacher) throw new NotFoundError("Teacher not found");

  const updated = await prisma.user.update({ where: { id: teacherId }, data: { active: !teacher.active }, select: { active: true } });
  forgetSessionState(teacherId);
  await prisma.auditLog.create({
    data: { userId: session.user.id, action: updated.active ? "ENABLE_TEACHER" : "DISABLE_TEACHER", targetType: "User", targetId: teacherId, metadata: JSON.stringify({ by: "master_teacher" }) },
  });
  await notify(teacherId, updated.active
    ? { title: "Account activated", body: "Your teacher account has been activated. You can now access the platform.", href: "/teacher" }
    : { title: "Account deactivated", body: "Your teacher account has been deactivated. Contact the SAT team for more information." },
  ).catch(() => {});
  return NextResponse.json({ active: updated.active });
});
