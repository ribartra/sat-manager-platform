import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { requireTeacherOrAdmin } from "@/lib/rbac";
import prisma from "@/lib/prisma";

interface RouteContext {
  params: Promise<{ candidateId: string }>;
}

// `candidateId` is the TARGET candidate that survives the merge; `sourceId`
// (in the body) is the duplicate/fragment that is folded into it and retired.
// The client resolves every field + the final image-link set via a side-by-side
// comparator and posts the consolidated result here.

const allowedTargets = new Set(["STEM", "STIMULUS", "OPTION", "OPTION_BLOCK", "ANSWER_FIELD", "EXPLANATION", "PAGE_CONTEXT"]);

type ResolvedFields = {
  stem?: string | null;
  stimulus?: string | null;
  optionsJson?: string | null;
  correctAnswer?: string | null;
  explanation?: string | null;
  difficulty?: string | null;
  topicName?: string | null;
  section?: string | null;
  subskillName?: string | null;
  type?: string;
};

type ImageLinkInput = {
  imageArtifactId: string;
  targetType: string;
  optionLabel?: string | null;
  sortOrder?: number;
};

export async function POST(req: NextRequest, { params }: RouteContext) {
  const session = await requireTeacherOrAdmin();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { candidateId: targetId } = await params;
  const body = (await req.json().catch(() => ({}))) as {
    sourceId?: string;
    resolved?: ResolvedFields;
    imageLinks?: ImageLinkInput[];
    sourceOutcome?: "REJECT" | "DELETE";
    cleanupSourcePromotion?: boolean;
  };

  const sourceId = body.sourceId;
  if (!sourceId) return NextResponse.json({ error: "sourceId is required." }, { status: 400 });
  if (sourceId === targetId) return NextResponse.json({ error: "Source and target must differ." }, { status: 400 });

  const [target, source] = await Promise.all([
    prisma.ingestQuestionCandidate.findUnique({ where: { id: targetId } }),
    prisma.ingestQuestionCandidate.findUnique({ where: { id: sourceId } }),
  ]);
  if (!target) return NextResponse.json({ error: "Target candidate not found." }, { status: 404 });
  if (!source) return NextResponse.json({ error: "Source candidate not found." }, { status: 404 });
  if (target.batchId !== source.batchId || target.sourceFileId !== source.sourceFileId) {
    return NextResponse.json({ error: "Candidates must belong to the same file to merge." }, { status: 400 });
  }

  const resolved = body.resolved ?? {};
  const imageLinks = (body.imageLinks ?? []).filter((link) => link?.imageArtifactId && allowedTargets.has(link.targetType));
  const sourceOutcome = body.sourceOutcome === "DELETE" ? "DELETE" : "REJECT";
  const cleanupPromotion = body.cleanupSourcePromotion ?? source.promotionStatus === "PROMOTED";

  // Only accept image artifacts that actually belong to this batch.
  const artifactIds = Array.from(new Set(imageLinks.map((link) => link.imageArtifactId)));
  const validArtifacts = artifactIds.length
    ? await prisma.ingestImageArtifact.findMany({
        where: { id: { in: artifactIds }, batchId: target.batchId },
        select: { id: true },
      })
    : [];
  const validArtifactIds = new Set(validArtifacts.map((a) => a.id));
  const finalLinks = imageLinks.filter((link) => validArtifactIds.has(link.imageArtifactId));

  const warnings: string[] = [];
  let cleanedOfficialQuestionId: string | null = null;

  // Decide the source's promoted official question cleanup up-front (read-only guards).
  if (cleanupPromotion && source.officialQuestionId) {
    const officialId = source.officialQuestionId;
    const [official, attemptRefs, fullTestRefs] = await Promise.all([
      prisma.question.findUnique({ where: { id: officialId }, select: { id: true, status: true } }),
      prisma.attemptAnswer.count({ where: { questionId: officialId } }),
      prisma.fullPracticeTestAnswer.count({ where: { questionId: officialId } }),
    ]);
    if (!official) {
      warnings.push("La pregunta oficial del source ya no existe; se omitió la limpieza.");
    } else if (official.status !== "DRAFT") {
      warnings.push(`La pregunta oficial del source no es DRAFT (${official.status}); no se eliminó.`);
    } else if (attemptRefs > 0 || fullTestRefs > 0) {
      warnings.push("La pregunta oficial del source tiene intentos asociados; no se eliminó.");
    } else {
      cleanedOfficialQuestionId = officialId;
    }
  }

  await prisma.$transaction(async (tx) => {
    // 1. Apply resolved fields to the target (same allow-list as PATCH).
    const targetWasPromoted = target.promotionStatus === "PROMOTED";
    await tx.ingestQuestionCandidate.update({
      where: { id: targetId },
      data: {
        ...(resolved.stem !== undefined ? { stem: resolved.stem || null } : {}),
        ...(resolved.stimulus !== undefined ? { stimulus: resolved.stimulus || null } : {}),
        ...(resolved.optionsJson !== undefined ? { optionsJson: resolved.optionsJson || null } : {}),
        ...(resolved.correctAnswer !== undefined ? { correctAnswer: resolved.correctAnswer || null } : {}),
        ...(resolved.explanation !== undefined ? { explanation: resolved.explanation || null } : {}),
        ...(resolved.difficulty !== undefined ? { difficulty: resolved.difficulty || null } : {}),
        ...(resolved.topicName !== undefined ? { topicName: resolved.topicName || null } : {}),
        ...(resolved.section !== undefined ? { section: resolved.section || null } : {}),
        ...(resolved.subskillName !== undefined ? { subskillName: resolved.subskillName || null } : {}),
        ...(resolved.type ? { type: resolved.type } : {}),
        // Content changed on an already-promoted candidate → needs re-promotion.
        ...(targetWasPromoted ? { promotionStatus: "EDITING" } : {}),
      },
    });

    // 2. Reconcile image links: drop target+source links, recreate the final set on the target.
    await tx.ingestCandidateImageLink.deleteMany({ where: { candidateId: { in: [targetId, sourceId] } } });
    for (const [index, link] of finalLinks.entries()) {
      await tx.ingestCandidateImageLink.create({
        data: {
          id: `imglink_${randomUUID().replace(/-/g, "")}`,
          batchId: target.batchId,
          candidateId: targetId,
          imageArtifactId: link.imageArtifactId,
          targetType: link.targetType,
          optionLabel: link.targetType === "OPTION" ? link.optionLabel ?? null : null,
          sortOrder: link.sortOrder ?? index,
        },
      });
    }

    // 3. Clean up the source's promoted official question when guards passed.
    if (cleanedOfficialQuestionId) {
      await tx.practiceSetQuestion.deleteMany({ where: { questionId: cleanedOfficialQuestionId } });
      await tx.fullPracticeTestQuestion.deleteMany({ where: { questionId: cleanedOfficialQuestionId } });
      await tx.ingestPromotionArtifact.deleteMany({
        where: { batchId: source.batchId, artifactType: "QUESTION", artifactId: cleanedOfficialQuestionId },
      });
      await tx.question.delete({ where: { id: cleanedOfficialQuestionId } });
    }

    // 4. Retire the source candidate.
    if (sourceOutcome === "DELETE") {
      await tx.ingestQuestionCandidate.delete({ where: { id: sourceId } });
    } else {
      await tx.ingestQuestionCandidate.update({
        where: { id: sourceId },
        data: { status: "REJECTED", promotionStatus: "REJECTED", questionNumber: null, officialQuestionId: null },
      });
    }

    // 5. Audit.
    await tx.auditLog.create({
      data: {
        userId: session.user.id,
        action: "MERGE_AI_IMPORT_CANDIDATE",
        targetType: "IngestQuestionCandidate",
        targetId,
        metadata: JSON.stringify({
          sourceId,
          resolvedKeys: Object.keys(resolved),
          imageLinkCount: finalLinks.length,
          sourceOutcome,
          cleanedOfficialQuestionId,
        }),
      },
    });
  });

  const updatedTarget = await prisma.ingestQuestionCandidate.findUnique({ where: { id: targetId } });
  return NextResponse.json({ ok: true, target: updatedTarget, warnings, cleanedOfficialQuestionId });
}
