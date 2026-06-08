import { NextRequest, NextResponse } from "next/server";
import { requireTeacherOrAdmin } from "@/lib/rbac";
import prisma from "@/lib/prisma";
import { notifyUser } from "@/lib/notifications";

interface RouteContext {
  params: Promise<{ requestId: string }>;
}

export async function PUT(req: NextRequest, { params }: RouteContext) {
  const session = await requireTeacherOrAdmin();
  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { requestId } = await params;
  const { status } = await req.json();
  const request = await prisma.unlockRequest.update({
    where: { id: requestId },
    data: { status, resolvedAt: new Date() },
    include: { assignment: { include: { practiceSet: true } } },
  });

  if (status === "APPROVED") {
    await prisma.assignment.update({
      where: { id: request.assignmentId },
      data: { locked: false, unlockAt: null },
    });
    await notifyUser(request.studentId, "Practice set unlocked", request.assignment.practiceSet.name, "/student");
  } else {
    await notifyUser(request.studentId, "Unlock request denied", request.assignment.practiceSet.name, "/student/content-map");
  }

  return NextResponse.json(request);
}
