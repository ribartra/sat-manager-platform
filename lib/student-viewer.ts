import { cookies } from "next/headers";
import type { Session } from "next-auth";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { studentAccessWhereFor } from "@/lib/program-scope";
import { withSqliteRetry } from "@/lib/sqlite-retry";

/**
 * Student view (a teacher looking at a student's own pages, read only). Started by
 * /teacher/impersonate/[studentId], ended by /api/student-view/exit; it lasts across every student
 * view until then (and teacher pages send back to it).
 */
export const STUDENT_VIEW_COOKIE = "sat_student_view";

export interface StudentViewer {
  session: Session;
  /** The student whose pages are shown. */
  studentId: string;
  studentName: string;
  /** A teacher / admin in Student view: nothing is written as the student. */
  readOnly: boolean;
}

/** The student a teacher / admin may view: re-checked on every request (an old cookie never widens access). */
export async function viewableStudent(user: { id: string; role: string }, studentId: string) {
  if (!["TEACHER", "ADMIN"].includes(user.role) || !studentId) return null;
  return withSqliteRetry(() =>
    prisma.user.findFirst({ where: { id: studentId, ...studentAccessWhereFor(user) }, select: { id: true, name: true, email: true } }),
  );
}

/** The teacher / admin's Student view in this browser, if any (and still allowed). */
export async function currentStudentView(session: Session | null) {
  if (!session) return null;
  const studentId = (await cookies()).get(STUDENT_VIEW_COOKIE)?.value;
  if (!studentId) return null;
  return viewableStudent(session.user, studentId);
}

/**
 * Who the student pages are about: the signed-in student, or the student of the teacher's Student
 * view (read only). null = nobody (the page sends the user away).
 */
export async function getStudentViewer(): Promise<StudentViewer | null> {
  const session = await auth();
  if (!session) return null;
  if (session.user.role === "STUDENT") {
    return { session, studentId: session.user.id, studentName: session.user.name ?? "", readOnly: false };
  }
  const viewed = await currentStudentView(session);
  return viewed ? { session, studentId: viewed.id, studentName: viewed.name, readOnly: true } : null;
}

/** Cookie options of the Student view: this browser session only. */
export const STUDENT_VIEW_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax" as const,
  path: "/",
  secure: process.env.NODE_ENV === "production",
};
