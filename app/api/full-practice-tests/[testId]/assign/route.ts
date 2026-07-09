import { NextRequest, NextResponse } from "next/server";
import { requireTeacherOrAdmin } from "@/lib/rbac";
import prisma from "@/lib/prisma";
import { notifyUser } from "@/lib/notifications";
import { studentAccessWhereFor } from "@/lib/program-scope";

interface RouteContext {
  params: Promise<{ testId: string }>;
}

export async function POST(req: NextRequest, { params }: RouteContext) {
  const session = await requireTeacherOrAdmin();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { testId } = await params;
  const { studentIds, dueDate } = await req.json();
  const requestedStudentIds = Array.isArray(studentIds) ? studentIds.filter((id) => typeof id === "string") : [];
  if (requestedStudentIds.length === 0) {
    return NextResponse.json({ error: "Student selection is required." }, { status: 400 });
  }

  let created = 0;
  const test = await prisma.fullPracticeTest.findUnique({ where: { id: testId } });
  if (!test) return NextResponse.json({ error: "Exam not found." }, { status: 404 });

  const allowedStudents = await prisma.user.findMany({
    where: { id: { in: requestedStudentIds }, ...studentAccessWhereFor(session.user) },
    select: { id: true },
  });
  const allowedStudentIds = new Set(allowedStudents.map((student) => student.id));
  if (requestedStudentIds.some((studentId) => !allowedStudentIds.has(studentId))) {
    return NextResponse.json({ error: "One or more students are outside your program scope." }, { status: 403 });
  }

  for (const studentId of requestedStudentIds) {
    const existing = await prisma.fullPracticeTestAssignment.findFirst({ where: { testId, studentId } });
    if (existing) continue;
    const assignment = await prisma.fullPracticeTestAssignment.create({
      data: { testId, studentId, assignedById: session.user.id, dueDate: dueDate ? new Date(dueDate) : null },
    });
    await notifyUser(studentId, "Exam assigned", test.name, "/student/full-tests");
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "ASSIGN_FULL_PRACTICE_TEST",
        targetType: "FullPracticeTestAssignment",
        targetId: assignment.id,
        metadata: JSON.stringify({ studentId, testId, dueDate: dueDate || null }),
      },
    });
    created += 1;
  }
  return NextResponse.json({ created });
}
