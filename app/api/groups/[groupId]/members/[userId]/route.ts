import { NextRequest, NextResponse } from "next/server";
import { requireTeacherOrAdmin } from "@/lib/rbac";
import prisma from "@/lib/prisma";

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ groupId: string; userId: string }> }) {
  const session = await requireTeacherOrAdmin();
  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { groupId, userId } = await params;
  await prisma.groupMembership.delete({ where: { userId_groupId: { userId, groupId } } });
  return NextResponse.json({ ok: true });
}
