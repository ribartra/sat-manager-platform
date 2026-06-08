import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { requireTeacherOrAdmin } from "@/lib/rbac";
import prisma from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const session = await requireTeacherOrAdmin();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { name, email, phone, studentIds, password } = await req.json();
  if (!password || typeof password !== "string" || password.length < 6) {
    return NextResponse.json({ error: "Password must be at least 6 characters." }, { status: 400 });
  }
  const passwordHash = await bcrypt.hash(password, 10);
  const parent = await prisma.user.upsert({
    where: { email },
    update: { name, phone: phone || null, role: "PARENT", passwordHash },
    create: { name, email, phone: phone || null, role: "PARENT", passwordHash, active: true, validationStatus: "PENDING" },
  });
  await prisma.parentStudent.deleteMany({ where: { parentId: parent.id } });
  await Promise.all((studentIds as string[]).map((studentId) => prisma.parentStudent.create({ data: { parentId: parent.id, studentId, authorizedAt: new Date() } })));
  return NextResponse.json(parent);
}
