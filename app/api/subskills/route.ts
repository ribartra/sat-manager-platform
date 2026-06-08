import { NextRequest, NextResponse } from "next/server";
import { requireTeacherOrAdmin } from "@/lib/rbac";
import prisma from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const session = await requireTeacherOrAdmin();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { topicId, name } = await req.json();
  if (!topicId || !name) return NextResponse.json({ error: "Topic and name are required." }, { status: 400 });

  const subskill = await prisma.subskill.create({ data: { topicId, name } });
  return NextResponse.json(subskill);
}
