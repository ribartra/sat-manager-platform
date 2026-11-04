import { NextRequest, NextResponse } from "next/server";
import { requireTeacherOrAdmin } from "@/lib/rbac";
import prisma from "@/lib/prisma";
import { ingestAuthHeaders, ingestUrl } from "@/lib/internal-ingest";
import { propagateAssignedImageToOfficial } from "@/lib/ingest-promotion";
import { cleanupAfterStemImageAssigned } from "@/lib/ingest-image-cleanup";
import { ApiError, BadRequestError, ForbiddenError, NotFoundError, withApiErrors } from "@/lib/api-error";
import { reconcileFigureReview } from "@/lib/ingest-review";

interface RouteContext {
  params: Promise<{ candidateId: string }>;
}

const TARGET_TYPES = ["STEM", "STIMULUS", "OPTION", "OPTION_BLOCK", "ANSWER_FIELD", "EXPLANATION", "PAGE_CONTEXT"];

interface CropBody {
  pageNumber?: number;
  bbox?: { x0: number; y0: number; x1: number; y1: number };
  mode?: string;
  targetType?: string;
  optionLabel?: string | null;
  // Optional sibling source to crop pixels from (same batch as the candidate).
  // Used when the candidate's own source has no page images (e.g. Test 1 R&W).
  imageSourceFileId?: string | null;
}

// Crops a region of the candidate's source PDF and either ASSIGNs it (creates an
// image link to stem/option/…) or OCRs it (returns text for review). Proxies the
// ingest service, which does the render + persistence.
export const POST = withApiErrors(async function POST(req: NextRequest, { params }: RouteContext) {
  const session = await requireTeacherOrAdmin();
  if (!session) return new ForbiddenError("Forbidden").toResponse();

  const { candidateId } = await params;
  const body = (await req.json().catch(() => ({}))) as CropBody;

  if (typeof body.pageNumber !== "number" || !Number.isInteger(body.pageNumber) || body.pageNumber < 1) {
    return new BadRequestError("pageNumber is required.").toResponse();
  }
  if (!body.bbox || typeof body.bbox.x0 !== "number") {
    return new BadRequestError("bbox {x0,y0,x1,y1} (normalized) is required.").toResponse();
  }
  const mode = (body.mode || "ASSIGN").toUpperCase();
  if (!["ASSIGN", "OCR"].includes(mode)) {
    return new BadRequestError("mode must be ASSIGN or OCR.").toResponse();
  }
  const targetType = (body.targetType || "PAGE_CONTEXT").toUpperCase();
  if (!TARGET_TYPES.includes(targetType)) {
    return new BadRequestError("Invalid targetType.").toResponse();
  }
  if (targetType === "OPTION" && !body.optionLabel) {
    return new BadRequestError("optionLabel is required for OPTION target.").toResponse();
  }

  const candidate = await prisma.ingestQuestionCandidate.findUnique({ where: { id: candidateId } });
  if (!candidate) return new NotFoundError("Candidate not found.").toResponse();

  // Validate the sibling image source (if any) lives in the same batch before
  // trusting the client-supplied id.
  let imageSourceFileId: string | null = null;
  if (body.imageSourceFileId && body.imageSourceFileId !== candidate.sourceFileId) {
    const imageSource = await prisma.ingestSourceFile.findUnique({
      where: { id: body.imageSourceFileId },
      select: { batchId: true },
    });
    if (!imageSource || imageSource.batchId !== candidate.batchId) {
      return new BadRequestError("Invalid image source.").toResponse();
    }
    imageSourceFileId = body.imageSourceFileId;
  }

  const response = await fetch(ingestUrl(`/candidates/${candidateId}/crop-region`), {
    method: "POST",
    headers: ingestAuthHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({
      pageNumber: body.pageNumber,
      bbox: body.bbox,
      mode,
      targetType,
      optionLabel: body.optionLabel ?? null,
      imageSourceFileId,
    }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    return ApiError.fromStatus(response.status, data.detail || "Could not process the crop.").toResponse();
  }

  // If this candidate is already promoted, mirror an ASSIGNed image onto the
  // official Question/QuestionOption so the change is visible to students and the
  // Extracted Test completeness view (which read official rows, not candidate links).
  let officialPropagation: Awaited<ReturnType<typeof propagateAssignedImageToOfficial>> | null = null;
  if (mode === "ASSIGN" && data.imageArtifactId) {
    officialPropagation = await propagateAssignedImageToOfficial({
      candidateId,
      imageArtifactId: data.imageArtifactId,
      targetType,
      optionLabel: body.optionLabel ?? null,
    }).catch(() => null);
    if (targetType === "STEM" || targetType === "STIMULUS") {
      await cleanupAfterStemImageAssigned(candidateId).catch(() => null);
    }
    // A figure now attached resolves its "crop it" review reason.
    await reconcileFigureReview([candidateId]);
  }

  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: mode === "OCR" ? "AI_IMPORT_CROP_OCR" : "AI_IMPORT_CROP_ASSIGN",
      targetType: "IngestQuestionCandidate",
      targetId: candidateId,
      metadata: JSON.stringify({
        pageNumber: body.pageNumber,
        targetType,
        optionLabel: body.optionLabel ?? null,
        imageArtifactId: data.imageArtifactId ?? null,
        officialPropagated: officialPropagation?.propagated ?? false,
        officialTarget: officialPropagation?.target ?? null,
      }),
    },
  });

  return NextResponse.json({ ...data, officialPropagation });
});
