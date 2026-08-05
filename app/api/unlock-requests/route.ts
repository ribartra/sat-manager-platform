import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getFeatureSetting } from "@/lib/app-settings";
import { notifyTeachers } from "@/lib/notifications";
import { requireApprovedSession } from "@/lib/rbac";

export async function POST(req: NextRequest) {
  const session = await requireApprovedSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const enabled = await getFeatureSetting("STUDENT_UNLOCK_REQUESTS");
  if (!enabled) {
    return NextResponse.json(
      { error: "Unlock requests are disabled. Practice access is controlled by scoring rules and teachers." },
      { status: 410 }
    );
  }

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
