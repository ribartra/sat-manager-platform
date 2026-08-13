import { NextRequest, NextResponse } from "next/server";
import { requireTeacherOrAdmin } from "@/lib/rbac";
import prisma from "@/lib/prisma";
import { stripIngestImagePlaceholders } from "@/lib/ingest-text-sanitize";
import { cleanupOfficialQuestionPlaceholders } from "@/lib/ingest-image-cleanup";
import { reconcileWarningsJson } from "@/lib/ingest-warnings";

interface RouteContext {
  params: Promise<{ candidateId: string }>;
}

const allowedStatuses = new Set(["NEEDS_REVIEW", "READY", "REVIEWED", "REJECTED"]);

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const session = await requireTeacherOrAdmin();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { candidateId } = await params;
  const body = (await req.json().catch(() => ({}))) as {
    status?: string;
    stem?: string | null;
    stimulus?: string | null;
    optionsJson?: string | null;
    correctAnswer?: string | null;
    explanation?: string | null;
    section?: string | null;
    domainName?: string | null;
    topicName?: string | null;
    subskillName?: string | null;
    difficulty?: string | null;
    type?: string;
  };

  if (body.status && !allowedStatuses.has(body.status)) {
    return NextResponse.json({ error: "Invalid status." }, { status: 400 });
  }

  const existing = await prisma.ingestQuestionCandidate.findUnique({
    where: { id: candidateId },
    select: { warningsJson: true, correctAnswer: true },
  });
  if (!existing) return NextResponse.json({ error: "Candidate not found." }, { status: 404 });

  const nextAnswer =
    body.correctAnswer !== undefined ? body.correctAnswer || null : existing.correctAnswer;
  const reconciledWarnings = reconcileWarningsJson(existing.warningsJson, {
    correctAnswer: nextAnswer,
  });

  const candidate = await prisma.ingestQuestionCandidate.update({
    where: { id: candidateId },
    data: {
      ...(body.status ? { status: body.status } : {}),
      ...(body.stem !== undefined ? { stem: stripIngestImagePlaceholders(body.stem) || null } : {}),
      ...(body.stimulus !== undefined ? { stimulus: stripIngestImagePlaceholders(body.stimulus) || null } : {}),
      ...(body.optionsJson !== undefined ? { optionsJson: body.optionsJson || null } : {}),
      ...(body.correctAnswer !== undefined ? { correctAnswer: body.correctAnswer || null } : {}),
      ...(body.explanation !== undefined
        ? { explanation: stripIngestImagePlaceholders(body.explanation) || null }
        : {}),
      ...(body.section !== undefined ? { section: body.section || null } : {}),
      ...(body.domainName !== undefined ? { domainName: body.domainName || null } : {}),
      ...(body.topicName !== undefined ? { topicName: body.topicName || null } : {}),
      ...(body.subskillName !== undefined ? { subskillName: body.subskillName || null } : {}),
      ...(body.difficulty !== undefined ? { difficulty: body.difficulty || null } : {}),
      ...(body.type ? { type: body.type } : {}),
      warningsJson: reconciledWarnings.json,
    },
  });

  if (candidate.officialQuestionId) {
    const officialPatch: { stem?: string; stimulus?: string | null; explanation?: string | null } = {};
    if (body.stem !== undefined) officialPatch.stem = stripIngestImagePlaceholders(body.stem) || candidate.stem || "";
    if (body.stimulus !== undefined) officialPatch.stimulus = stripIngestImagePlaceholders(body.stimulus) || null;
    if (body.explanation !== undefined) {
      officialPatch.explanation = stripIngestImagePlaceholders(body.explanation) || null;
    }
    if (Object.keys(officialPatch).length > 0) {
      await prisma.question.update({
        where: { id: candidate.officialQuestionId },
        data: officialPatch,
      });
    }
    await cleanupOfficialQuestionPlaceholders(candidate.officialQuestionId).catch(() => null);
  }

  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: "UPDATE_AI_IMPORT_CANDIDATE",
      targetType: "IngestQuestionCandidate",
      targetId: candidateId,
      metadata: JSON.stringify(body),
    },
  });

  return NextResponse.json(candidate);
}
