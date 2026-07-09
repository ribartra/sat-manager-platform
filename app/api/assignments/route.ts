import { NextRequest, NextResponse } from "next/server";
import { requireTeacherOrAdmin } from "@/lib/rbac";
import prisma from "@/lib/prisma";
import { notifyUser } from "@/lib/notifications";
import { studentAccessWhereFor } from "@/lib/program-scope";

export async function POST(req: NextRequest) {
  const session = await requireTeacherOrAdmin();
  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { studentIds, practiceSetIds, dueDate, unlockAt, locked } = await req.json();
  const requestedStudentIds = Array.isArray(studentIds) ? studentIds.filter((id) => typeof id === "string") : [];
  const requestedPracticeSetIds = Array.isArray(practiceSetIds) ? practiceSetIds.filter((id) => typeof id === "string") : [];

  if (requestedStudentIds.length === 0 || requestedPracticeSetIds.length === 0) {
    return NextResponse.json({ error: "Student and practice set selection is required." }, { status: 400 });
  }

  const [allowedStudents, publishedPracticeSets] = await Promise.all([
    prisma.user.findMany({
      where: {
        id: { in: requestedStudentIds },
        ...studentAccessWhereFor(session.user),
      },
      select: { id: true },
    }),
    prisma.practiceSet.findMany({
      where: { id: { in: requestedPracticeSetIds }, status: "PUBLISHED" },
      select: { id: true, name: true },
    }),
  ]);

  const allowedStudentIds = new Set(allowedStudents.map((student) => student.id));
  const publishedPracticeSetIds = new Set(publishedPracticeSets.map((practiceSet) => practiceSet.id));
  const inaccessibleStudentIds = requestedStudentIds.filter((studentId) => !allowedStudentIds.has(studentId));
  const unavailablePracticeSetIds = requestedPracticeSetIds.filter((practiceSetId) => !publishedPracticeSetIds.has(practiceSetId));

  if (inaccessibleStudentIds.length > 0) {
    return NextResponse.json({ error: "One or more students are outside your program scope." }, { status: 403 });
  }

  if (unavailablePracticeSetIds.length > 0) {
    return NextResponse.json({ error: "Only published practice sets can be assigned." }, { status: 400 });
  }

  const results = [];
  for (const studentId of requestedStudentIds) {
    for (const practiceSetId of requestedPracticeSetIds) {
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
        const practiceSet = publishedPracticeSets.find((set) => set.id === practiceSetId);
        await notifyUser(
          studentId,
          "New practice set assigned",
          practiceSet?.name ?? "A practice set was assigned.",
          "/student"
        );
        await prisma.auditLog.create({
          data: {
            userId: session.user.id,
            action: "ASSIGN_PRACTICE_SET",
            targetType: "Assignment",
            targetId: a.id,
            metadata: JSON.stringify({ studentId, practiceSetId, dueDate, unlockAt, locked: locked ?? false }),
          },
        });
        results.push(a as never);
      }
    }
  }

  return NextResponse.json({ created: results.length });
}
