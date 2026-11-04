import { NextRequest, NextResponse } from "next/server";
import { requireTeacherOrAdmin } from "@/lib/rbac";
import prisma from "@/lib/prisma";
import { ingestAuthHeaders, ingestUrl } from "@/lib/internal-ingest";
import { ApiError, BadRequestError, ForbiddenError, NotFoundError, withApiErrors } from "@/lib/api-error";

interface RouteContext {
  params: Promise<{ sourceFileId: string; pageNumber: string }>;
}

// Renders a source PDF page to JPEG for the crop tool. Proxies the ingest service
// (which reads the PDF from disk) so the internal token never reaches the browser.
export const GET = withApiErrors(async function GET(req: NextRequest, { params }: RouteContext) {
  const session = await requireTeacherOrAdmin();
  if (!session) return new ForbiddenError("Forbidden").toResponse();

  const { sourceFileId, pageNumber } = await params;
  const pageNum = Number(pageNumber);
  if (!Number.isInteger(pageNum) || pageNum < 1) {
    return new BadRequestError("Invalid page number.").toResponse();
  }

  const source = await prisma.ingestSourceFile.findUnique({ where: { id: sourceFileId }, select: { id: true, extension: true } });
  if (!source) return new NotFoundError("Source file not found.").toResponse();

  // The FastAPI renderer only handles PDFs (pdfplumber). For a DOCX source (or if
  // the PDF render fails) fall back to the per-page image already extracted at
  // ingest (IngestImageArtifact), so the crop tool at least shows the page.
  async function extractedPageFallback() {
    const img = await prisma.ingestImageArtifact.findFirst({
      // Exclude manual crops and order by imageIndex asc so the displayed page image
      // matches the one the ingest service crops from (find_page_image_disk_path).
      where: { sourceFileId, pageNumber: pageNum, origin: { notIn: ["MANUAL_CROP", "AI_CROP", "AI_ZIP"] } },
      orderBy: { imageIndex: "asc" },
      select: { fileUrl: true },
    });
    if (img?.fileUrl) return NextResponse.redirect(new URL(img.fileUrl, req.nextUrl.origin));
    return null;
  }

  const dpiParam = Number(req.nextUrl.searchParams.get("dpi"));
  const dpi = Number.isFinite(dpiParam) && dpiParam > 0 ? Math.min(300, Math.max(72, Math.round(dpiParam))) : 150;

  if ((source.extension ?? "").toLowerCase() !== "pdf") {
    const fallback = await extractedPageFallback();
    if (fallback) return fallback;
    return new NotFoundError("No page image is available for this file.").toResponse();
  }

  const response = await fetch(ingestUrl(`/sources/${sourceFileId}/pages/${pageNum}/image?dpi=${dpi}`), {
    headers: ingestAuthHeaders(),
  });
  if (!response.ok) {
    const fallback = await extractedPageFallback();
    if (fallback) return fallback;
    const data = await response.json().catch(() => ({}));
    return ApiError.fromStatus(response.status, data.detail || "Could not render page.").toResponse();
  }

  const buffer = await response.arrayBuffer();
  return new NextResponse(buffer, {
    status: 200,
    headers: {
      "Content-Type": "image/jpeg",
      "Cache-Control": "private, max-age=300",
      "X-Page-Width": response.headers.get("X-Page-Width") ?? "",
      "X-Page-Height": response.headers.get("X-Page-Height") ?? "",
    },
  });
});
