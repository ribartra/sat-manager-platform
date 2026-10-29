import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import prisma from "@/lib/prisma";
import { assertContentImporter } from "@/lib/rbac";
import { contentProgramFor } from "@/lib/program-scope";
import { ApiError, ValidationError, withApiErrors } from "@/lib/api-error";
import { writeAudit } from "@/lib/audit";
import { loadQuickBatch } from "@/lib/quick-import.server";
import { testModuleIndex } from "@/lib/quick-import";
import { promoteCandidates } from "@/lib/ingest-promote-candidates";
import { promotionSourceId } from "@/lib/content-source";
import { FULL_TEST_MODULES, difficultyFromFullTestModuleKey, fullTestTopicIdFor, moduleKeyFromOrder } from "@/lib/full-test-modules";

type Ctx = { params: Promise<{ batchId: string }> };

const ARTIFACT_KEY = (batchId: string) => `quick:${batchId}`;

// POST /api/import/quick/[batchId]/promote — { allowPartial? }: step 3 done → the reviewed questions
// become official (Draft) questions in ONE new Practice Set or Test, under the import's source.
// Questions still "needs review" stay out unless allowPartial (then the Draft is partial).
export const POST = withApiErrors(async function POST(req: NextRequest, { params }: Ctx) {
  const session = await assertContentImporter();
  const { batchId } = await params;
  const { batch, target, questionFile } = await loadQuickBatch(batchId, session.user);
  const body = (await req.json().catch(() => ({}))) as { allowPartial?: unknown };

  const existing = await prisma.ingestPromotionArtifact.findFirst({ where: { batchId, groupKey: ARTIFACT_KEY(batchId) } });
  if (existing) {
    return NextResponse.json({ href: existing.artifactType === "PRACTICE_SET" ? `/teacher/practice-sets/${existing.artifactId}/edit` : `/teacher/tests/${existing.artifactId}/edit`, existing: true });
  }

  const candidates = await prisma.ingestQuestionCandidate.findMany({ where: { batchId, status: { not: "REJECTED" } } });
  if (candidates.length === 0) throw new ValidationError("Validation failed.", ["Load the CSV first."]);
  const pending = candidates.filter((c) => !["READY", "REVIEWED"].includes(c.status) && c.promotionStatus !== "PROMOTED");
  if (pending.length > 0 && body.allowPartial !== true) {
    throw ApiError.fromStatus(409, `${pending.length} question(s) still need review. Fix them in Review (and mark them reviewed), or create a partial Draft without them.`, {
      pending: pending.map((c) => c.questionNumber),
    });
  }

  const programId = await contentProgramFor(session.user);
  const toPromote = candidates.filter((c) => c.promotionStatus !== "PROMOTED" && ["READY", "REVIEWED"].includes(c.status)).map((c) => c.id);
  const result = toPromote.length ? await promoteCandidates({ batchId, candidateIds: toPromote, resync: false, programId, userId: session.user.id }) : { promoted: [], resynced: [], skipped: [], errors: [] };

  const promoted = (await prisma.ingestQuestionCandidate.findMany({ where: { batchId, promotionStatus: "PROMOTED", officialQuestionId: { not: null } } })).sort(
    (a, b) => testModuleIndex(a) - testModuleIndex(b) || (a.questionNumber ?? 0) - (b.questionNumber ?? 0),
  );
  if (promoted.length === 0) {
    throw new ValidationError("Validation failed.", ["No question could be created.", ...result.errors.map((e) => e.reason), ...result.skipped.map((s) => s.reason)].slice(0, 10));
  }
  const questionIds = promoted.map((c) => c.officialQuestionId!);
  const sourceId = await promotionSourceId(batchId, target.kind === "PRACTICE_SET" ? "practice" : "tests");

  const created = await prisma.$transaction(async (tx) => {
    if (target.kind === "PRACTICE_SET") {
      // The import's skill and level win over what each row resolved to.
      await tx.question.updateMany({ where: { id: { in: questionIds } }, data: { topicId: target.topicId, difficulty: target.difficulty } });
      // Always a NEW set: "<domain> - <skill> - <LEVEL> - #n" with the next free number.
      const siblings = await tx.practiceSet.count({ where: { topicId: target.topicId, difficulty: target.difficulty, programId } });
      const set = await tx.practiceSet.create({
        data: {
          programId,
          sourceId,
          name: `${target.domainName} - ${target.topicName} - ${target.difficulty} - #${siblings + 1}`,
          topicId: target.topicId,
          difficulty: target.difficulty,
          status: "DRAFT",
          explanationVisibility: "AFTER_FINISH",
          questions: { create: questionIds.map((questionId, order) => ({ questionId, order })) },
        },
      });
      return { type: "PRACTICE_SET" as const, id: set.id };
    }
    const byModule: string[][] = [[], [], [], []];
    for (const candidate of promoted) byModule[testModuleIndex(candidate)].push(candidate.officialQuestionId!);
    // Same standard as the AI Import Tests: M1 / M2 skill and Easy / Hard per module.
    for (let order = 0; order < 4; order++) {
      if (!byModule[order].length) continue;
      const moduleKey = moduleKeyFromOrder(order);
      await tx.question.updateMany({
        where: { id: { in: byModule[order] } },
        data: { topicId: fullTestTopicIdFor(order >= 2 ? "MATH" : "RW", moduleKey), difficulty: difficultyFromFullTestModuleKey(moduleKey) },
      });
    }
    const test = await tx.fullPracticeTest.create({
      data: {
        programId,
        sourceId,
        name: target.testName,
        status: "DRAFT",
        modules: {
          create: FULL_TEST_MODULES.map((module, order) => ({
            name: module.name,
            section: module.section,
            timeLimit: module.timeLimit,
            order,
            // Same pretest marking as the AI Import Tests (promote-full-test).
            questions: { create: byModule[order].map((questionId, qOrder) => ({ questionId, order: qOrder, isPretest: qOrder < 2 })) },
          })),
        },
      },
    });
    return { type: "FULL_PRACTICE_TEST" as const, id: test.id };
  });

  await prisma.ingestPromotionArtifact.create({
    data: {
      id: `promo_${randomUUID().replace(/-/g, "")}`,
      batchId,
      sourceFileId: questionFile?.id ?? null,
      artifactType: created.type,
      artifactId: created.id,
      groupKey: ARTIFACT_KEY(batchId),
      createdById: session.user.id,
    },
  });
  await writeAudit({
    userId: session.user.id,
    action: "QUICK_IMPORT_PROMOTED",
    targetType: created.type === "PRACTICE_SET" ? "PracticeSet" : "FullPracticeTest",
    targetId: created.id,
    metadata: { batchId: batch.id, questions: questionIds.length, pendingLeftOut: pending.length, sourceId, errors: result.errors.length },
  });
  return NextResponse.json({
    href: created.type === "PRACTICE_SET" ? `/teacher/practice-sets/${created.id}/edit` : `/teacher/tests/${created.id}/edit`,
    questions: questionIds.length,
    leftOut: pending.length + result.errors.length + result.skipped.length,
  });
});
