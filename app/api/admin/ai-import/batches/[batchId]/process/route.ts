import { NextResponse } from "next/server";
import { requireTeacherOrAdmin } from "@/lib/rbac";
import prisma from "@/lib/prisma";
import { ingestAuthHeaders, ingestUrl } from "@/lib/internal-ingest";

interface RouteContext {
  params: Promise<{ batchId: string }>;
}

export async function POST(_req: Request, { params }: RouteContext) {
  const session = await requireTeacherOrAdmin();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { batchId } = await params;
  const batch = await prisma.ingestBatch.findUnique({ where: { id: batchId } });
  if (!batch) return NextResponse.json({ error: "Batch not found." }, { status: 404 });

  const res = await fetch(ingestUrl(`/batches/${batchId}/process`), { method: "POST", headers: ingestAuthHeaders() });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return NextResponse.json({ error: data.detail || "Ingest service failed." }, { status: res.status });
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
}
