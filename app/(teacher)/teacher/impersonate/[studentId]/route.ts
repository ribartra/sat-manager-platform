import type { NextRequest } from "next/server";
import { relativeRedirect } from "@/lib/relative-redirect";
import prisma from "@/lib/prisma";
import { requireTeacherOrAdmin } from "@/lib/rbac";
import { studentAccessWhereFor } from "@/lib/program-scope";
import { withSqliteRetry } from "@/lib/sqlite-retry";
import { STUDENT_VIEW_COOKIE, STUDENT_VIEW_COOKIE_OPTIONS } from "@/lib/student-viewer";

export const runtime = "nodejs";

// Starts the teacher's Student view of one student (read only): the student's own pages, for the
// whole visit, until "Exit Student View" (/api/student-view/exit). Only a student of the teacher's
// (studentAccessWhereFor; an admin, any student). Audited as IMPERSONATE_STUDENT_VIEW.
export async function GET(req: NextRequest, { params }: { params: Promise<{ studentId: string }> }) {
  const session = await requireTeacherOrAdmin();
  if (!session) return relativeRedirect("/login");
  const { studentId } = await params;
  const unavailable = (reason: "not-found" | "out-of-scope") =>
    relativeRedirect(`/teacher/students?studentView=${reason}`);

  const student = await withSqliteRetry(() =>
    prisma.user.findUnique({ where: { id: studentId }, select: { id: true, email: true, role: true } }),
  );
  if (!student || student.role !== "STUDENT") {
    console.warn("[student-view] student not found or not a student", { studentId, teacherId: session.user.id });
    return unavailable("not-found");
  }
  const inTeacherScope = Boolean(
    await withSqliteRetry(() =>
      prisma.user.findFirst({ where: { id: studentId, ...studentAccessWhereFor(session.user) }, select: { id: true } }),
    ),
  );
  if (!inTeacherScope) {
    console.warn("[student-view] student outside teacher program scope", { studentId, studentEmail: student.email, teacherId: session.user.id });
    return unavailable("out-of-scope");
  }

  try {
    await withSqliteRetry(() =>
      prisma.auditLog.create({
        data: {
          userId: session.user.id,
          action: "IMPERSONATE_STUDENT_VIEW",
          targetType: "User",
          targetId: student.id,
          metadata: JSON.stringify({ studentEmail: student.email }),
        },
      }),
    );
  } catch (error) {
    console.warn("[student-view] audit write failed", {
      studentId,
      studentEmail: student.email,
      teacherId: session.user.id,
      error: error instanceof Error ? error.message : "unknown_error",
    });
  }

  // The area the teacher was on opens the same view of the student.
  const area = req.nextUrl.searchParams.get("area");
  const target =
    area && ["math", "reading", "writing"].includes(area) ? `/student/practice?area=${area}` : area === "tests" ? "/student/tests" : "/student";
  const response = relativeRedirect(target);
  response.cookies.set(STUDENT_VIEW_COOKIE, student.id, STUDENT_VIEW_COOKIE_OPTIONS);
  return response;
}
