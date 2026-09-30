import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { requireTeacherOrAdmin } from "@/lib/rbac";
import prisma from "@/lib/prisma";
import { questionEditorIssues } from "@/contracts/question";
import { materializeOfficialImageUrl } from "@/lib/ingest-promotion";
import { ForbiddenError, NotFoundError, ValidationError, withApiErrors } from "@/lib/api-error";

export const POST = withApiErrors(async function POST(req: NextRequest) {
  const session = await requireTeacherOrAdmin();
  if (!session) {
    return new ForbiddenError("Forbidden").toResponse();
  }

  const data = await req.json();
  const { topicId, subskillId, difficulty, type, stem, stimulus, explanation, imageUrl, supportsGraph, correctAnswer, status, options, ingestCandidateId } = data;
  const validationErrors = questionEditorIssues({
    topicId,
    difficulty,
    type,
    stem,
    explanation,
    imageUrl,
    correctAnswer,
    status,
    options,
  });
  if (validationErrors.length > 0) {
    return new ValidationError("Validation failed.", validationErrors).toResponse();
  }

  const ingestCandidate = ingestCandidateId
    ? await prisma.ingestQuestionCandidate.findUnique({ where: { id: ingestCandidateId } })
    : null;
  if (ingestCandidateId && !ingestCandidate) {
    return new NotFoundError("Ingest candidate not found.").toResponse();
  }
  const officialImageUrl = await materializeOfficialImageUrl(imageUrl);
  const officialOptions = type === "MC"
    ? await Promise.all(
        options.map(async (o: { label: string; text: string; imageUrl?: string | null }) => ({
          ...o,
          imageUrl: await materializeOfficialImageUrl(o.imageUrl),
        }))
      )
    : options;

  const question = await prisma.$transaction(async (tx) => {
    const created = await tx.question.create({
      data: {
        topicId,
        subskillId: subskillId || null,
        difficulty,
        type,
        stem,
        stimulus: stimulus || null,
        explanation: explanation || null,
        imageUrl: officialImageUrl || null,
        supportsGraph: Boolean(supportsGraph),
        correctAnswer,
        status,
        options: type === "MC" ? {
          create: officialOptions
            .filter((o: { text?: string; imageUrl?: string | null }) => Boolean(o.text?.trim() || o.imageUrl?.trim()))
            .map((o: { label: string; text?: string; imageUrl?: string | null }) => ({
              label: o.label,
              text: o.text ?? "",
              imageUrl: o.imageUrl || null,
            })),
        } : undefined,
      },
    });

    if (ingestCandidate) {
      await tx.ingestQuestionCandidate.update({
        where: { id: ingestCandidate.id },
        data: {
          officialQuestionId: created.id,
          promotionStatus: "PROMOTED",
          promotedAt: new Date(),
          promotedById: session.user.id,
          status: "REVIEWED",
        },
      });
      await tx.ingestPromotionArtifact.upsert({
        where: {
          batchId_artifactType_groupKey: {
            batchId: ingestCandidate.batchId,
            artifactType: "QUESTION",
            groupKey: ingestCandidate.id,
          },
        },
        create: {
          id: `promo_${randomUUID().replace(/-/g, "")}`,
          batchId: ingestCandidate.batchId,
          sourceFileId: ingestCandidate.sourceFileId,
          artifactType: "QUESTION",
          artifactId: created.id,
          groupKey: ingestCandidate.id,
          createdById: session.user.id,
        },
        update: {
          artifactId: created.id,
          createdById: session.user.id,
        },
      });
    }

    return created;
  });

  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: status === "PUBLISHED" ? "PUBLISH_QUESTION" : "CREATE_QUESTION",
      targetType: "Question",
      targetId: question.id,
        metadata: JSON.stringify({ topicId, difficulty, type, status, supportsGraph: Boolean(supportsGraph), ingestCandidateId: ingestCandidateId ?? null }),
      },
    });

  return NextResponse.json(question);
});
