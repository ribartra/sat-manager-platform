import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireApprovedSession } from "@/lib/rbac";
import { saveAvatar, deleteAvatar } from "@/lib/storage";

const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_SIZE = 5 * 1024 * 1024; // 5 MB

// POST /api/profile/avatar — upload and set avatar
export async function POST(req: NextRequest) {
  const session = await requireApprovedSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const formData = await req.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided." }, { status: 400 });
  }
  if (!ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json(
      { error: "Only JPEG, PNG and WebP images are allowed." },
      { status: 400 }
    );
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: "Image must be under 5 MB." }, { status: 400 });
  }

  // Delete previous avatar file if it exists
  const existing = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { avatarUrl: true },
  });
  if (existing?.avatarUrl) {
    await deleteAvatar(existing.avatarUrl).catch(() => {});
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const avatarUrl = await saveAvatar(buffer, file.type, session.user.id);

  await prisma.user.update({
    where: { id: session.user.id },
    data: { avatarUrl },
  });

  return NextResponse.json({ avatarUrl });
}

// DELETE /api/profile/avatar — remove avatar
export async function DELETE() {
  const session = await requireApprovedSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { avatarUrl: true },
  });

  if (user?.avatarUrl) {
    await deleteAvatar(user.avatarUrl).catch(() => {});
    await prisma.user.update({
      where: { id: session.user.id },
      data: { avatarUrl: null },
    });
  }

  return NextResponse.json({ ok: true });
}
