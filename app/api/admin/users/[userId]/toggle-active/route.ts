import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAdmin } from "@/lib/rbac";

interface RouteContext {
  params: Promise<{ userId: string }>;
}

export async function POST(_req: Request, { params }: RouteContext) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { userId } = await params;
  if (userId === session.user.id) {
    return NextResponse.json({ error: "Administrators cannot disable their own account." }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return NextResponse.json({ error: "User not found." }, { status: 404 });

  const updated = await prisma.user.update({
    where: { id: userId },
    data: { active: !user.active },
    select: { id: true, active: true },
  });

  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: updated.active ? "ENABLE_USER" : "DISABLE_USER",
      targetType: "User",
      targetId: userId,
      metadata: JSON.stringify({ role: user.role }),
    },
  });

  return NextResponse.json(updated);
}
