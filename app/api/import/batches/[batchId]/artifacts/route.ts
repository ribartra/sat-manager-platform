import { NextResponse } from "next/server";
import { assertContentImporter } from "@/lib/rbac";
import { withApiErrors } from "@/lib/api-error";
import { buildArtifactsZip, loadImportBatch } from "@/lib/import-media.server";

export const runtime = "nodejs";
export const maxDuration = 300;

type Ctx = { params: Promise<{ batchId: string }> };

// GET /api/import/batches/[batchId]/artifacts — any import batch (Import with AI or OCR AI Import) the
// user may touch: zip with the original files, every page as PNG, its questions and the prompts.
export const GET = withApiErrors(async function GET(_req: Request, { params }: Ctx) {
  const session = await assertContentImporter();
  const { batchId } = await params;
  await loadImportBatch(batchId, session.user);
  return new NextResponse(await buildArtifactsZip(batchId), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="import-artifacts-${batchId}.zip"`,
      "Cache-Control": "no-store",
    },
  });
});
