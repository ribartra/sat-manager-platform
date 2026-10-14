import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireTeacherOrAdmin } from "@/lib/rbac";
import prisma from "@/lib/prisma";
import { parseDueDate, upsertFullTestAssignment, type AssignmentOutcome } from "@/lib/assignments";
import { studentAccessWhereFor } from "@/lib/program-scope";
import { BadRequestError, ForbiddenError, NotFoundError, withApiErrors } from "@/lib/api-error";

interface RouteContext {
  params: Promise<{ testId: string }>;
}

export const POST = withApiErrors(async function POST(req: NextRequest, { params }: RouteContext) {
  const session = await requireTeacherOrAdmin();
  if (!session) return new ForbiddenError("Forbidden").toResponse();

  const { testId } = await params;
  const { studentIds, dueDate } = await req.json();
  const requestedStudentIds = Array.isArray(studentIds) ? studentIds.filter((id) => typeof id === "string") : [];
  if (requestedStudentIds.length === 0) {
    return new BadRequestError("Student selection is required.").toResponse();
  }

  const counts: Record<AssignmentOutcome, number> = { created: 0, updated: 0, reassigned: 0, unchanged: 0 };
  const test = await prisma.fullPracticeTest.findUnique({ where: { id: testId } });
  if (!test) return new NotFoundError("Test not found.").toResponse();
  if (test.status !== "PUBLISHED") {
    return new BadRequestError("Only published exams can be assigned.").toResponse();
  }

  const allowedStudents = await prisma.user.findMany({
    where: { id: { in: requestedStudentIds }, ...studentAccessWhereFor(session.user) },
    select: { id: true },
  });
  const allowedStudentIds = new Set(allowedStudents.map((student) => student.id));
  if (requestedStudentIds.some((studentId) => !allowedStudentIds.has(studentId))) {
    return new ForbiddenError("One or more students are outside your program scope.").toResponse();
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
  revalidatePath("/student/tests");
  for (const studentId of touchedStudentIds) {
    revalidatePath(`/teacher/students/${studentId}`);
    revalidatePath(`/teacher/impersonate/${studentId}`);
  }
  revalidatePath(`/teacher/tests/${testId}`);

  // `skipped` kept for older clients: assignments that needed no change.
  return NextResponse.json({ ...counts, skipped: counts.unchanged });
});
