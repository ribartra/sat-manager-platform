import { NextRequest, NextResponse } from "next/server";
import { requireTeacherOrAdmin } from "@/lib/rbac";
import prisma from "@/lib/prisma";

interface RouteContext {
  params: Promise<{ subskillId: string }>;
}

export async function PUT(req: NextRequest, { params }: RouteContext) {
  const session = await requireTeacherOrAdmin();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { subskillId } = await params;
  const { name } = await req.json();
  return NextResponse.json(await prisma.subskill.update({ where: { id: subskillId }, data: { name } }));
}

export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  const session = await requireTeacherOrAdmin();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { subskillId } = await params;
  await prisma.subskill.delete({ where: { id: subskillId } });
  return NextResponse.json({ ok: true });
}
