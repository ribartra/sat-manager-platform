import { randomUUID } from "crypto";
import prisma from "@/lib/prisma";
import { buildQuestionDraft, materializeOfficialImageUrl, reconcileOfficialUpdate } from "@/lib/ingest-promotion";
import { validateQuestionPayload } from "@/lib/content-validation";
import { regradeQuestions } from "@/lib/attempt-regrade";

/**
 * Promote staging candidates to official questions (AI Import "promote" and "Import with AI").
 * First promotion needs READY/REVIEWED + a stem (text or STEM image) + an answer; with `resync`,
 * already-promoted candidates are reconciled into their question without degrading it.
 */
export async function promoteCandidates({
  batchId,
  candidateIds,
  resync,
  programId,
  userId,
}: {
  batchId: string;
  candidateIds: string[];
  resync: boolean;
  programId: string | null;
  userId: string;
}) {
  const [candidates, topics, rawLinks] = await Promise.all([
    prisma.ingestQuestionCandidate.findMany({
      where: { id: { in: candidateIds }, batchId },
      orderBy: [{ sourceFileId: "asc" }, { questionNumber: "asc" }, { createdAt: "asc" }],
    }),
    prisma.topic.findMany({ include: { domain: { include: { section: true, aliases: { select: { alias: true } } } }, subskills: true, aliases: { select: { alias: true } } }, orderBy: { name: "asc" } }),
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
  const resynced: { candidateId: string; questionId: string; changed: string[] }[] = [];
  const skipped: { candidateId: string; reason: string }[] = [];
  const errors: { candidateId: string; reason: string }[] = [];

  for (const candidate of candidates) {
    const alreadyPromoted = candidate.promotionStatus === "PROMOTED" && candidate.officialQuestionId;
    if (alreadyPromoted && !resync) {
      skipped.push({ candidateId: candidate.id, reason: "Already promoted." });
      continue;
    }
    // First-time promotion still requires READY/REVIEWED; a re-sync applies to an
    // already-promoted candidate whatever its current review status.
    if (!alreadyPromoted && !["READY", "REVIEWED"].includes(candidate.status)) {
      skipped.push({ candidateId: candidate.id, reason: "Candidate must be READY or REVIEWED." });
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
    const hasStemImage = imageLinks.some((link) => link.targetType === "STEM");
    if ((!candidate.stem?.trim() && !hasStemImage) || !candidate.correctAnswer) {
      skipped.push({
        candidateId: candidate.id,
        reason: "Candidate needs stem (text or image) and answer.",
      });
      continue;
    }

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

    // Re-sync path: the candidate is already promoted; reconcile its draft into
    // the existing official question without degrading any field.
    if (alreadyPromoted) {
      const official = await prisma.question.findUnique({
        where: { id: candidate.officialQuestionId! },
        include: { options: { select: { label: true, text: true, imageUrl: true } } },
      });
      if (!official) {
        skipped.push({ candidateId: candidate.id, reason: "Official question missing; cannot re-sync." });
        continue;
      }
      const draftForReconcile = {
        ...draft,
        imageUrl: officialImageUrl ?? "",
        options: officialOptions.length ? officialOptions : draft.options,
      };
      const result = reconcileOfficialUpdate(draftForReconcile, {
        stem: official.stem,
        stimulus: official.stimulus,
        explanation: official.explanation,
        correctAnswer: official.correctAnswer,
        imageUrl: official.imageUrl,
        options: official.options,
      });
      if (result.changed.length === 0) {
        skipped.push({ candidateId: candidate.id, reason: "Already in sync." });
        continue;
      }
      await prisma.$transaction(async (tx) => {
        if (Object.keys(result.questionData).length > 0) {
          await tx.question.update({ where: { id: official.id }, data: result.questionData });
        }
        if (result.replaceOptions) {
          await tx.questionOption.deleteMany({ where: { questionId: official.id } });
          await tx.questionOption.createMany({
            data: result.replaceOptions.map((option) => ({
              id: `opt_${randomUUID().replace(/-/g, "")}`,
              questionId: official.id,
              label: option.label,
              text: option.text,
              imageUrl: option.imageUrl,
            })),
          });
        }
      });
      // Attempts store only answers: a re-synced key or options re-grade the submitted ones.
      if (result.questionData.correctAnswer !== undefined || result.questionData.type !== undefined || result.replaceOptions) {
        await regradeQuestions([official.id], { userId, reason: "ai import re-sync" });
      }
      resynced.push({ candidateId: candidate.id, questionId: official.id, changed: result.changed });
      continue;
    }

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
          programId,
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
          promotedById: userId,
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
          createdById: userId,
        },
        update: { artifactId: created.id, createdById: userId },
      });
      return created;
    });
    promoted.push(question.id);
  }

  const missing = candidateIds.filter((id) => !candidates.some((candidate) => candidate.id === id));
  for (const candidateId of missing) skipped.push({ candidateId, reason: "Candidate not found in batch." });


  return { promoted, resynced, skipped, errors };
}
