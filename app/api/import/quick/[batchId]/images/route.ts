import { NextRequest, NextResponse } from "next/server";
import { assertContentImporter } from "@/lib/rbac";
import { ApiError, PayloadTooLargeError, ValidationError, withApiErrors } from "@/lib/api-error";
import { ingestAuthHeaders, ingestUrl } from "@/lib/internal-ingest";
import { writeAudit } from "@/lib/audit";
import { loadQuickBatch } from "@/lib/quick-import.server";

export const runtime = "nodejs";
export const maxDuration = 300;

type Ctx = { params: Promise<{ batchId: string }> };

// POST /api/import/quick/[batchId]/images — form `file`: zip of images recovered by the external AI
// (Q3_STEM.png, Q5_A.png…; Tests RW1_Q3_STEM.png…). Each image is linked to that question's slot.
export const POST = withApiErrors(async function POST(req: NextRequest, { params }: Ctx) {
  const session = await assertContentImporter();
  const { batchId } = await params;
  await loadQuickBatch(batchId, session.user);
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File) || !file.name.toLowerCase().endsWith(".zip")) throw new ValidationError("Validation failed.", ["Upload the images as a .zip file."]);
  if (file.size > 256 * 1024 * 1024) throw new PayloadTooLargeError("ZIP exceeds the 256 MB limit.");

  const upstream = new FormData();
  upstream.set("file", file, file.name);
  const res = await fetch(ingestUrl(`/batches/${batchId}/image-zip`), { method: "POST", headers: ingestAuthHeaders(), body: upstream });
  const data = (await res.json().catch(() => ({}))) as { linked?: unknown[]; skipped?: string[]; detail?: string };
  if (!res.ok) throw ApiError.fromStatus(res.status, data.detail || "The import service could not read the zip.");
  await writeAudit({ userId: session.user.id, action: "QUICK_IMPORT_IMAGES_LOADED", targetType: "IngestBatch", targetId: batchId, metadata: { linked: data.linked?.length ?? 0, skipped: data.skipped?.length ?? 0 } });
  return NextResponse.json({ linked: data.linked?.length ?? 0, skipped: data.skipped ?? [] });
});
