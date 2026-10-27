import { NextRequest, NextResponse } from "next/server";
import { contentProgramFor } from "@/lib/program-scope";
import { randomUUID } from "crypto";
import { requireTeacherOrAdmin } from "@/lib/rbac";
import prisma from "@/lib/prisma";
import { normalizeIngestDifficulty } from "@/lib/ingest-promotion";
import { ApiError, BadRequestError, ForbiddenError, NotFoundError, withApiErrors } from "@/lib/api-error";

interface RouteContext {
  params: Promise<{ batchId: string }>;
}

export const POST = withApiErrors(async function POST(req: NextRequest, { params }: RouteContext) {
  const session = await requireTeacherOrAdmin();
  if (!session) return new ForbiddenError("Forbidden").toResponse();

  const { batchId } = await params;
  const body = (await req.json().catch(() => ({}))) as { sourceFileId?: string; allowPartial?: boolean };
  if (!body.sourceFileId) return new BadRequestError("sourceFileId is required.").toResponse();

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
  if (!sourceFile) return new NotFoundError("Source file not found.").toResponse();
  if (candidates.length === 0) return new BadRequestError("No promoted questions found for this source file.").toResponse();
  const totalSourceCandidates = await prisma.ingestQuestionCandidate.count({
    where: { batchId, sourceFileId: sourceFile.id, contentType: "PRACTICE_SET", stem: { not: null } },
  });
  const partial = candidates.length < totalSourceCandidates;
  if (partial && !body.allowPartial) {
    return ApiError.fromStatus(409, "This Practice Set is partial. Confirm allowPartial to create/update a draft with promoted questions only.", { promoted: candidates.length, total: totalSourceCandidates }).toResponse();
  }

  const questionIds = candidates.map((candidate) => candidate.officialQuestionId).filter((id): id is string => Boolean(id));
  const questions = await prisma.question.findMany({ where: { id: { in: questionIds } }, select: { id: true, topicId: true, programId: true } });
  if (questions.length !== questionIds.length) return new BadRequestError("Some promoted questions no longer exist.").toResponse();
  // The set lives in its questions' program bank (all from one program).
  const questionPrograms = new Set(questions.map((question) => question.programId));
  if (questionPrograms.size !== 1) return new BadRequestError("All questions must come from this program's question bank.").toResponse();
  const programId = [...questionPrograms][0] ?? (await contentProgramFor(session.user));
  await contentProgramFor(session.user, programId);
  const topicIds = new Set(questions.map((question) => question.topicId));
  if (topicIds.size !== 1) return new BadRequestError("Practice Set questions must resolve to a single topic.").toResponse();

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
        programId,
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
});
