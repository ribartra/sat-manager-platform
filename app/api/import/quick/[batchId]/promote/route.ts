import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import prisma from "@/lib/prisma";
import { assertContentImporter } from "@/lib/rbac";
import { contentProgramFor } from "@/lib/program-scope";
import { ConflictError, ValidationError, withApiErrors } from "@/lib/api-error";
import { writeAudit } from "@/lib/audit";
import { loadQuickBatch } from "@/lib/quick-import.server";
import { testModuleIndex } from "@/lib/quick-import";
import { promoteCandidates } from "@/lib/ingest-promote-candidates";
import { promotionSourceId } from "@/lib/content-source";
import { FULL_TEST_MODULES, difficultyFromFullTestModuleKey, fullTestTopicIdFor, moduleKeyFromOrder } from "@/lib/full-test-modules";
import { CONTENT_JOB, exclusiveJob } from "@/lib/job-lock";

type Ctx = { params: Promise<{ batchId: string }> };

const ARTIFACT_KEY = (batchId: string) => `quick:${batchId}`;

// POST /api/import/quick/[batchId]/promote — { allowPartial? }: step 3 done → the reviewed questions
// become official (Draft) questions in ONE new Practice Set or Test, under the import's source.
// Questions still "needs review" stay out unless allowPartial (then the Draft is partial).
// A Test is loaded one module at a time: once its Draft exists, calling this again ADDS the questions
// loaded and reviewed since (a later module) to their module of that same Draft, while it is a Draft.
export const POST = withApiErrors(exclusiveJob(CONTENT_JOB, async function POST(req: NextRequest, { params }: Ctx) {
  const session = await assertContentImporter();
  const { batchId } = await params;
  const { batch, target, questionFile } = await loadQuickBatch(batchId, session.user);
  const body = (await req.json().catch(() => ({}))) as { allowPartial?: unknown };

  const existing = await prisma.ingestPromotionArtifact.findFirst({ where: { batchId, groupKey: ARTIFACT_KEY(batchId) } });
  const existingHref = existing ? (existing.artifactType === "PRACTICE_SET" ? `/teacher/practice-sets/${existing.artifactId}?edit` : `/teacher/tests/${existing.artifactId}?edit`) : null;
  if (existing && existing.artifactType === "PRACTICE_SET") return NextResponse.json({ href: existingHref, existing: true });

  const candidates = await prisma.ingestQuestionCandidate.findMany({ where: { batchId, status: { not: "REJECTED" } } });
  if (candidates.length === 0) throw new ValidationError("Validation failed.", ["Load the CSV first."]);
  const pending = candidates.filter((c) => !["READY", "REVIEWED"].includes(c.status) && c.promotionStatus !== "PROMOTED");
  const fresh = candidates.filter((c) => c.promotionStatus !== "PROMOTED");

  // The Test's Draft already exists: add what was loaded since (nothing new → just open it).
  let draftTest: { id: string; status: string; modules: Array<{ id: string; order: number; questions: Array<{ questionId: string; order: number }> }> } | null = null;
  if (existing) {
    if (fresh.length === 0) return NextResponse.json({ href: existingHref, existing: true });
    draftTest = await prisma.fullPracticeTest.findUnique({
      where: { id: existing.artifactId },
      select: { id: true, status: true, modules: { select: { id: true, order: true, questions: { select: { questionId: true, order: true } } } } },
    });
    if (!draftTest) throw new ConflictError("The Test created by this import no longer exists. Start a new import.");
    if (draftTest.status !== "DRAFT") throw new ConflictError("The Test is no longer a Draft: add or change its questions in the Test editor.");
  }
  if (pending.length > 0 && body.allowPartial !== true) {
    throw new ConflictError(`${pending.length} question(s) still need review. Fix them in Review (and mark them reviewed), or leave them out for now.`, {
      code: "NEEDS_REVIEW",
      extra: { pending: pending.map((c) => c.questionNumber) },
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
      // Always a NEW set: "<domain> - <skill> - <LEVEL>" (the usual name), "… - #n" when that level
      // already has sets.
      const siblings = await tx.practiceSet.count({ where: { topicId: target.topicId, difficulty: target.difficulty, programId } });
      const set = await tx.practiceSet.create({
        data: {
          programId,
          sourceId,
          name: siblings ? `${target.domainName} - ${target.topicName} - ${target.difficulty} - #${siblings + 1}` : `${target.domainName} - ${target.topicName} - ${target.difficulty}`,
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
    const inDraft = new Set(draftTest?.modules.flatMap((m) => m.questions.map((q) => q.questionId)) ?? []);
    for (const candidate of promoted) {
      if (!inDraft.has(candidate.officialQuestionId!)) byModule[testModuleIndex(candidate)].push(candidate.officialQuestionId!);
    }
    // Same standard as the AI Import Tests: M1 / M2 skill and Easy / Hard per module.
    for (let order = 0; order < 4; order++) {
      if (!byModule[order].length) continue;
      const moduleKey = moduleKeyFromOrder(order);
      await tx.question.updateMany({
        where: { id: { in: byModule[order] } },
        data: { topicId: fullTestTopicIdFor(order >= 2 ? "MATH" : "RW", moduleKey), difficulty: difficultyFromFullTestModuleKey(moduleKey) },
      });
    }
    if (draftTest) {
      // Append each module's new questions after the ones already there (pretest = first 2 of a module).
      for (let order = 0; order < 4; order++) {
        if (!byModule[order].length) continue;
        const testModule = draftTest.modules.find((m) => m.order === order);
        if (!testModule) throw new ConflictError("The Draft Test is missing a module: fix it in the Test editor.");
        const start = testModule.questions.reduce((max, q) => Math.max(max, q.order + 1), 0);
        await tx.fullPracticeTestQuestion.createMany({
          data: byModule[order].map((questionId, i) => ({ moduleId: testModule.id, questionId, order: start + i, isPretest: start + i < 2 })),
        });
      }
      // Touch the Test so an editor opened before this sees "someone else changed this".
      await tx.fullPracticeTest.update({ where: { id: draftTest.id }, data: { updatedAt: new Date() } });
      return { type: "FULL_PRACTICE_TEST" as const, id: draftTest.id, added: byModule.reduce((sum, ids) => sum + ids.length, 0) };
    }
    const test = await tx.fullPracticeTest.create({
      data: {
        programId,
        sourceId,
        name: target.testName,
        number: target.testNumber ?? null,
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

  if (!existing) await prisma.ingestPromotionArtifact.create({
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
    action: existing ? "QUICK_IMPORT_ADDED_TO_DRAFT" : "QUICK_IMPORT_PROMOTED",
    targetType: created.type === "PRACTICE_SET" ? "PracticeSet" : "FullPracticeTest",
    targetId: created.id,
    metadata: { batchId: batch.id, questions: questionIds.length, pendingLeftOut: pending.length, sourceId, errors: result.errors.length },
  });
  return NextResponse.json({
    href: created.type === "PRACTICE_SET" ? `/teacher/practice-sets/${created.id}?edit` : `/teacher/tests/${created.id}?edit`,
    questions: "added" in created ? created.added : questionIds.length,
    added: "added" in created,
    leftOut: pending.length + result.errors.length + result.skipped.length,
  });
}));
