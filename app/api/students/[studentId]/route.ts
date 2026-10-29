import { NextRequest, NextResponse } from "next/server";
import { requireTeacherOrAdmin } from "@/lib/rbac";
import prisma from "@/lib/prisma";
import { studentAccessWhereFor } from "@/lib/program-scope";
import { ForbiddenError, NotFoundError, withApiErrors } from "@/lib/api-error";
import { formatPersonName } from "@/lib/person-name";

interface RouteContext {
  params: Promise<{ studentId: string }>;
}

export const PUT = withApiErrors(async function PUT(req: NextRequest, { params }: RouteContext) {
  const session = await requireTeacherOrAdmin();
  if (!session) {
    return new ForbiddenError("Forbidden").toResponse();
  }

  const { studentId } = await params;
  const { name: nameRaw, email, phone, startDate, active } = await req.json();
  const name = nameRaw === undefined ? undefined : formatPersonName(String(nameRaw));

  const student = await prisma.user.findFirst({
    where: { id: studentId, ...studentAccessWhereFor(session.user) },
    select: { id: true },
  });
  if (!student) {
    return new NotFoundError("Not found").toResponse();
  }

  const updated = await prisma.user.update({
    where: { id: studentId },
    data: {
      name,
      email,
      phone: phone || null,
      startDate: startDate ? new Date(startDate) : null,
      active: Boolean(active),
    },
    // Never return the password hash or session fields.
    select: { id: true, name: true, email: true, phone: true, startDate: true, active: true, role: true },
  });

  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: "UPDATE_STUDENT",
      targetType: "User",
      targetId: studentId,
      metadata: JSON.stringify({ name, email, phone: phone || null, startDate: startDate || null, active: Boolean(active) }),
    },
  });

  return NextResponse.json(updated);
});
