import prisma from "@/lib/prisma";

interface NotifyOpts {
  title: string;
  body?: string;
  href?: string;
}

export async function notify(userId: string, opts: NotifyOpts) {
  return prisma.notification.create({
    data: { userId, title: opts.title, body: opts.body ?? null, href: opts.href ?? null },
  });
}

export async function notifyMany(userIds: string[], opts: NotifyOpts) {
  if (userIds.length === 0) return;
  return prisma.notification.createMany({
    data: userIds.map((userId) => ({
      userId,
      title: opts.title,
      body: opts.body ?? null,
      href: opts.href ?? null,
    })),
  });
}
