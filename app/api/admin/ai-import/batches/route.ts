import { NextRequest, NextResponse } from "next/server";
import { requireTeacherOrAdmin } from "@/lib/rbac";
import prisma from "@/lib/prisma";
import { ingestAuthHeaders, ingestUrl } from "@/lib/internal-ingest";
import { uploadSourceId } from "@/lib/content-source";
import { ApiError, BadRequestError, ForbiddenError, withApiErrors } from "@/lib/api-error";

export const GET = withApiErrors(async function GET() {
  const session = await requireTeacherOrAdmin();
  if (!session) return new ForbiddenError("Forbidden").toResponse();

  const batches = await prisma.ingestBatch.findMany({
    orderBy: { createdAt: "desc" },
    take: 25,
  });

  const withCounts = await Promise.all(
    batches.map(async (batch) => {
      const [files, pages, candidates, incidents] = await Promise.all([
        prisma.ingestSourceFile.count({ where: { batchId: batch.id } }),
        prisma.ingestPageArtifact.count({ where: { batchId: batch.id } }),
        prisma.ingestQuestionCandidate.count({ where: { batchId: batch.id } }),
        prisma.ingestIncident.count({ where: { batchId: batch.id } }),
      ]);
      return { ...batch, files, pages, candidates, incidents };
    })
  );

  return NextResponse.json({ batches: withCounts });
});

export const POST = withApiErrors(async function POST(req: NextRequest) {
  const session = await requireTeacherOrAdmin();
  if (!session) return new ForbiddenError("Forbidden").toResponse();

  const body = await req.json().catch(() => ({}));
  const source = await uploadSourceId(typeof body.sourceId === "string" ? body.sourceId : null);
  if (source.error) return new BadRequestError(source.error).toResponse();
  const res = await fetch(ingestUrl("/batches"), {
    method: "POST",
    headers: ingestAuthHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({
      name: body.name || "AI content ingest",
      basePath: body.basePath || "files_to_load",
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return ApiError.fromStatus(res.status, data.detail || "Ingest service failed.").toResponse();
  }

  // Content source of what this batch will promote (AI Import "Source" field).
  if (source.sourceId && data.id) await prisma.ingestBatch.update({ where: { id: data.id }, data: { sourceId: source.sourceId, createdById: session.user.id } });

  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: "CREATE_AI_IMPORT_BATCH",
      targetType: "IngestBatch",
      targetId: data.id,
      metadata: JSON.stringify(data),
    },
  });

  return NextResponse.json(data);
});
