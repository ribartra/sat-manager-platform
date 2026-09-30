import { NextRequest, NextResponse } from "next/server";
import { requireTeacherOrAdmin } from "@/lib/rbac";
import prisma from "@/lib/prisma";
import { studentAccessWhereFor } from "@/lib/program-scope";
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError, withApiErrors } from "@/lib/api-error";

async function allowedStudentIdsFor(sessionUser: { id: string; role: string }, studentIds: string[]) {
  if (studentIds.length === 0) return new Set<string>();
  const students = await prisma.user.findMany({
    where: { id: { in: studentIds }, ...studentAccessWhereFor(sessionUser) },
    select: { id: true },
  });
  return new Set(students.map((student) => student.id));
}

async function parentVisibleFor(sessionUser: { id: string; role: string }, parentId: string) {
  if (sessionUser.role === "ADMIN") return true;
  const parent = await prisma.user.findFirst({
    where: {
      id: parentId,
      role: "PARENT",
      parentLinks: { some: { student: studentAccessWhereFor(sessionUser) } },
    },
    select: { id: true },
  });
  return Boolean(parent);
}

export const POST = withApiErrors(async function POST(req: NextRequest) {
  const session = await requireTeacherOrAdmin();
  if (!session) return new ForbiddenError("Forbidden").toResponse();
  const { name, email, phone, studentIds } = await req.json();
  if (!name || !email) {
    return new BadRequestError("Name and email are required.").toResponse();
  }
  const requestedStudentIds = Array.isArray(studentIds) ? studentIds.filter((id) => typeof id === "string") : [];
  const allowedStudentIds = await allowedStudentIdsFor(session.user, requestedStudentIds);
  if (requestedStudentIds.some((studentId) => !allowedStudentIds.has(studentId))) {
    return new ForbiddenError("One or more students are outside your program scope.").toResponse();
  }
  const normalizedEmail = String(email).trim().toLowerCase();
  const existingParent = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (existingParent && existingParent.role !== "PARENT") {
    return new ConflictError("A non-parent user already uses that email.").toResponse();
  }
  if (existingParent?.role === "PARENT" && !(await parentVisibleFor(session.user, existingParent.id)) && requestedStudentIds.length === 0) {
    return new ForbiddenError("Parent is outside your program scope.").toResponse();
  }

  const parent = await prisma.user.upsert({
    where: { email: normalizedEmail },
    update: {
      name,
      phone: phone || null,
      role: "PARENT",
      active: true,
      validationStatus: "APPROVED",
      validationReviewedAt: new Date(),
    },
    create: {
      name,
      email: normalizedEmail,
      phone: phone || null,
      role: "PARENT",
      active: true,
      validationStatus: "APPROVED",
      validationReviewedAt: new Date(),
    },
  });
  await Promise.all(
    requestedStudentIds.map((studentId) =>
      prisma.parentStudent.upsert({
        where: { parentId_studentId: { parentId: parent.id, studentId } },
        update: { authorizedAt: new Date() },
        create: { parentId: parent.id, studentId, authorizedAt: new Date() },
      })
    )
  );
  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: "UPDATE_PARENT",
      targetType: "User",
      targetId: parent.id,
      metadata: JSON.stringify({ email: normalizedEmail, linkedStudentIds: requestedStudentIds }),
    },
  });
  return NextResponse.json(parent);
});

export const PATCH = withApiErrors(async function PATCH(req: NextRequest) {
  const session = await requireTeacherOrAdmin();
  if (!session) return new ForbiddenError("Forbidden").toResponse();

  const { action, parentId, studentId, studentIds, name, email, phone } = await req.json();
  const parent = await prisma.user.findFirst({ where: { id: parentId, role: "PARENT" } });
  if (!parent) return new NotFoundError("Parent not found.").toResponse();
  if (!(await parentVisibleFor(session.user, parent.id))) {
    return new ForbiddenError("Parent is outside your program scope.").toResponse();
  }

  if (action === "update") {
    if (!name || !email) return new BadRequestError("Name and email are required.").toResponse();
    const requestedStudentIds = Array.isArray(studentIds) ? studentIds.filter((id) => typeof id === "string") : null;
    if (requestedStudentIds) {
      const allowedStudentIds = await allowedStudentIdsFor(session.user, requestedStudentIds);
      if (requestedStudentIds.some((id) => !allowedStudentIds.has(id))) {
        return new ForbiddenError("One or more students are outside your program scope.").toResponse();
      }
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const emailOwner = await prisma.user.findUnique({ where: { email: normalizedEmail }, select: { id: true, role: true } });
    if (emailOwner && emailOwner.id !== parent.id) {
      return new ConflictError("Another user already uses that email.").toResponse();
    }
    if (emailOwner && emailOwner.role !== "PARENT") {
      return new ConflictError("A non-parent user already uses that email.").toResponse();
    }
    const updated = await prisma.user.update({
      where: { id: parent.id },
      data: { name, email: normalizedEmail, phone: phone || null, active: true, validationStatus: "APPROVED" },
    });
    if (requestedStudentIds) {
      const currentLinks = await prisma.parentStudent.findMany({
        where: {
          parentId: parent.id,
          ...(session.user.role === "ADMIN" ? {} : { student: studentAccessWhereFor(session.user) }),
        },
        select: { studentId: true },
      });
      const nextIds = new Set(requestedStudentIds);
      const currentIds = new Set(currentLinks.map((link) => link.studentId));

      await Promise.all([
        ...requestedStudentIds
          .filter((id) => !currentIds.has(id))
          .map((id) =>
            prisma.parentStudent.create({ data: { parentId: parent.id, studentId: id, authorizedAt: new Date() } })
          ),
        ...currentLinks
          .filter((link) => !nextIds.has(link.studentId))
          .map((link) =>
            prisma.parentStudent.delete({ where: { parentId_studentId: { parentId: parent.id, studentId: link.studentId } } })
          ),
      ]);
    }
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "UPDATE_PARENT",
        targetType: "User",
        targetId: parent.id,
        metadata: JSON.stringify({ email: normalizedEmail, studentIds: requestedStudentIds }),
      },
    });
    return NextResponse.json(updated);
  }

  if (!studentId || typeof studentId !== "string") {
    return new BadRequestError("Student is required.").toResponse();
  }
  const allowedStudentIds = await allowedStudentIdsFor(session.user, [studentId]);
  if (!allowedStudentIds.has(studentId)) {
    return new ForbiddenError("Student is outside your program scope.").toResponse();
  }

  if (action === "link") {
    await prisma.parentStudent.upsert({
      where: { parentId_studentId: { parentId: parent.id, studentId } },
      update: { authorizedAt: new Date() },
      create: { parentId: parent.id, studentId, authorizedAt: new Date() },
    });
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "LINK_PARENT_STUDENT",
        targetType: "ParentStudent",
        targetId: `${parent.id}:${studentId}`,
      },
    });
    return NextResponse.json({ ok: true });
  }

  if (action === "unlink") {
    await prisma.parentStudent.delete({
      where: { parentId_studentId: { parentId: parent.id, studentId } },
    }).catch(() => null);
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "UNLINK_PARENT_STUDENT",
        targetType: "ParentStudent",
        targetId: `${parent.id}:${studentId}`,
      },
    });
    return NextResponse.json({ ok: true });
  }

  return new BadRequestError("Unsupported action.").toResponse();
});
