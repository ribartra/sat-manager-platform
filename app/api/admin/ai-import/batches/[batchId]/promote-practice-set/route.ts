import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { requireTeacherOrAdmin } from "@/lib/rbac";
import prisma from "@/lib/prisma";
import { normalizeIngestDifficulty } from "@/lib/ingest-promotion";

interface RouteContext {
  params: Promise<{ batchId: string }>;
}

export async function POST(req: NextRequest, { params }: RouteContext) {
  const session = await requireTeacherOrAdmin();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { batchId } = await params;
  const body = (await req.json().catch(() => ({}))) as { sourceFileId?: string; allowPartial?: boolean };
  if (!body.sourceFileId) return NextResponse.json({ error: "sourceFileId is required." }, { status: 400 });

  const [sourceFile, candidates] = await Promise.all([
    prisma.ingestSourceFile.findFirst({ where: { id: body.sourceFileId, batchId } }),
    prisma.ingestQuestionCandidate.findMany({
      where: {
        batchId,
        sourceFileId: body.sourceFileId,
        contentType: "PRACTICE_SET",
        promotionStatus: "PROMOTED",
        officialQuestionId: { not: null },
      },
      orderBy: [{ questionNumber: "asc" }, { createdAt: "asc" }],
    }),
  ]);
  if (!sourceFile) return NextResponse.json({ error: "Source file not found." }, { status: 404 });
  if (candidates.length === 0) return NextResponse.json({ error: "No promoted questions found for this source file." }, { status: 400 });
  const totalSourceCandidates = await prisma.ingestQuestionCandidate.count({
    where: { batchId, sourceFileId: sourceFile.id, contentType: "PRACTICE_SET", stem: { not: null } },
  });
  const partial = candidates.length < totalSourceCandidates;
  if (partial && !body.allowPartial) {
    return NextResponse.json({
      error: "This Practice Set is partial. Confirm allowPartial to create/update a draft with promoted questions only.",
      promoted: candidates.length,
      total: totalSourceCandidates,
    }, { status: 409 });
  }

  const questionIds = candidates.map((candidate) => candidate.officialQuestionId).filter((id): id is string => Boolean(id));
  const questions = await prisma.question.findMany({ where: { id: { in: questionIds } }, select: { id: true, topicId: true } });
  if (questions.length !== questionIds.length) return NextResponse.json({ error: "Some promoted questions no longer exist." }, { status: 400 });
  const topicIds = new Set(questions.map((question) => question.topicId));
  if (topicIds.size !== 1) return NextResponse.json({ error: "Practice Set questions must resolve to a single topic." }, { status: 400 });

  const groupKey = `practice-set:${sourceFile.id}`;
  const name = [
    sourceFile.domainName,
    sourceFile.topicName ?? "Imported Practice Set",
    normalizeIngestDifficulty(sourceFile.difficulty ?? candidates[0]?.difficulty),
    sourceFile.practiceSetVariant ? `#${sourceFile.practiceSetVariant}` : null,
  ].filter(Boolean).join(" - ");
  const existingArtifact = await prisma.ingestPromotionArtifact.findUnique({
    where: { batchId_artifactType_groupKey: { batchId, artifactType: "PRACTICE_SET", groupKey } },
  });

  const practiceSet = await prisma.$transaction(async (tx) => {
    if (existingArtifact) {
      await tx.practiceSetQuestion.deleteMany({ where: { practiceSetId: existingArtifact.artifactId } });
      const updated = await tx.practiceSet.update({
        where: { id: existingArtifact.artifactId },
        data: {
          name: partial ? `${name} (partial ${questionIds.length}/${totalSourceCandidates})` : name,
          topicId: [...topicIds][0],
          difficulty: normalizeIngestDifficulty(sourceFile.difficulty ?? candidates[0]?.difficulty),
          status: "DRAFT",
          explanationVisibility: "AFTER_FINISH",
          questions: { create: questionIds.map((questionId, order) => ({ questionId, order })) },
        },
      });
      return updated;
    }

    const created = await tx.practiceSet.create({
      data: {
        name: partial ? `${name} (partial ${questionIds.length}/${totalSourceCandidates})` : name,
        topicId: [...topicIds][0],
        difficulty: normalizeIngestDifficulty(sourceFile.difficulty ?? candidates[0]?.difficulty),
        status: "DRAFT",
        explanationVisibility: "AFTER_FINISH",
        questions: { create: questionIds.map((questionId, order) => ({ questionId, order })) },
      },
    });
    await tx.ingestPromotionArtifact.create({
      data: {
        id: `promo_${randomUUID().replace(/-/g, "")}`,
        batchId,
        sourceFileId: sourceFile.id,
        artifactType: "PRACTICE_SET",
        artifactId: created.id,
        groupKey,
        createdById: session.user.id,
      },
    });
    return created;
  });

  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: "PROMOTE_AI_IMPORT_PRACTICE_SET",
      targetType: "PracticeSet",
      targetId: practiceSet.id,
      metadata: JSON.stringify({ batchId, sourceFileId: sourceFile.id, questionCount: questionIds.length, totalSourceCandidates, partial }),
    },
  });

  return NextResponse.json({ practiceSet, questionCount: questionIds.length, totalSourceCandidates, partial });
}
