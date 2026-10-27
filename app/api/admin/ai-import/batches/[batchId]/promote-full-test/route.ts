import { NextResponse } from "next/server";
import { contentProgramFor } from "@/lib/program-scope";
import { randomUUID } from "crypto";
import { requireTeacherOrAdmin } from "@/lib/rbac";
import prisma from "@/lib/prisma";
import {
  FULL_TEST_EXPECTED_COUNTS,
  FULL_TEST_MODULES,
  difficultyFromFullTestModuleKey,
  fullTestModuleBuckets,
  fullTestTopicIdFor,
  moduleIndexForCandidate,
  moduleKeyFromOrder,
  type FullTestSection,
} from "@/lib/full-test-modules";
import { ApiError, BadRequestError, ForbiddenError, NotFoundError, withApiErrors } from "@/lib/api-error";

interface RouteContext {
  params: Promise<{ batchId: string }>;
}

const EXPECTED_MODULE_COUNTS = FULL_TEST_EXPECTED_COUNTS;

export const POST = withApiErrors(async function POST(req: Request, { params }: RouteContext) {
  const session = await requireTeacherOrAdmin();
  if (!session) return new ForbiddenError("Forbidden").toResponse();

  const { batchId } = await params;
  const body = (await req.json().catch(() => ({}))) as { testNumber?: number; allowPartial?: boolean };
  const batch = await prisma.ingestBatch.findUnique({ where: { id: batchId } });
  if (!batch) return new NotFoundError("Batch not found.").toResponse();
  if (!Number.isInteger(body.testNumber)) {
    return new BadRequestError("testNumber is required.").toResponse();
  }

  const candidates = await prisma.ingestQuestionCandidate.findMany({
    where: {
      batchId,
      contentType: "FULL_PRACTICE_TEST",
      testNumber: body.testNumber,
      promotionStatus: "PROMOTED",
      officialQuestionId: { not: null },
    },
    orderBy: [{ testNumber: "asc" }, { moduleLabel: "asc" }, { questionNumber: "asc" }, { createdAt: "asc" }],
  });
  if (candidates.length === 0) {
    return new BadRequestError("No promoted Test questions found for this test.").toResponse();
  }

  const questionIds = candidates.map((candidate) => candidate.officialQuestionId).filter((id): id is string => Boolean(id));
  if (new Set(questionIds).size !== questionIds.length) {
    return new BadRequestError("Duplicated promoted questions found in this batch.").toResponse();
  }
  const questions = await prisma.question.findMany({
    where: { id: { in: questionIds } },
    include: { topic: { include: { domain: { include: { section: true } } } } },
  });
  if (questions.length !== questionIds.length) {
    return new BadRequestError("Some promoted questions no longer exist.").toResponse();
  }
  // The Test lives in its questions' program bank (all from one program).
  const questionPrograms = new Set(questions.map((question) => question.programId));
  if (questionPrograms.size !== 1) return new BadRequestError("All questions must come from this program's question bank.").toResponse();
  const programId = [...questionPrograms][0] ?? (await contentProgramFor(session.user));
  await contentProgramFor(session.user, programId);
  const sectionByQuestion = new Map(
    questions.map((question) => [question.id, question.topic.domain.section.name === "MATH" ? "MATH" : "RW"]),
  );

  const moduleQuestionIds: string[][] = [[], [], [], []];
  for (const candidate of candidates) {
    const questionId = candidate.officialQuestionId;
    if (!questionId) continue;
    const index = moduleIndexForCandidate(candidate);
    const expectedSection = index >= 2 ? "MATH" : "RW";
    const actualSection = sectionByQuestion.get(questionId);
    if (actualSection !== expectedSection) {
      return new BadRequestError(`Question ${questionId} belongs to ${actualSection}, but target module requires ${expectedSection}.`).toResponse();
    }
    moduleQuestionIds[index].push(questionId);
  }

  const moduleCounts = moduleQuestionIds.map((ids) => ids.length);
  const missingByModule = moduleCounts.map((count, index) => Math.max(EXPECTED_MODULE_COUNTS[index] - count, 0));
  const partial = missingByModule.some((missing) => missing > 0);
  const modules = fullTestModuleBuckets(moduleCounts);
  if (partial && !body.allowPartial) {
    return ApiError.fromStatus(409, "This Test is partial. Confirm allowPartial to create/update a draft with promoted questions only.", { moduleCounts, missingByModule, modules, partial }).toResponse();
  }

  const testNumber = body.testNumber;
  const groupKey = `full-test:${testNumber}`;
  const existingArtifact = await prisma.ingestPromotionArtifact.findUnique({
    where: { batchId_artifactType_groupKey: { batchId, artifactType: "FULL_PRACTICE_TEST", groupKey } },
  });
  // Canonical display name for standardized SAT exams (no "Imported" / partial suffix).
  const testName = `TEST ${testNumber}`;

  const test = await prisma.$transaction(async (tx) => {
    // Stamp M1/M2 skill + EASY/HARD before wiring so the draft exam is standardized.
    for (let order = 0; order < 4; order++) {
      const moduleKey = moduleKeyFromOrder(order);
      const section: FullTestSection = order >= 2 ? "MATH" : "RW";
      const topicId = fullTestTopicIdFor(section, moduleKey);
      const difficulty = difficultyFromFullTestModuleKey(moduleKey);
      const ids = moduleQuestionIds[order] ?? [];
      if (ids.length === 0) continue;
      await tx.question.updateMany({
        where: { id: { in: ids } },
        data: { topicId, difficulty },
      });
    }

    if (existingArtifact) {
      const existingModules = await tx.fullPracticeTestModule.findMany({ where: { testId: existingArtifact.artifactId } });
      for (const testModule of existingModules) {
        await tx.fullPracticeTestQuestion.deleteMany({ where: { moduleId: testModule.id } });
      }
      await tx.fullPracticeTest.update({
        where: { id: existingArtifact.artifactId },
        data: { name: testName, status: "DRAFT" },
      });
      for (const testModule of existingModules) {
        const ids = moduleQuestionIds[testModule.order] ?? [];
        for (const [order, questionId] of ids.entries()) {
          await tx.fullPracticeTestQuestion.create({
            data: { moduleId: testModule.id, questionId, order, isPretest: order < 2 },
          });
        }
      }
      return tx.fullPracticeTest.findUniqueOrThrow({ where: { id: existingArtifact.artifactId } });
    }

    const created = await tx.fullPracticeTest.create({
      data: {
        programId,
        name: testName,
        status: "DRAFT",
        modules: {
          create: FULL_TEST_MODULES.map((module, order) => ({
            name: module.name,
            section: module.section,
            timeLimit: module.timeLimit,
            order,
            questions: {
              create: moduleQuestionIds[order].map((questionId, qOrder) => ({
                questionId,
                order: qOrder,
                isPretest: qOrder < 2,
              })),
            },
          })),
        },
      },
    });
    await tx.ingestPromotionArtifact.create({
      data: {
        id: `promo_${randomUUID().replace(/-/g, "")}`,
        batchId,
        sourceFileId: null,
        artifactType: "FULL_PRACTICE_TEST",
        artifactId: created.id,
        groupKey,
        createdById: session.user.id,
      },
    });
    return created;
  });

  // Align staging difficulty / topicName with the standardized modules (best-effort).
  for (const candidate of candidates) {
    if (!candidate.officialQuestionId) continue;
    const index = moduleIndexForCandidate(candidate);
    const moduleKey = moduleKeyFromOrder(index);
    const difficulty = difficultyFromFullTestModuleKey(moduleKey);
    await prisma.ingestQuestionCandidate.update({
      where: { id: candidate.id },
      data: {
        difficulty,
        topicName: moduleKey,
        updatedAt: new Date(),
      },
    });
  }

  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: "PROMOTE_AI_IMPORT_FULL_TEST",
      targetType: "FullPracticeTest",
      targetId: test.id,
      metadata: JSON.stringify({ batchId, testNumber, questionCount: questionIds.length, moduleCounts, missingByModule, modules, partial }),
    },
  });

  return NextResponse.json({ test, moduleCounts, missingByModule, modules, partial });
});
