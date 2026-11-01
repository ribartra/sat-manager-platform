import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { assertTeacherOrAdmin } from "@/lib/rbac";
import { studentAccessWhereFor } from "@/lib/program-scope";
import { BadRequestError, NotFoundError, withApiErrors } from "@/lib/api-error";

type Ctx = { params: Promise<{ studentId: string }> };

// POST /api/students/[studentId]/parent-prompt  { dismiss: true }
// "Don't ask again": after emailing this student's report to an address, stop offering this
// teacher to link that address as the parent. Per teacher and student, so it holds on any device.
export const POST = withApiErrors(async function POST(req: Request, { params }: Ctx) {
  const session = await assertTeacherOrAdmin();
  const { studentId } = await params;
  const body = (await req.json().catch(() => ({}))) as { dismiss?: unknown };
  if (body.dismiss !== true) throw new BadRequestError("Nothing to change.");
  const student = await prisma.user.findFirst({ where: { id: studentId, ...studentAccessWhereFor(session.user) }, select: { id: true } });
  if (!student) throw new NotFoundError("Not found");
  await prisma.parentLinkPromptDismissal.upsert({
    where: { userId_studentId: { userId: session.user.id, studentId } },
    update: {},
    create: { userId: session.user.id, studentId },
  });
  return NextResponse.json({ ok: true });
});
