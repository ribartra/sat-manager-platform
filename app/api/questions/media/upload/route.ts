import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { requireTeacherOrAdmin } from "@/lib/rbac";
import { putQuestionImage } from "@/lib/object-storage";
import { writeAudit } from "@/lib/audit";

export const runtime = "nodejs";

const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const MAX_SIZE = 5 * 1024 * 1024; // 5 MB

const EXT_BY_TYPE: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
};

function detectedImageType(buffer: Buffer): string | null {
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
  if (buffer.length >= 6 && buffer.subarray(0, 6).toString("ascii") === "GIF87a") return "image/gif";
  if (buffer.length >= 6 && buffer.subarray(0, 6).toString("ascii") === "GIF89a") return "image/gif";
  return null;
}

export async function POST(req: NextRequest) {
  const session = await requireTeacherOrAdmin();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const formData = await req.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided." }, { status: 400 });
  }
  if (!ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json({ error: "Only JPEG, PNG, WebP and GIF images are allowed." }, { status: 400 });
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: "Image must be under 5 MB." }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const detectedType = detectedImageType(buffer);
  if (!detectedType || !ALLOWED_TYPES.has(detectedType)) {
    return NextResponse.json({ error: "The uploaded file content does not match a supported image type." }, { status: 400 });
  }
  // Prefer detected type over client-declared type when they disagree.
  const contentType = detectedType;
  const ext = EXT_BY_TYPE[contentType] ?? ".jpg";
  const digest = crypto.createHash("sha256").update(buffer).digest("hex").slice(0, 24);
  const fileName = `${digest}${ext}`;

  try {
    const url = await putQuestionImage(fileName, buffer);
    await writeAudit({
      userId: session.user.id,
      action: "UPLOAD_QUESTION_IMAGE",
      targetType: "QuestionMedia",
      targetId: fileName,
      outcome: "success",
      metadata: { url, contentType, bytes: buffer.length },
    });
    return NextResponse.json({ url });
  } catch (error) {
    await writeAudit({
      userId: session.user.id,
      action: "UPLOAD_QUESTION_IMAGE",
      targetType: "QuestionMedia",
      outcome: "failure",
      error,
    });
    return NextResponse.json({ error: "Failed to store image." }, { status: 500 });
  }
}
