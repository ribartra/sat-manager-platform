import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireTeacherOrAdmin } from "@/lib/rbac";
import prisma from "@/lib/prisma";
import { parseDueDate, upsertFullTestAssignment, type AssignmentOutcome } from "@/lib/assignments";
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

  const counts: Record<AssignmentOutcome, number> = { created: 0, updated: 0, reassigned: 0, unchanged: 0 };
  const test = await prisma.fullPracticeTest.findUnique({ where: { id: testId } });
  if (!test) return NextResponse.json({ error: "Exam not found." }, { status: 404 });
  if (test.status !== "PUBLISHED") {
    return NextResponse.json({ error: "Only published exams can be assigned." }, { status: 400 });
  }

  const allowedStudents = await prisma.user.findMany({
    where: { id: { in: requestedStudentIds }, ...studentAccessWhereFor(session.user) },
    select: { id: true },
  });
  const allowedStudentIds = new Set(allowedStudents.map((student) => student.id));
  if (requestedStudentIds.some((studentId) => !allowedStudentIds.has(studentId))) {
    return NextResponse.json({ error: "One or more students are outside your program scope." }, { status: 403 });
  }

  const touchedStudentIds = new Set<string>();
  const resolvedDueDate = parseDueDate(dueDate);
  for (const studentId of requestedStudentIds) {
    const { outcome } = await upsertFullTestAssignment({
      studentId,
      testId,
      testName: test.name,
      assignedById: session.user.id,
      dueDate: resolvedDueDate,
    });
    counts[outcome] += 1;
    touchedStudentIds.add(studentId);
  }

  revalidatePath("/student");
  revalidatePath("/student/content-map");
  for (const studentId of touchedStudentIds) {
    revalidatePath(`/teacher/students/${studentId}`);
    revalidatePath(`/teacher/impersonate/${studentId}`);
  }
  revalidatePath(`/teacher/full-tests/${testId}`);

  // `skipped` kept for older clients: assignments that needed no change.
  return NextResponse.json({ ...counts, skipped: counts.unchanged });
}
