import { NextRequest, NextResponse } from "next/server";
import { requireTeacherOrAdmin } from "@/lib/rbac";
import prisma from "@/lib/prisma";
import { ingestAuthHeaders, ingestUrl } from "@/lib/internal-ingest";
import { ApiError, BadRequestError, ForbiddenError, NotFoundError, withApiErrors } from "@/lib/api-error";

interface RouteContext {
  params: Promise<{ candidateId: string }>;
}

export const POST = withApiErrors(async function POST(req: NextRequest, { params }: RouteContext) {
  const session = await requireTeacherOrAdmin();
  if (!session) return new ForbiddenError("Forbidden").toResponse();

  const { candidateId } = await params;
  const body = (await req.json().catch(() => ({}))) as { imageArtifactId?: string };
  if (!body.imageArtifactId) return new BadRequestError("imageArtifactId is required.").toResponse();

  const candidate = await prisma.ingestQuestionCandidate.findUnique({ where: { id: candidateId } });
  if (!candidate) return new NotFoundError("Candidate not found.").toResponse();

  const response = await fetch(ingestUrl(`/candidates/${candidateId}/parse-option-image`), {
    method: "POST",
    headers: ingestAuthHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ imageArtifactId: body.imageArtifactId }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    return ApiError.fromStatus(response.status, data.detail || "Could not parse option image.").toResponse();
  }

  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: "PARSE_AI_IMPORT_OPTION_IMAGE",
      targetType: "IngestQuestionCandidate",
      targetId: candidateId,
      metadata: JSON.stringify({ imageArtifactId: body.imageArtifactId, result: data }),
    },
  });

  return NextResponse.json(data);
});
