import prisma from "@/lib/prisma";
import { markOverdueAssignments, releaseScheduledUnlocks } from "@/lib/assignments";

/**
 * In-app deadline reminders (RF-42), run on a schedule (hourly cron → internal route) and safe
 * to re-run: each reminder is identified by its readable text (it names the set/exam and the
 * due date), so the same one is never created twice for a student.
 * - "due soon": the due date falls on the next calendar day in the academy time zone.
 * - "overdue": the due date passed and it is still open; sent once per due date.
 * Scheduled unlocks are released (and announced) by releaseScheduledUnlocks.
 */
const TIME_ZONE = "America/Lima";
const DEDUPE_WINDOW_DAYS = 60;
const OPEN_STATUSES = ["PENDING", "IN_PROGRESS", "OVERDUE"];

const dayKey = (date: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE }).format(date); // YYYY-MM-DD
const shortDate = (date: Date) => new Intl.DateTimeFormat("en-US", { timeZone: TIME_ZONE, month: "short", day: "numeric" }).format(date);

async function notifyOnce(userId: string, title: string, body: string, href: string, since: Date) {
  const existing = await prisma.notification.findFirst({
    where: { userId, title, body, createdAt: { gte: since } },
    select: { id: true },
  });
  if (existing) return false;
  await prisma.notification.create({ data: { userId, title, body, href } });
  return true;
}

export interface DeadlineNotificationSummary {
  dueSoon: number;
  overdue: number;
  unlocked: number;
  created: number;
  at: string;
}

export async function generateDeadlineNotifications(now = new Date()): Promise<DeadlineNotificationSummary> {
  const since = new Date(now.getTime() - DEDUPE_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const tomorrowKey = dayKey(new Date(now.getTime() + 24 * 60 * 60 * 1000));
  // Wide window, then match the local calendar day exactly.
  const soonWindow = { gte: now, lt: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000) };

  await markOverdueAssignments(now);
  const unlocked = await releaseScheduledUnlocks(now);

  const [practiceSoon, examSoon, practiceOverdue, examOverdue] = await Promise.all([
    prisma.assignment.findMany({
      where: { dueDate: soonWindow, status: { in: ["PENDING", "IN_PROGRESS"] } },
      select: { studentId: true, dueDate: true, practiceSet: { select: { name: true } } },
    }),
    prisma.fullPracticeTestAssignment.findMany({
      where: { dueDate: soonWindow, status: { in: ["PENDING", "IN_PROGRESS"] } },
      select: { studentId: true, dueDate: true, test: { select: { name: true } } },
    }),
    prisma.assignment.findMany({
      where: { dueDate: { lt: now }, status: { in: OPEN_STATUSES } },
      select: { studentId: true, dueDate: true, practiceSet: { select: { name: true } } },
    }),
    prisma.fullPracticeTestAssignment.findMany({
      where: { dueDate: { lt: now }, status: { in: OPEN_STATUSES } },
      select: { studentId: true, dueDate: true, test: { select: { name: true } } },
    }),
  ]);

  const soon = [
    ...practiceSoon.map((a) => ({ studentId: a.studentId, dueDate: a.dueDate!, name: a.practiceSet.name, kind: "Practice Set" as const })),
    ...examSoon.map((a) => ({ studentId: a.studentId, dueDate: a.dueDate!, name: a.test.name, kind: "Exam" as const })),
  ].filter((item) => dayKey(item.dueDate) === tomorrowKey);
  const overdue = [
    ...practiceOverdue.map((a) => ({ studentId: a.studentId, dueDate: a.dueDate!, name: a.practiceSet.name, kind: "Practice Set" as const })),
    ...examOverdue.map((a) => ({ studentId: a.studentId, dueDate: a.dueDate!, name: a.test.name, kind: "Exam" as const })),
  ];

  let created = unlocked;
  for (const item of soon) {
    const href = item.kind === "Exam" ? "/student/content-map?area=mocks" : "/student";
    if (await notifyOnce(item.studentId, `${item.kind} due soon`, `${item.name} is due tomorrow (${shortDate(item.dueDate)}).`, href, since)) created += 1;
  }
  for (const item of overdue) {
    const href = item.kind === "Exam" ? "/student/content-map?area=mocks" : "/student";
    if (await notifyOnce(item.studentId, `${item.kind} overdue`, `${item.name} was due ${shortDate(item.dueDate)} and is not submitted yet.`, href, since)) created += 1;
  }

  return { dueSoon: soon.length, overdue: overdue.length, unlocked, created, at: now.toISOString() };
}
