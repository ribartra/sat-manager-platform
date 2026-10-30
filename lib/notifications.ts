import prisma from "@/lib/prisma";

export async function notifyUser(userId: string, title: string, body?: string, href?: string) {
  return prisma.notification.create({
    data: { userId, title, body: body ?? null, href: href ?? null },
  });
}

/**
 * Notify the staff who follow this student: the owner teacher of each active enrollment (the teacher
 * who invited the student; when an enrollment has none, the program's current teachers) plus the
 * admins. Not every teacher of the platform. One insert for everybody.
 */
export async function notifyStudentTeachers(studentId: string, title: string, body?: string, href?: string) {
  const [enrollments, admins] = await Promise.all([
    prisma.programEnrollment.findMany({
      where: { studentId, status: "APPROVED", active: true },
      select: { teacherId: true, program: { select: { teachers: { where: { endDate: null }, select: { teacherId: true } } } } },
    }),
    prisma.user.findMany({ where: { role: "ADMIN", active: true }, select: { id: true } }),
  ]);
  const recipients = new Set<string>(admins.map((admin) => admin.id));
  for (const enrollment of enrollments) {
    if (enrollment.teacherId) recipients.add(enrollment.teacherId);
    else for (const teacher of enrollment.program.teachers) recipients.add(teacher.teacherId);
  }
  if (recipients.size === 0) return;
  await prisma.notification.createMany({
    data: [...recipients].map((userId) => ({ userId, title, body: body ?? null, href: href ?? null })),
  });
}
