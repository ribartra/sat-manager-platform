import { NextRequest, NextResponse } from "next/server";
import { requireTeacherOrAdmin } from "@/lib/rbac";
import prisma from "@/lib/prisma";
import { ingestAuthHeaders, ingestUrl } from "@/lib/internal-ingest";
import { ApiError, ForbiddenError, NotFoundError, withApiErrors } from "@/lib/api-error";

interface RouteContext {
  params: Promise<{ batchId: string }>;
}

export const POST = withApiErrors(async function POST(req: NextRequest, { params }: RouteContext) {
  const session = await requireTeacherOrAdmin();
  if (!session) return new ForbiddenError("Forbidden").toResponse();

  const { batchId } = await params;
  const body = (await req.json().catch(() => ({}))) as { sourceFileId?: string; limit?: number };
  const batch = await prisma.ingestBatch.findUnique({ where: { id: batchId } });
  if (!batch) return new NotFoundError("Batch not found.").toResponse();

  const limit = Number.isFinite(body.limit) ? Math.max(1, Math.min(Number(body.limit), 5000)) : 5000;
  const paramsUrl = new URLSearchParams({ limit: String(limit) });
  if (body.sourceFileId) paramsUrl.set("sourceFileId", body.sourceFileId);

  const res = await fetch(ingestUrl(`/batches/${batchId}/retry-ocr-required?${paramsUrl.toString()}`), {
    method: "POST",
    headers: ingestAuthHeaders(),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return ApiError.fromStatus(res.status, data.detail || "Ingest service failed while retrying OCR.").toResponse();
  }

  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: body.sourceFileId ? "RETRY_AI_IMPORT_SOURCE_FILE" : "RETRY_AI_IMPORT_FAILED_JOBS",
      targetType: body.sourceFileId ? "IngestSourceFile" : "IngestBatch",
      targetId: body.sourceFileId ?? batchId,
      metadata: JSON.stringify({ batchId, sourceFileId: body.sourceFileId ?? null, limit, result: data }),
    },
  });

  return NextResponse.json(data);
});
