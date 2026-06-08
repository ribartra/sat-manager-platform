import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { requireTeacherOrAdmin } from "@/lib/rbac";
import prisma from "@/lib/prisma";
import { absoluteAppUrl, sendParentConsentEmail, sendStudentInviteEmail } from "@/lib/email";

export async function POST(req: NextRequest) {
  const session = await requireTeacherOrAdmin();
  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { name, email, phone, startDate, programId, parentName, parentEmail, parentPhone } = await req.json();
  if (!name || !email || !programId) return NextResponse.json({ error: "Name, email, and program are required." }, { status: 400 });

  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) return NextResponse.json({ error: "A user with that email already exists." }, { status: 409 });

  const program = await prisma.program.findFirst({
    where: {
      id: programId,
      active: true,
      ...(session.user.role === "TEACHER"
        ? { teachers: { some: { teacherId: session.user.id, active: true, teacher: { active: true } } } }
        : {}),
    },
  });
  if (!program) return NextResponse.json({ error: "Program not found or unavailable." }, { status: 404 });

  const token = crypto.randomBytes(32).toString("hex");
  const parentConsentToken = parentEmail ? crypto.randomBytes(32).toString("hex") : null;
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7);
  await prisma.inviteToken.create({
    data: {
      name,
      email,
      phone: phone || null,
      startDate: startDate ? new Date(startDate) : null,
      invitedById: session.user.id,
      programId: program.id,
      parentName: parentName || null,
      parentEmail: parentEmail || null,
      parentPhone: parentPhone || null,
      parentConsentToken,
      token,
      expiresAt,
    },
  });

  const inviteUrl = absoluteAppUrl(`/auth/activate?token=${token}`);
  const parentConsentUrl = parentConsentToken ? absoluteAppUrl(`/auth/parent-consent?token=${parentConsentToken}`) : null;
  await sendStudentInviteEmail(email, name, inviteUrl);
  if (parentConsentUrl && parentEmail) {
    await sendParentConsentEmail(parentEmail, parentName || null, name, parentConsentUrl);
  }

  return NextResponse.json({ ok: true, inviteUrl, parentConsentUrl });
}
