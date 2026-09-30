import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { requireTeacherOrAdmin } from "@/lib/rbac";
import prisma from "@/lib/prisma";
import { materializeOfficialImageUrl } from "@/lib/ingest-promotion";
import { cleanupOfficialQuestionPlaceholders } from "@/lib/ingest-image-cleanup";
import { BadRequestError, ForbiddenError, NotFoundError, withApiErrors } from "@/lib/api-error";

// Attach an extracted ingest image directly to a promoted Question.
// Used by the file-review image gallery to assign a page screenshot to a
// question when the per-candidate crop board isn't available (e.g. a docx
// question source that produced images but no candidates).
export const POST = withApiErrors(async function POST(req: NextRequest) {
  const session = await requireTeacherOrAdmin();
  if (!session) return new ForbiddenError("Forbidden").toResponse();

  const body = await req.json().catch(() => ({}));
  const imageArtifactId = typeof body.imageArtifactId === "string" ? body.imageArtifactId : null;
  const questionId = typeof body.questionId === "string" ? body.questionId : null;
  if (!imageArtifactId || !questionId) {
    return new BadRequestError("imageArtifactId and questionId are required").toResponse();
  }

  const [image, question] = await Promise.all([
    prisma.ingestImageArtifact.findUnique({
      where: { id: imageArtifactId },
      select: { fileUrl: true, base64Data: true, mimeType: true },
    }),
    prisma.question.findUnique({ where: { id: questionId }, select: { id: true, imageUrl: true } }),
  ]);
  if (!image) return new NotFoundError("Image not found").toResponse();
  if (!question) return new NotFoundError("Question not found").toResponse();

  // Prefer the private asset URL (copied into public/uploads/questions); fall back to a data URI.
  let imageUrl: string | null = null;
  if (image.fileUrl) imageUrl = await materializeOfficialImageUrl(image.fileUrl);
  if (!imageUrl && image.base64Data) {
    imageUrl = image.base64Data.startsWith("data:")
      ? image.base64Data
      : `data:${image.mimeType || "image/jpeg"};base64,${image.base64Data}`;
  }
  if (!imageUrl) return new BadRequestError("Could not resolve image data").toResponse();

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
});
