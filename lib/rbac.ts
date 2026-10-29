import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { ForbiddenError, UnauthorizedError } from "@/lib/api-error";

export async function requireTeacherOrAdmin() {
  const session = await auth();
  if (!session || !["TEACHER", "ADMIN"].includes(session.user.role)) {
    return null;
  }

  if (session.user.role === "TEACHER") {
    const teacher = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { active: true, validationStatus: true },
    });
    if (!teacher?.active || teacher.validationStatus !== "APPROVED") return null;
  }

  return session;
}

export async function requireAdmin() {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") return null;
  const admin = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { active: true, validationStatus: true },
  });
  if (!admin?.active || admin.validationStatus !== "APPROVED") return null;
  return session;
}

/**
 * Master teacher (Teachers menu): an approved, active TEACHER whose account has canManageTeachers.
 * Re-checked against the DB on every call, never trusted from the JWT. Only the SAT Teacher account
 * has the flag (migration 20261028_teacher_manager). Managing teachers never grants access to another
 * teacher's students' data.
 */
export async function requireTeacherManager() {
  const session = await auth();
  if (!session || session.user.role !== "TEACHER") return null;
  const teacher = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { active: true, validationStatus: true, role: true, canManageTeachers: true },
  });
  if (!teacher?.active || teacher.validationStatus !== "APPROVED" || teacher.role !== "TEACHER" || !teacher.canManageTeachers) return null;
  return session;
}

/**
 * Content importer ("Import with AI", AI Import source): an ADMIN, or the master teacher
 * (canManageTeachers). Re-checked against the DB like the helpers above.
 */
export async function requireContentImporter() {
  return (await requireAdmin()) ?? (await requireTeacherManager());
}

export async function requireApprovedSession() {
  const session = await auth();
  if (!session) return null;

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { active: true, validationStatus: true },
  });

  if (!user?.active || user.validationStatus !== "APPROVED") return null;
  return session;
}

// Throwing variants for handlers wrapped in withApiErrors (lib/api-error.ts): no session → 401,
// wrong role / inactive / unapproved → 403, in the shared error format.
export async function assertApprovedSession() {
  const session = await requireApprovedSession();
  if (!session) throw new UnauthorizedError();
  return session;
}

export async function assertTeacherOrAdmin() {
  const session = await requireTeacherOrAdmin();
  if (!session) throw new ForbiddenError();
  return session;
}

export async function assertAdmin() {
  const session = await requireAdmin();
  if (!session) throw new ForbiddenError();
  return session;
}

export async function assertTeacherManager() {
  const session = await requireTeacherManager();
  if (!session) throw new ForbiddenError();
  return session;
}

export async function assertContentImporter() {
  const session = await requireContentImporter();
  if (!session) throw new ForbiddenError();
  return session;
}
