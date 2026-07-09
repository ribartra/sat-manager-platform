import "dotenv/config";
import { PrismaClient } from "../app/generated/prisma/client.js";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { PrismaBetterSqlite3 } = require("@prisma/adapter-better-sqlite3");

const url = process.env.DATABASE_URL ?? "file:./prisma/dev.db";
const adapter = new PrismaBetterSqlite3({ url });
const prisma = new PrismaClient({ adapter });

function dayWindow(now: Date) {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

async function notifyOnce(userId: string, title: string, body: string, href: string, key: string) {
  const existing = await prisma.notification.findFirst({
    where: {
      userId,
      title,
      body: { contains: key },
      createdAt: { gte: new Date(Date.now() - 1000 * 60 * 60 * 24 * 14) },
    },
    select: { id: true },
  });
  if (existing) return false;
  await prisma.notification.create({ data: { userId, title, body: `${body} [${key}]`, href } });
  return true;
}

async function main() {
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowWindow = dayWindow(tomorrow);
  const todayWindow = dayWindow(now);

  const [dueSoon, overdue, scheduledUnlocks] = await Promise.all([
    prisma.assignment.findMany({
      where: {
        dueDate: { gte: tomorrowWindow.start, lt: tomorrowWindow.end },
        status: { in: ["PENDING", "IN_PROGRESS"] },
      },
      include: { student: true, practiceSet: true },
    }),
    prisma.assignment.findMany({
      where: {
        dueDate: { lt: todayWindow.start },
        status: { in: ["PENDING", "IN_PROGRESS", "OVERDUE"] },
      },
      include: { student: true, practiceSet: true },
    }),
    prisma.assignment.findMany({
      where: {
        locked: true,
        unlockAt: { lte: now },
      },
      include: { student: true, practiceSet: true },
    }),
  ]);

  let created = 0;
  for (const assignment of dueSoon) {
    const key = `due-soon:${assignment.id}:${tomorrowWindow.start.toISOString().slice(0, 10)}`;
    if (await notifyOnce(
      assignment.studentId,
      "Practice Set due soon",
      `${assignment.practiceSet.name} is due tomorrow.`,
      "/student",
      key
    )) created += 1;
  }

  for (const assignment of overdue) {
    const key = `overdue:${assignment.id}:${todayWindow.start.toISOString().slice(0, 10)}`;
    if (await notifyOnce(
      assignment.studentId,
      "Practice Set overdue",
      `${assignment.practiceSet.name} is overdue.`,
      "/student",
      key
    )) created += 1;
  }

  for (const assignment of scheduledUnlocks) {
    const key = `scheduled-unlock:${assignment.id}`;
    await prisma.assignment.update({
      where: { id: assignment.id },
      data: { locked: false, unlockAt: null },
    });
    if (await notifyOnce(
      assignment.studentId,
      "Practice Set unlocked",
      `${assignment.practiceSet.name} is available now.`,
      "/student",
      key
    )) created += 1;
  }

  console.info(JSON.stringify({
    level: "info",
    event: "notifications.generated",
    dueSoon: dueSoon.length,
    overdue: overdue.length,
    scheduledUnlocks: scheduledUnlocks.length,
    created,
    at: now.toISOString(),
  }));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
