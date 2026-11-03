import { NextResponse } from "next/server";
import { assertTeacherOrAdmin } from "@/lib/rbac";
import { withApiErrors } from "@/lib/api-error";
import { finishClassroomWork, openClassroomWorkFor } from "@/lib/classroom-work";

export const runtime = "nodejs";

// Open Classroom work of the teacher's students (pendiente-p2.md): Classroom stays open until the
// teacher finishes it or assigns the set as Homework.
//   GET                               → { students: [{ id, name, sets: [{ assignmentId, name }] }] }
//   POST { studentIds?: string[] }    → finishes it (all of the teacher's students when omitted)
// Always inside the teacher's own students (studentAccessWhereFor).
export const GET = withApiErrors(async function GET() {
  const session = await assertTeacherOrAdmin();
  return NextResponse.json({ students: await openClassroomWorkFor(session.user) });
});

export const POST = withApiErrors(async function POST(req: Request) {
  const session = await assertTeacherOrAdmin();
  const body = (await req.json().catch(() => ({}))) as { studentIds?: unknown };
  const studentIds = Array.isArray(body.studentIds) ? body.studentIds.filter((id): id is string => typeof id === "string") : undefined;
  const finished = await finishClassroomWork(session.user, studentIds);
  return NextResponse.json({ ok: true, finished });
});
