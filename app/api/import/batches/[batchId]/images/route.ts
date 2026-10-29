import { NextRequest, NextResponse } from "next/server";
import { assertContentImporter } from "@/lib/rbac";
import { PayloadTooLargeError, ValidationError, withApiErrors } from "@/lib/api-error";
import { writeAudit } from "@/lib/audit";
import { loadImportBatch, scopeCandidateIds, uploadImagesZip } from "@/lib/import-media.server";

export const runtime = "nodejs";
export const maxDuration = 300;

type Ctx = { params: Promise<{ batchId: string }> };

// POST /api/import/batches/[batchId]/images — form `file`: zip of images the external AI recovered
// (Q3_STEM.png, Q5_A.png; Tests RW1_Q3_STEM.png…). Linked to their questions, and to the official
// questions already created from them.
export const POST = withApiErrors(async function POST(req: NextRequest, { params }: Ctx) {
  const session = await assertContentImporter();
  const { batchId } = await params;
  await loadImportBatch(batchId, session.user);
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File) || !file.name.toLowerCase().endsWith(".zip")) throw new ValidationError("Validation failed.", ["Upload the images as a .zip file."]);
  if (file.size > 256 * 1024 * 1024) throw new PayloadTooLargeError("ZIP exceeds the 256 MB limit.");
  // ?scope=practice-sets:<id> | tests:<id> — the editor's "Images & source files" of one set / test.
  const candidateIds = await scopeCandidateIds(batchId, req.nextUrl.searchParams.get("scope"), session.user);
  const result = await uploadImagesZip(batchId, file, candidateIds);
  await writeAudit({ userId: session.user.id, action: "QUICK_IMPORT_IMAGES_LOADED", targetType: "IngestBatch", targetId: batchId, metadata: { linked: result.linked, propagated: result.propagated, skipped: result.skipped.length } });
  return NextResponse.json(result);
});
