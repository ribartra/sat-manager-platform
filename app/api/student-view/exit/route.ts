import type { NextRequest } from "next/server";
import { relativeRedirect } from "@/lib/relative-redirect";
import { STUDENT_VIEW_COOKIE, STUDENT_VIEW_COOKIE_OPTIONS } from "@/lib/student-viewer";

export const runtime = "nodejs";

// Ends the Student view: back to that student's page (or `next`, e.g. /login on sign-out).
export async function GET(req: NextRequest) {
  const studentId = req.cookies.get(STUDENT_VIEW_COOKIE)?.value;
  const next = req.nextUrl.searchParams.get("next");
  const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : null;
  const target = safeNext ?? (studentId ? `/teacher/students/${encodeURIComponent(studentId)}` : "/teacher/students");
  const response = relativeRedirect(target);
  response.cookies.set(STUDENT_VIEW_COOKIE, "", { ...STUDENT_VIEW_COOKIE_OPTIONS, maxAge: 0 });
  return response;
}
