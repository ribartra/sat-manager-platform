import { NextResponse } from "next/server";
import { assertContentImporter } from "@/lib/rbac";
import { withApiErrors } from "@/lib/api-error";
import { loadQuickBatch } from "@/lib/quick-import.server";
import { buildArtifactsZip } from "@/lib/import-media.server";

export const runtime = "nodejs";
export const maxDuration = 300;

type Ctx = { params: Promise<{ batchId: string }> };

// GET /api/import/quick/[batchId]/artifacts — reprocess: zip with the original PDF(s), every page as
// PNG, the questions imported so far (candidates.csv) and the prompts (CSV + image recovery).
export const GET = withApiErrors(async function GET(_req: Request, { params }: Ctx) {
  const session = await assertContentImporter();
  const { batchId } = await params;
  await loadQuickBatch(batchId, session.user);
  return new NextResponse(await buildArtifactsZip(batchId), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="import-artifacts-${batchId}.zip"`,
      "Cache-Control": "no-store",
    },
  });
});
