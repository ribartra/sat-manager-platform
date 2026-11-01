import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireApprovedSession } from "@/lib/rbac";
import { saveAvatar, deleteAvatar } from "@/lib/storage";
import { BadRequestError, UnauthorizedError, withApiErrors } from "@/lib/api-error";

const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_SIZE = 5 * 1024 * 1024; // 5 MB

function detectedImageType(buffer: Buffer) {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return "image/jpeg";
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return "image/png";
  }
  if (buffer.length >= 12 && buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP") {
    return "image/webp";
  }
  return null;
}

// POST /api/profile/avatar — upload and set avatar
export const POST = withApiErrors(async function POST(req: NextRequest) {
  const session = await requireApprovedSession();
  if (!session) return new UnauthorizedError("Unauthorized").toResponse();

  const formData = await req.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return new BadRequestError("No file provided.").toResponse();
  }
  if (!ALLOWED_TYPES.has(file.type)) {
    return new BadRequestError("Only JPEG, PNG and WebP images are allowed.").toResponse();
  }
  if (file.size > MAX_SIZE) {
    return new BadRequestError("Image must be under 5 MB.").toResponse();
  }

  // Validate and store the new image first; the previous one is deleted only once the new one is
  // saved and linked (a rejected or failed upload keeps the current avatar).
  const buffer = Buffer.from(await file.arrayBuffer());
  const detectedType = detectedImageType(buffer);
  if (!detectedType || detectedType !== file.type) {
    return new BadRequestError("The uploaded file content does not match a supported image type.").toResponse();
  }
  const existing = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { avatarUrl: true },
  });
  const avatarUrl = await saveAvatar(buffer, detectedType, session.user.id);

  await prisma.user.update({
    where: { id: session.user.id },
    data: { avatarUrl },
  });
  // Every avatar has a unique name (saveAvatar), so this never removes the new one.
  if (existing?.avatarUrl && existing.avatarUrl !== avatarUrl) {
    await deleteAvatar(existing.avatarUrl).catch(() => {});
  }

  return NextResponse.json({ avatarUrl });
});

// DELETE /api/profile/avatar — remove avatar
export const DELETE = withApiErrors(async function DELETE() {
  const session = await requireApprovedSession();
  if (!session) return new UnauthorizedError("Unauthorized").toResponse();

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
});
