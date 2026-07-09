import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { requireTeacherOrAdmin } from "@/lib/rbac";
import prisma from "@/lib/prisma";
import { absoluteAppUrl, sendParentConsentEmail, sendParentInviteEmail, sendStudentInviteEmail } from "@/lib/email";

export async function POST(req: NextRequest) {
  const session = await requireTeacherOrAdmin();
  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { name, email, phone, startDate, programId, isMinor, parentName, parentEmail, parentPhone } = await req.json();
  if (!name || !email || !programId) return NextResponse.json({ error: "Name, email, and program are required." }, { status: 400 });
  if (isMinor && !parentEmail) return NextResponse.json({ error: "Parent email is required for minor students." }, { status: 400 });

  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) return NextResponse.json({ error: "A user with that email already exists." }, { status: 409 });

  const now = new Date();
  const program = await prisma.program.findFirst({
    where: {
      id: programId,
      active: true,
      startDate: { lte: now },
      OR: [{ endDate: null }, { endDate: { gt: now } }],
      ...(session.user.role === "TEACHER"
        ? { teachers: { some: { teacherId: session.user.id, endDate: null, teacher: { active: true } } } }
        : {}),
    },
  });
  if (!program) return NextResponse.json({ error: "Program not found or unavailable." }, { status: 404 });

  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7);

  if (isMinor && parentEmail) {
    // Minor flow: two separate invite tokens — student and parent each create their own account
    const studentToken = crypto.randomBytes(32).toString("hex");
    const parentToken = crypto.randomBytes(32).toString("hex");

    await prisma.inviteToken.create({
      data: {
        role: "STUDENT",
        name,
        email,
        phone: phone || null,
        startDate: startDate ? new Date(startDate) : null,
        invitedById: session.user.id,
        programId: program.id,
        isMinor: true,
        parentEmail,
        token: studentToken,
        expiresAt,
      },
    });

    await prisma.inviteToken.create({
      data: {
        role: "PARENT",
        name: parentName || parentEmail,
        email: parentEmail,
        phone: parentPhone || null,
        invitedById: session.user.id,
        linkedStudentEmail: email,
        token: parentToken,
        expiresAt,
      },
    });

    const studentInviteUrl = absoluteAppUrl(`/auth/activate?token=${studentToken}`);
    const parentInviteUrl = absoluteAppUrl(`/auth/activate?token=${parentToken}`);
    await sendStudentInviteEmail(email, name, studentInviteUrl);
    await sendParentInviteEmail(parentEmail, parentName || null, name, parentInviteUrl);

    return NextResponse.json({ ok: true, inviteUrl: studentInviteUrl, parentInviteUrl });
  }

  // Standard (adult) flow — kept for backward compatibility
  const token = crypto.randomBytes(32).toString("hex");
  const parentConsentToken = parentEmail ? crypto.randomBytes(32).toString("hex") : null;
  await prisma.inviteToken.create({
    data: {
      role: "STUDENT",
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
