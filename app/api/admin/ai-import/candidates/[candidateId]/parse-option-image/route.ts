import { NextRequest, NextResponse } from "next/server";
import { requireTeacherOrAdmin } from "@/lib/rbac";
import prisma from "@/lib/prisma";
import { ingestAuthHeaders, ingestUrl } from "@/lib/internal-ingest";

interface RouteContext {
  params: Promise<{ candidateId: string }>;
}

export async function POST(req: NextRequest, { params }: RouteContext) {
  const session = await requireTeacherOrAdmin();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { candidateId } = await params;
  const body = (await req.json().catch(() => ({}))) as { imageArtifactId?: string };
  if (!body.imageArtifactId) return NextResponse.json({ error: "imageArtifactId is required." }, { status: 400 });

  const candidate = await prisma.ingestQuestionCandidate.findUnique({ where: { id: candidateId } });
  if (!candidate) return NextResponse.json({ error: "Candidate not found." }, { status: 404 });

  const response = await fetch(ingestUrl(`/candidates/${candidateId}/parse-option-image`), {
    method: "POST",
    headers: ingestAuthHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ imageArtifactId: body.imageArtifactId }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    return NextResponse.json({ error: data.detail || "Could not parse option image." }, { status: response.status });
  }

  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: "PARSE_AI_IMPORT_OPTION_IMAGE",
      targetType: "IngestQuestionCandidate",
      targetId: candidateId,
      metadata: JSON.stringify({ imageArtifactId: body.imageArtifactId, result: data }),
    },
  });

  return NextResponse.json(data);
}
