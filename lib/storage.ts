import crypto from "crypto";
import { objectStorage } from "@/lib/object-storage";

// Avatar storage. Delegates to the object-storage adapter (lib/object-storage.ts),
// which is local-disk by default and Google Cloud Storage when STORAGE_DRIVER=gcs.
// Call sites (app/api/profile/avatar/route.ts) are unchanged.

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
  const key = `uploads/avatars/${userId}-${crypto.randomUUID()}.${ext}`;
  const { url } = await objectStorage.put(key, buffer, mimeType);
  return url;
}

export async function deleteAvatar(url: string): Promise<void> {
  // url may be a local path ("/uploads/avatars/<file>") or a GCS URL.
  await objectStorage.delete(url).catch(() => {});
}
