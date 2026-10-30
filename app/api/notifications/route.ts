import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireApprovedSession } from "@/lib/rbac";
import { UnauthorizedError, withApiErrors } from "@/lib/api-error";

// GET /api/notifications — the latest 10 for the bell, plus the total and unread counts (the rest
// is on /notifications, behind "See all N notifications").
export const GET = withApiErrors(async function GET() {
  const session = await requireApprovedSession();
  if (!session) return new UnauthorizedError("Unauthorized").toResponse();

  const where = { userId: session.user.id };
  const [notifications, total, unread] = await Promise.all([
    prisma.notification.findMany({ where, orderBy: { createdAt: "desc" }, take: 10 }),
    prisma.notification.count({ where }),
    prisma.notification.count({ where: { ...where, readAt: null } }),
  ]);

  return NextResponse.json({ notifications, total, unread });
});

// PATCH /api/notifications — mark all unread as read
export const PATCH = withApiErrors(async function PATCH() {
  const session = await requireApprovedSession();
  if (!session) return new UnauthorizedError("Unauthorized").toResponse();

  await prisma.notification.updateMany({
    where: { userId: session.user.id, readAt: null },
    data: { readAt: new Date() },
  });

  return NextResponse.json({ ok: true });
});
