import { NextRequest, NextResponse } from "next/server";
import { requireTeacherOrAdmin } from "@/lib/rbac";
import prisma from "@/lib/prisma";
import { notifyUser } from "@/lib/notifications";

export async function POST(req: NextRequest) {
  const session = await requireTeacherOrAdmin();
  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { studentIds, practiceSetIds, dueDate, unlockAt, locked } = await req.json();

  const results = [];
  for (const studentId of studentIds) {
    for (const practiceSetId of practiceSetIds) {
      const existing = await prisma.assignment.findFirst({
        where: { studentId, practiceSetId },
      });
      if (!existing) {
        const a = await prisma.assignment.create({
          data: {
            studentId,
            practiceSetId,
            assignedById: session.user.id,
            dueDate: dueDate ? new Date(dueDate) : null,
            unlockAt: unlockAt ? new Date(unlockAt) : null,
            locked: locked ?? false,
            status: "PENDING",
          },
        });
        const practiceSet = await prisma.practiceSet.findUnique({ where: { id: practiceSetId }, select: { name: true } });
        await notifyUser(
          studentId,
          "New practice set assigned",
          practiceSet?.name ?? "A practice set was assigned.",
          "/student"
        );
        results.push(a as never);
      }
    }
  }

  return NextResponse.json({ created: results.length });
}
