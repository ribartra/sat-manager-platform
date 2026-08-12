import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { requireTeacherOrAdmin } from "@/lib/rbac";
import prisma from "@/lib/prisma";
import { materializeOfficialImageUrl } from "@/lib/ingest-promotion";
import { cleanupOfficialQuestionPlaceholders } from "@/lib/ingest-image-cleanup";

// Attach an extracted ingest image directly to a promoted Question.
// Used by the file-review image gallery to assign a page screenshot to a
// question when the per-candidate crop board isn't available (e.g. a docx
// question source that produced images but no candidates).
export async function POST(req: NextRequest) {
  const session = await requireTeacherOrAdmin();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const imageArtifactId = typeof body.imageArtifactId === "string" ? body.imageArtifactId : null;
  const questionId = typeof body.questionId === "string" ? body.questionId : null;
  if (!imageArtifactId || !questionId) {
    return NextResponse.json({ error: "imageArtifactId and questionId are required" }, { status: 400 });
  }

  const [image, question] = await Promise.all([
    prisma.ingestImageArtifact.findUnique({
      where: { id: imageArtifactId },
      select: { fileUrl: true, base64Data: true, mimeType: true },
    }),
    prisma.question.findUnique({ where: { id: questionId }, select: { id: true, imageUrl: true } }),
  ]);
  if (!image) return NextResponse.json({ error: "Image not found" }, { status: 404 });
  if (!question) return NextResponse.json({ error: "Question not found" }, { status: 404 });

  // Prefer the private asset URL (copied into public/uploads/questions); fall back to a data URI.
  let imageUrl: string | null = null;
  if (image.fileUrl) imageUrl = await materializeOfficialImageUrl(image.fileUrl);
  if (!imageUrl && image.base64Data) {
    imageUrl = image.base64Data.startsWith("data:")
      ? image.base64Data
      : `data:${image.mimeType || "image/jpeg"};base64,${image.base64Data}`;
  }
  if (!imageUrl) return NextResponse.json({ error: "Could not resolve image data" }, { status: 400 });

  await prisma.question.update({ where: { id: questionId }, data: { imageUrl } });
  await cleanupOfficialQuestionPlaceholders(questionId).catch(() => null);
  await prisma.auditLog.create({
    data: {
      id: `img_${randomUUID().replace(/-/g, "")}`,
      userId: session.user.id,
      action: "ATTACH_QUESTION_IMAGE_FROM_GALLERY",
      targetType: "Question",
      targetId: questionId,
      metadata: JSON.stringify({ imageArtifactId, imageUrl, previous: question.imageUrl ?? null }),
    },
  });

  return NextResponse.json({ imageUrl });
}
