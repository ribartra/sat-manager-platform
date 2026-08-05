import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { requireTeacherOrAdmin } from "@/lib/rbac";
import prisma from "@/lib/prisma";
import {
  buildQuestionDraft,
  materializeOfficialImageUrl,
} from "@/lib/ingest-promotion";
import { validateQuestionPayload } from "@/lib/content-validation";

interface RouteContext {
  params: Promise<{ batchId: string }>;
}

type CandidatePayload = {
  candidateIds?: unknown;
};

export async function POST(req: NextRequest, { params }: RouteContext) {
  const session = await requireTeacherOrAdmin();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { batchId } = await params;
  const body = (await req.json().catch(() => ({}))) as CandidatePayload;
  const candidateIds = Array.isArray(body.candidateIds)
    ? [...new Set(body.candidateIds.filter((id): id is string => typeof id === "string" && id.length > 0))]
    : [];
  if (candidateIds.length === 0) return NextResponse.json({ error: "candidateIds is required." }, { status: 400 });
  if (candidateIds.length > 250) return NextResponse.json({ error: "Promote at most 250 questions at a time." }, { status: 413 });

  const [candidates, topics, rawLinks] = await Promise.all([
    prisma.ingestQuestionCandidate.findMany({
      where: { id: { in: candidateIds }, batchId },
      orderBy: [{ sourceFileId: "asc" }, { questionNumber: "asc" }, { createdAt: "asc" }],
    }),
    prisma.topic.findMany({ include: { domain: { include: { section: true } }, subskills: true }, orderBy: { name: "asc" } }),
    prisma.ingestCandidateImageLink.findMany({
      where: { batchId, candidateId: { in: candidateIds } },
      orderBy: [{ candidateId: "asc" }, { targetType: "asc" }, { sortOrder: "asc" }],
    }),
  ]);

  const images = rawLinks.length
    ? await prisma.ingestImageArtifact.findMany({
        where: { id: { in: rawLinks.map((link) => link.imageArtifactId) } },
        select: { id: true, fileUrl: true, base64Data: true, mimeType: true },
      })
    : [];
  const imageById = new Map(images.map((image) => [image.id, image]));
  const linksByCandidate = new Map<string, typeof rawLinks>();
  for (const link of rawLinks) {
    const group = linksByCandidate.get(link.candidateId) ?? [];
    group.push(link);
    linksByCandidate.set(link.candidateId, group);
  }

  const promoted: string[] = [];
  const skipped: { candidateId: string; reason: string }[] = [];
  const errors: { candidateId: string; reason: string }[] = [];

  for (const candidate of candidates) {
    if (candidate.promotionStatus === "PROMOTED" && candidate.officialQuestionId) {
      skipped.push({ candidateId: candidate.id, reason: "Already promoted." });
      continue;
    }
    if (!["READY", "REVIEWED"].includes(candidate.status)) {
      skipped.push({ candidateId: candidate.id, reason: "Candidate must be READY or REVIEWED." });
      continue;
    }
    if (!candidate.stem || !candidate.correctAnswer) {
      skipped.push({ candidateId: candidate.id, reason: "Candidate needs stem and answer." });
      continue;
    }

    const imageLinks = (linksByCandidate.get(candidate.id) ?? []).map((link) => ({
      targetType: link.targetType,
      optionLabel: link.optionLabel,
      sortOrder: link.sortOrder,
      image: {
        fileUrl: imageById.get(link.imageArtifactId)?.fileUrl ?? null,
        base64Data: imageById.get(link.imageArtifactId)?.base64Data ?? null,
        mimeType: imageById.get(link.imageArtifactId)?.mimeType ?? null,
      },
    }));
    const draft = buildQuestionDraft({ candidate, topics, imageLinks });
    const validationErrors = validateQuestionPayload(draft);
    if (validationErrors.length > 0) {
      errors.push({ candidateId: candidate.id, reason: validationErrors.join(" ") });
      continue;
    }

    const officialImageUrl = await materializeOfficialImageUrl(draft.imageUrl);
    const officialOptions = draft.type === "MC"
      ? await Promise.all(
          draft.options.map(async (option) => ({
            ...option,
            imageUrl: await materializeOfficialImageUrl(option.imageUrl),
          }))
        )
      : [];

    const question = await prisma.$transaction(async (tx) => {
      const created = await tx.question.create({
        data: {
          topicId: draft.topicId,
          subskillId: draft.subskillId || null,
          difficulty: draft.difficulty,
          type: draft.type,
          stem: draft.stem,
          stimulus: draft.stimulus || null,
          explanation: draft.explanation || null,
          imageUrl: officialImageUrl || null,
          supportsGraph: Boolean(draft.supportsGraph),
          correctAnswer: draft.correctAnswer,
          status: draft.status,
          options: draft.type === "MC"
            ? {
                create: officialOptions
                  .filter((option) => option.text || option.imageUrl)
                  .map((option) => ({ label: option.label, text: option.text, imageUrl: option.imageUrl || null })),
              }
            : undefined,
        },
      });
      await tx.ingestQuestionCandidate.update({
        where: { id: candidate.id },
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
            batchId: candidate.batchId,
            artifactType: "QUESTION",
            groupKey: candidate.id,
          },
        },
        create: {
          id: `promo_${randomUUID().replace(/-/g, "")}`,
          batchId: candidate.batchId,
          sourceFileId: candidate.sourceFileId,
          artifactType: "QUESTION",
          artifactId: created.id,
          groupKey: candidate.id,
          createdById: session.user.id,
        },
        update: { artifactId: created.id, createdById: session.user.id },
      });
      return created;
    });
    promoted.push(question.id);
  }

  const missing = candidateIds.filter((id) => !candidates.some((candidate) => candidate.id === id));
  for (const candidateId of missing) skipped.push({ candidateId, reason: "Candidate not found in batch." });

  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: "PROMOTE_AI_IMPORT_QUESTIONS",
      targetType: "IngestBatch",
      targetId: batchId,
      metadata: JSON.stringify({ requested: candidateIds.length, promoted: promoted.length, skipped: skipped.length, errors: errors.length }),
    },
  });

  return NextResponse.json({ promoted: promoted.length, skipped: skipped.length, errors, questionIds: promoted, skippedItems: skipped });
}
