import { NextResponse } from "next/server";
import { requireTeacherOrAdmin } from "@/lib/rbac";
import prisma from "@/lib/prisma";
import { ingestAuthHeaders, ingestUrl } from "@/lib/internal-ingest";
import { ApiError, ForbiddenError, NotFoundError, withApiErrors } from "@/lib/api-error";

interface RouteContext {
  params: Promise<{ batchId: string }>;
}

export const POST = withApiErrors(async function POST(_req: Request, { params }: RouteContext) {
  const session = await requireTeacherOrAdmin();
  if (!session) return new ForbiddenError("Forbidden").toResponse();

  const { batchId } = await params;
  const batch = await prisma.ingestBatch.findUnique({ where: { id: batchId } });
  if (!batch) return new NotFoundError("Batch not found.").toResponse();

  const res = await fetch(ingestUrl(`/batches/${batchId}/process`), { method: "POST", headers: ingestAuthHeaders() });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return ApiError.fromStatus(res.status, data.detail || "Ingest service failed.").toResponse();
  }

  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: "PROCESS_AI_IMPORT_BATCH",
      targetType: "IngestBatch",
      targetId: batchId,
      metadata: JSON.stringify(data),
    },
  });

  return NextResponse.json(data);
});
