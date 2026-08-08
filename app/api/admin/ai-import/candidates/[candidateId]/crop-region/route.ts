import { NextRequest, NextResponse } from "next/server";
import { requireTeacherOrAdmin } from "@/lib/rbac";
import prisma from "@/lib/prisma";
import { ingestAuthHeaders, ingestUrl } from "@/lib/internal-ingest";

interface RouteContext {
  params: Promise<{ candidateId: string }>;
}

const TARGET_TYPES = ["STEM", "STIMULUS", "OPTION", "OPTION_BLOCK", "ANSWER_FIELD", "EXPLANATION", "PAGE_CONTEXT"];

interface CropBody {
  pageNumber?: number;
  bbox?: { x0: number; y0: number; x1: number; y1: number };
  mode?: string;
  targetType?: string;
  optionLabel?: string | null;
}

// Crops a region of the candidate's source PDF and either ASSIGNs it (creates an
// image link to stem/option/…) or OCRs it (returns text for review). Proxies the
// ingest service, which does the render + persistence.
export async function POST(req: NextRequest, { params }: RouteContext) {
  const session = await requireTeacherOrAdmin();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { candidateId } = await params;
  const body = (await req.json().catch(() => ({}))) as CropBody;

  if (typeof body.pageNumber !== "number" || !Number.isInteger(body.pageNumber) || body.pageNumber < 1) {
    return NextResponse.json({ error: "pageNumber is required." }, { status: 400 });
  }
  if (!body.bbox || typeof body.bbox.x0 !== "number") {
    return NextResponse.json({ error: "bbox {x0,y0,x1,y1} (normalized) is required." }, { status: 400 });
  }
  const mode = (body.mode || "ASSIGN").toUpperCase();
  if (!["ASSIGN", "OCR"].includes(mode)) {
    return NextResponse.json({ error: "mode must be ASSIGN or OCR." }, { status: 400 });
  }
  const targetType = (body.targetType || "PAGE_CONTEXT").toUpperCase();
  if (!TARGET_TYPES.includes(targetType)) {
    return NextResponse.json({ error: "Invalid targetType." }, { status: 400 });
  }
  if (targetType === "OPTION" && !body.optionLabel) {
    return NextResponse.json({ error: "optionLabel is required for OPTION target." }, { status: 400 });
  }

  const candidate = await prisma.ingestQuestionCandidate.findUnique({ where: { id: candidateId } });
  if (!candidate) return NextResponse.json({ error: "Candidate not found." }, { status: 404 });

  const response = await fetch(ingestUrl(`/candidates/${candidateId}/crop-region`), {
    method: "POST",
    headers: ingestAuthHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({
      pageNumber: body.pageNumber,
      bbox: body.bbox,
      mode,
      targetType,
      optionLabel: body.optionLabel ?? null,
    }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    return NextResponse.json({ error: data.detail || "Could not process the crop." }, { status: response.status });
  }

  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: mode === "OCR" ? "AI_IMPORT_CROP_OCR" : "AI_IMPORT_CROP_ASSIGN",
      targetType: "IngestQuestionCandidate",
      targetId: candidateId,
      metadata: JSON.stringify({
        pageNumber: body.pageNumber,
        targetType,
        optionLabel: body.optionLabel ?? null,
        imageArtifactId: data.imageArtifactId ?? null,
      }),
    },
  });

  return NextResponse.json(data);
}
