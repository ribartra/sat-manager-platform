import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { requireTeacherOrAdmin } from "@/lib/rbac";
import prisma from "@/lib/prisma";
import { propagateAssignedImageToOfficial } from "@/lib/ingest-promotion";
import { cleanupAfterStemImageAssigned } from "@/lib/ingest-image-cleanup";
import { BadRequestError, ForbiddenError, NotFoundError, withApiErrors } from "@/lib/api-error";

interface RouteContext {
  params: Promise<{ candidateId: string }>;
}

const allowedTargets = new Set(["STEM", "STIMULUS", "OPTION", "OPTION_BLOCK", "ANSWER_FIELD", "EXPLANATION", "PAGE_CONTEXT"]);

export const GET = withApiErrors(async function GET(_req: NextRequest, { params }: RouteContext) {
  const session = await requireTeacherOrAdmin();
  if (!session) return new ForbiddenError("Forbidden").toResponse();

  const { candidateId } = await params;
  const links = await prisma.ingestCandidateImageLink.findMany({
    where: { candidateId },
    orderBy: [{ targetType: "asc" }, { optionLabel: "asc" }, { sortOrder: "asc" }],
  });
  const images = links.length
    ? await prisma.ingestImageArtifact.findMany({
        where: { id: { in: links.map((link) => link.imageArtifactId) } },
        select: {
          id: true,
          fileUrl: true,
          base64Data: true,
          mimeType: true,
          pageNumber: true,
          origin: true,
          sourceFileId: true,
          pageArtifactId: true,
        },
      })
    : [];
  const imageById = new Map(images.map((image) => [image.id, image]));

  return NextResponse.json(
    links.map((link) => ({
      id: link.id,
      imageArtifactId: link.imageArtifactId,
      targetType: link.targetType,
      optionLabel: link.optionLabel,
      sortOrder: link.sortOrder,
      image: imageById.get(link.imageArtifactId) ?? null,
    }))
  );
});

export const POST = withApiErrors(async function POST(req: NextRequest, { params }: RouteContext) {
  const session = await requireTeacherOrAdmin();
  if (!session) return new ForbiddenError("Forbidden").toResponse();

  const { candidateId } = await params;
  const body = (await req.json().catch(() => ({}))) as {
    imageArtifactId?: string;
    targetType?: string;
    optionLabel?: string | null;
    sortOrder?: number;
  };

  if (!body.imageArtifactId) return new BadRequestError("Image is required.").toResponse();
  const targetType = body.targetType || "STEM";
  if (!allowedTargets.has(targetType)) return new BadRequestError("Invalid image target.").toResponse();

  const [candidate, image] = await Promise.all([
    prisma.ingestQuestionCandidate.findUnique({ where: { id: candidateId } }),
    prisma.ingestImageArtifact.findUnique({ where: { id: body.imageArtifactId } }),
  ]);
  if (!candidate) return new NotFoundError("Candidate not found.").toResponse();
  if (!image || image.batchId !== candidate.batchId) return new NotFoundError("Image not found for this batch.").toResponse();

  const existing = await prisma.ingestCandidateImageLink.findFirst({
    where: {
      candidateId,
      imageArtifactId: image.id,
      targetType,
      optionLabel: body.optionLabel ?? null,
    },
  });
  const link = existing
    ? await prisma.ingestCandidateImageLink.update({
        where: { id: existing.id },
        data: { sortOrder: body.sortOrder ?? existing.sortOrder },
      })
    : await prisma.ingestCandidateImageLink.create({
        data: {
      id: `imglink_${randomUUID().replace(/-/g, "")}`,
      batchId: candidate.batchId,
      candidateId,
      imageArtifactId: image.id,
      targetType,
      optionLabel: body.optionLabel ?? null,
      sortOrder: body.sortOrder ?? 0,
        },
      });

  // Mirror onto the official Question when already promoted — same path as
  // crop-region. Without this, the UI "asignar imagen" only updates staging and
  // Extracted Tests keep showing the gap.
  const officialPropagation = await propagateAssignedImageToOfficial({
    candidateId,
    imageArtifactId: image.id,
    targetType,
    optionLabel: body.optionLabel ?? null,
  }).catch(() => null);

  if (targetType === "STEM" || targetType === "STIMULUS") {
    await cleanupAfterStemImageAssigned(candidateId).catch(() => null);
  }

  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: "LINK_AI_IMPORT_IMAGE",
      targetType: "IngestQuestionCandidate",
      targetId: candidateId,
      metadata: JSON.stringify({
        imageArtifactId: image.id,
        targetType,
        optionLabel: body.optionLabel,
        officialPropagated: officialPropagation?.propagated ?? false,
        officialTarget: officialPropagation?.target ?? null,
      }),
    },
  });

  return NextResponse.json({ ...link, officialPropagation });
});

export const DELETE = withApiErrors(async function DELETE(req: NextRequest, { params }: RouteContext) {
  const session = await requireTeacherOrAdmin();
  if (!session) return new ForbiddenError("Forbidden").toResponse();

  const { candidateId } = await params;
  const { searchParams } = new URL(req.url);
  const linkId = searchParams.get("linkId");
  if (!linkId) return new BadRequestError("linkId is required.").toResponse();

  const link = await prisma.ingestCandidateImageLink.findFirst({ where: { id: linkId, candidateId } });
  if (!link) return new NotFoundError("Image link not found.").toResponse();
  await prisma.ingestCandidateImageLink.delete({ where: { id: link.id } });

  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: "UNLINK_AI_IMPORT_IMAGE",
      targetType: "IngestQuestionCandidate",
      targetId: candidateId,
      metadata: JSON.stringify({ linkId }),
    },
  });

  return NextResponse.json({ ok: true });
});
