import { NextRequest, NextResponse } from "next/server";
import { requireTeacherOrAdmin } from "@/lib/rbac";
import prisma from "@/lib/prisma";

interface RouteContext {
  params: Promise<{ studentId: string }>;
}

export async function PUT(req: NextRequest, { params }: RouteContext) {
  const session = await requireTeacherOrAdmin();
  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { studentId } = await params;
  const { name, email, phone, startDate, active } = await req.json();

  const updated = await prisma.user.update({
    where: { id: studentId },
    data: {
      name,
      email,
      phone: phone || null,
      startDate: startDate ? new Date(startDate) : null,
      active: Boolean(active),
    },
  });

  return NextResponse.json(updated);
}
