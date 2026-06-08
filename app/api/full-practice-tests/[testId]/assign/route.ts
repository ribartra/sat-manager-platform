import { NextRequest, NextResponse } from "next/server";
import { requireTeacherOrAdmin } from "@/lib/rbac";
import prisma from "@/lib/prisma";
import { notifyUser } from "@/lib/notifications";

interface RouteContext {
  params: Promise<{ testId: string }>;
}

export async function POST(req: NextRequest, { params }: RouteContext) {
  const session = await requireTeacherOrAdmin();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { testId } = await params;
  const { studentIds, dueDate } = await req.json();
  let created = 0;
  const test = await prisma.fullPracticeTest.findUnique({ where: { id: testId } });

  for (const studentId of studentIds as string[]) {
    const existing = await prisma.fullPracticeTestAssignment.findFirst({ where: { testId, studentId } });
    if (existing) continue;
    await prisma.fullPracticeTestAssignment.create({
      data: { testId, studentId, assignedById: session.user.id, dueDate: dueDate ? new Date(dueDate) : null },
    });
    await notifyUser(studentId, "Full Practice Test assigned", test?.name ?? "A full test was assigned.", "/student/full-tests");
    created += 1;
  }
  return NextResponse.json({ created });
}
