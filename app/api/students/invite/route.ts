import { NextRequest, NextResponse } from "next/server";
import { requireTeacherOrAdmin } from "@/lib/rbac";
import prisma from "@/lib/prisma";
import { absoluteAppUrl, sendParentConsentEmail, sendStudentInviteEmail } from "@/lib/email";
import { hashPublicToken, newPublicToken } from "@/lib/token-security";

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

  const token = newPublicToken();
  const tokenHash = hashPublicToken(token);

  // When a parent email is provided, pre-generate the consent token the
  // /auth/parent-consent page expects and email its link to the parent.
  const parentConsentToken = parentEmail ? newPublicToken() : null;
  const parentConsentTokenHash = parentConsentToken ? hashPublicToken(parentConsentToken) : null;

  await prisma.inviteToken.create({
    data: {
      role: "STUDENT",
      name,
      email,
      phone: phone || null,
      startDate: startDate ? new Date(startDate) : null,
      invitedById: session.user.id,
      programId: program.id,
      isMinor: Boolean(isMinor),
      parentName: parentName || null,
      parentEmail: parentEmail || null,
      parentPhone: parentPhone || null,
      parentConsentToken: parentConsentTokenHash ? `hashed:${parentConsentTokenHash}` : null,
      parentConsentTokenHash,
      token: `hashed:${tokenHash}`,
      tokenHash,
      expiresAt,
    },
  });

  const inviteUrl = absoluteAppUrl(`/auth/activate?token=${token}`);
  await sendStudentInviteEmail(email, name, inviteUrl);

  if (parentEmail && parentConsentToken) {
    const consentUrl = absoluteAppUrl(`/auth/parent-consent?token=${parentConsentToken}`);
    await sendParentConsentEmail(parentEmail, parentName || null, name, consentUrl);
  }

  return NextResponse.json({ ok: true, inviteUrl });
}
