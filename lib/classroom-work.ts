import prisma from "@/lib/prisma";
import { studentAccessWhereFor } from "@/lib/program-scope";
import { OPEN_CLASSROOM_WHERE, finishClassroomAssignment } from "@/lib/assignments";
import { shortSetName } from "@/lib/student-report";

export interface OpenClassroomStudent {
  id: string;
  name: string;
  sets: { assignmentId: string; name: string }[];
}

/**
 * Open Classroom work of a teacher's students (the ones they may see: studentAccessWhereFor), grouped
 * by student. `studentIds` narrows it (e.g. one student's page).
 */
export async function openClassroomWorkFor(user: { id: string; role: string }, studentIds?: string[]): Promise<OpenClassroomStudent[]> {
  const rows = await prisma.assignment.findMany({
    where: {
      ...OPEN_CLASSROOM_WHERE,
      student: { ...studentAccessWhereFor(user), ...(studentIds ? { id: { in: studentIds } } : {}) },
    },
    select: { id: true, student: { select: { id: true, name: true } }, practiceSet: { select: { name: true } } },
    orderBy: [{ student: { name: "asc" } }, { createdAt: "asc" }],
  });
  const byStudent = new Map<string, OpenClassroomStudent>();
  for (const row of rows) {
    const entry = byStudent.get(row.student.id) ?? byStudent.set(row.student.id, { id: row.student.id, name: row.student.name, sets: [] }).get(row.student.id)!;
    entry.sets.push({ assignmentId: row.id, name: shortSetName(row.practiceSet.name) });
  }
  return [...byStudent.values()];
}

/** Finishes the open Classroom work of those students (all of the teacher's when omitted). Returns the count. */
export async function finishClassroomWork(user: { id: string; role: string }, studentIds?: string[]) {
  const rows = await prisma.assignment.findMany({
    where: {
      ...OPEN_CLASSROOM_WHERE,
      student: { ...studentAccessWhereFor(user), ...(studentIds ? { id: { in: studentIds } } : {}) },
    },
    select: { id: true, studentId: true, practiceSetId: true },
  });
  let finished = 0;
  for (const row of rows) {
    if (await finishClassroomAssignment(row, { closedById: user.id, action: "CLASSROOM_FINISHED_BY_TEACHER" })) finished += 1;
  }
  return finished;
}
