import { NextRequest, NextResponse } from "next/server";
import { assertContentImporter } from "@/lib/rbac";
import { PayloadTooLargeError, ValidationError, withApiErrors } from "@/lib/api-error";
import { uploadImagesZip } from "@/lib/import-media.server";
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

  const result = await uploadImagesZip(batchId, file);
  await writeAudit({ userId: session.user.id, action: "QUICK_IMPORT_IMAGES_LOADED", targetType: "IngestBatch", targetId: batchId, metadata: { linked: result.linked, propagated: result.propagated, skipped: result.skipped.length } });
  return NextResponse.json(result);
});
