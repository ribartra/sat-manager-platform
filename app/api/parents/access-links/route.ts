import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { requireTeacherOrAdmin } from "@/lib/rbac";
import prisma from "@/lib/prisma";
import { studentAccessWhereFor } from "@/lib/program-scope";
import { absoluteAppUrl, sendParentReportEmail } from "@/lib/email";
import {
  PARENT_ACTIVATION_DEADLINE_DAYS,
  areasLabel,
  normalizeAreasInput,
  parseAreas,
} from "@/lib/parent-access";

function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export async function POST(req: NextRequest) {
  const session = await requireTeacherOrAdmin();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { studentId, parentId, areas } = await req.json();
  if (!studentId || !parentId) {
    return NextResponse.json({ error: "Student and parent are required." }, { status: 400 });
  }

  const student = await prisma.user.findFirst({
    where: { id: studentId, ...studentAccessWhereFor(session.user) },
    select: { id: true, name: true },
  });
  if (!student) return NextResponse.json({ error: "Student not found." }, { status: 404 });

  // Only allow sharing with a parent already linked to this student.
  const link = await prisma.parentStudent.findUnique({
    where: { parentId_studentId: { parentId, studentId: student.id } },
    include: { parent: { select: { id: true, name: true, email: true } } },
  });
  if (!link) {
    return NextResponse.json({ error: "That parent is not associated with this student." }, { status: 404 });
  }
  if (!link.parent.email) {
    return NextResponse.json({ error: "The associated parent has no email on file." }, { status: 400 });
  }

  const areasCsv = normalizeAreasInput(areas);
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + PARENT_ACTIVATION_DEADLINE_DAYS * 24 * 60 * 60 * 1000);

  const access = await prisma.parentAccessToken.create({
    data: {
      studentId: student.id,
      parentId: link.parent.id,
      createdById: session.user.id,
      areas: areasCsv,
      tokenHash: hashToken(token),
      expiresAt,
    },
  });

  const url = absoluteAppUrl(`/parent/access?token=${token}`);
  const sectionsLabel = areasLabel(parseAreas(areasCsv));
  const emailResult = await sendParentReportEmail(link.parent.email, link.parent.name, student.name, url, sectionsLabel);

  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: "SHARE_PARENT_REPORT_LINK",
      targetType: "ParentAccessToken",
      targetId: access.id,
      metadata: JSON.stringify({
        studentId: student.id,
        parentId: link.parent.id,
        areas: areasCsv,
        emailSent: emailResult.sent,
      }),
    },
  });

  return NextResponse.json({
    ok: true,
    studentName: student.name,
    parentEmail: link.parent.email,
    expiresAt: access.expiresAt,
    sections: sectionsLabel,
    emailSent: emailResult.sent,
    emailReason: emailResult.sent ? null : emailResult.reason,
  });
}
