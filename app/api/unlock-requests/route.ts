import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { notifyTeachers } from "@/lib/notifications";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { assignmentId } = await req.json();
  const assignment = await prisma.assignment.findFirst({
    where: { id: assignmentId, studentId: session.user.id },
    include: { practiceSet: true },
  });
  if (!assignment) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const existing = await prisma.unlockRequest.findFirst({
    where: { assignmentId, studentId: session.user.id, status: "PENDING" },
  });
  if (existing) return NextResponse.json(existing);

  const request = await prisma.unlockRequest.create({
    data: { assignmentId, studentId: session.user.id },
  });
  await notifyTeachers(
    "Unlock requested",
    `${session.user.name} requested access to ${assignment.practiceSet.name}.`,
    `/teacher/students/${session.user.id}`
  );

  return NextResponse.json(request);
}
