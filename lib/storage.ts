import { writeFile, mkdir, unlink } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import crypto from "crypto";

// Dev: saves to public/uploads/avatars/ (served as static files by Next.js).
// Production: swap saveAvatar/deleteAvatar to use @google-cloud/storage.

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads", "avatars");

const MIME_TO_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export async function saveAvatar(
  buffer: Buffer,
  mimeType: string,
  userId: string
): Promise<string> {
  const ext = MIME_TO_EXT[mimeType] ?? "jpg";
  const filename = `${userId}-${crypto.randomUUID()}.${ext}`;
  await mkdir(UPLOAD_DIR, { recursive: true });
  await writeFile(path.join(UPLOAD_DIR, filename), buffer);
  return `/uploads/avatars/${filename}`;
}

export async function deleteAvatar(url: string): Promise<void> {
  // url is /uploads/avatars/<filename>
  const filename = url.split("/").pop();
  if (!filename) return;
  const filePath = path.join(UPLOAD_DIR, filename);
  if (existsSync(filePath)) {
    await unlink(filePath);
  }
}
