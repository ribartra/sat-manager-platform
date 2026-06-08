import prisma from "@/lib/prisma";

export async function notifyUser(userId: string, title: string, body?: string, href?: string) {
  return prisma.notification.create({
    data: { userId, title, body: body ?? null, href: href ?? null },
  });
}

export async function notifyTeachers(title: string, body?: string, href?: string) {
  const teachers = await prisma.user.findMany({
    where: { role: { in: ["TEACHER", "ADMIN"] } },
    select: { id: true },
  });
  await Promise.all(teachers.map((teacher) => notifyUser(teacher.id, title, body, href)));
}
