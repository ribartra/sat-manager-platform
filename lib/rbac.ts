import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

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
