import { NextResponse } from "next/server";
import { requireTeacherOrAdmin } from "@/lib/rbac";
import prisma from "@/lib/prisma";
import { ForbiddenError, NotFoundError, withApiErrors } from "@/lib/api-error";

interface RouteContext {
  params: Promise<{ batchId: string }>;
}

/**
 * Lightweight progress fingerprint for AI Import polling (TanStack Query).
 * RSC page still owns the full review UI; this endpoint only drives refresh.
 */
export const GET = withApiErrors(async function GET(_req: Request, { params }: RouteContext) {
  const session = await requireTeacherOrAdmin();
  if (!session) return new ForbiddenError("Forbidden").toResponse();

  const { batchId } = await params;
  const batch = await prisma.ingestBatch.findUnique({
    where: { id: batchId },
    select: {
      id: true,
      status: true,
      updatedAt: true,
      filesProcessed: true,
      totalFiles: true,
      pagesProcessed: true,
      totalPages: true,
      lastError: true,
    },
  });
  if (!batch) return new NotFoundError("Batch not found.").toResponse();

  const [candidates, incidents, latestEvent] = await Promise.all([
    prisma.ingestQuestionCandidate.count({ where: { batchId } }),
    prisma.ingestIncident.count({ where: { batchId, status: { not: "RESOLVED" } } }),
    prisma.ingestJobEvent.findFirst({
      where: { batchId },
      orderBy: { createdAt: "desc" },
      select: { status: true, createdAt: true },
    }),
  ]);

  const fingerprint = [
    batch.status,
    batch.updatedAt.toISOString(),
    batch.filesProcessed,
    batch.totalFiles,
    batch.pagesProcessed,
    batch.totalPages,
    candidates,
    incidents,
    latestEvent?.status ?? "",
    latestEvent?.createdAt?.toISOString() ?? "",
  ].join("|");

  return NextResponse.json({
    id: batch.id,
    status: batch.status,
    updatedAt: batch.updatedAt.toISOString(),
    filesProcessed: batch.filesProcessed,
    totalFiles: batch.totalFiles,
    pagesProcessed: batch.pagesProcessed,
    totalPages: batch.totalPages,
    candidates,
    openIncidents: incidents,
    latestEventStatus: latestEvent?.status ?? null,
    fingerprint,
  });
});
