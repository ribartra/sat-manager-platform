import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { requireTeacherOrAdmin } from "@/lib/rbac";
import prisma from "@/lib/prisma";

interface RouteContext {
  params: Promise<{ batchId: string }>;
}

const MODULES = [
  { name: "Reading & Writing Module 1", section: "RW", timeLimit: 32 * 60 },
  { name: "Reading & Writing Module 2", section: "RW", timeLimit: 32 * 60 },
  { name: "Math Module 1", section: "MATH", timeLimit: 35 * 60 },
  { name: "Math Module 2", section: "MATH", timeLimit: 35 * 60 },
];

function moduleIndexForCandidate(candidate: { section: string | null; moduleLabel: string | null }) {
  const section = (candidate.section ?? "").toUpperCase().includes("RW") ? "RW" : (candidate.section ?? "").toUpperCase().includes("READ") ? "RW" : "MATH";
  const label = (candidate.moduleLabel ?? "").toUpperCase();
  const secondModule = /\b2\b|MOD\s*2|MODULE\s*2|2B/.test(label);
  if (section === "RW") return secondModule ? 1 : 0;
  return secondModule ? 3 : 2;
}

const EXPECTED_MODULE_COUNTS = [27, 27, 22, 22];

export async function POST(req: Request, { params }: RouteContext) {
  const session = await requireTeacherOrAdmin();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { batchId } = await params;
  const body = (await req.json().catch(() => ({}))) as { testNumber?: number; allowPartial?: boolean };
  const batch = await prisma.ingestBatch.findUnique({ where: { id: batchId } });
  if (!batch) return NextResponse.json({ error: "Batch not found." }, { status: 404 });
  if (!Number.isInteger(body.testNumber)) {
    return NextResponse.json({ error: "testNumber is required." }, { status: 400 });
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
  if (candidates.length === 0) return NextResponse.json({ error: "No promoted Full Practice Test questions found for this test." }, { status: 400 });

  const questionIds = candidates.map((candidate) => candidate.officialQuestionId).filter((id): id is string => Boolean(id));
  if (new Set(questionIds).size !== questionIds.length) {
    return NextResponse.json({ error: "Duplicated promoted questions found in this batch." }, { status: 400 });
  }
  const questions = await prisma.question.findMany({
    where: { id: { in: questionIds } },
    include: { topic: { include: { domain: { include: { section: true } } } } },
  });
  if (questions.length !== questionIds.length) return NextResponse.json({ error: "Some promoted questions no longer exist." }, { status: 400 });
  const sectionByQuestion = new Map(questions.map((question) => [question.id, question.topic.domain.section.name === "MATH" ? "MATH" : "RW"]));

  const moduleQuestionIds: string[][] = [[], [], [], []];
  for (const candidate of candidates) {
    const questionId = candidate.officialQuestionId;
    if (!questionId) continue;
    const index = moduleIndexForCandidate(candidate);
    const expectedSection = index >= 2 ? "MATH" : "RW";
    const actualSection = sectionByQuestion.get(questionId);
    if (actualSection !== expectedSection) {
      return NextResponse.json({ error: `Question ${questionId} belongs to ${actualSection}, but target module requires ${expectedSection}.` }, { status: 400 });
    }
    moduleQuestionIds[index].push(questionId);
  }

  const moduleCounts = moduleQuestionIds.map((ids) => ids.length);
  const missingByModule = moduleCounts.map((count, index) => Math.max(EXPECTED_MODULE_COUNTS[index] - count, 0));
  const partial = missingByModule.some((missing) => missing > 0);
  if (partial && !body.allowPartial) {
    return NextResponse.json({
      error: "This Full Practice Test is partial. Confirm allowPartial to create/update a draft with promoted questions only.",
      moduleCounts,
      missingByModule,
      partial,
    }, { status: 409 });
  }

  const testNumber = body.testNumber;
  const groupKey = `full-test:${testNumber}`;
  const existingArtifact = await prisma.ingestPromotionArtifact.findUnique({
    where: { batchId_artifactType_groupKey: { batchId, artifactType: "FULL_PRACTICE_TEST", groupKey } },
  });
  const testName = `Imported Test ${testNumber}${partial ? ` (partial ${moduleCounts.reduce((sum, count) => sum + count, 0)}/${EXPECTED_MODULE_COUNTS.reduce((sum, count) => sum + count, 0)})` : ""}`;

  const test = await prisma.$transaction(async (tx) => {
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
          await tx.fullPracticeTestQuestion.create({ data: { moduleId: testModule.id, questionId, order } });
        }
      }
      return tx.fullPracticeTest.findUniqueOrThrow({ where: { id: existingArtifact.artifactId } });
    }

    const created = await tx.fullPracticeTest.create({
      data: {
        name: testName,
        status: "DRAFT",
        modules: {
          create: MODULES.map((module, order) => ({
            ...module,
            order,
            questions: { create: moduleQuestionIds[order].map((questionId, qOrder) => ({ questionId, order: qOrder })) },
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

  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: "PROMOTE_AI_IMPORT_FULL_TEST",
      targetType: "FullPracticeTest",
      targetId: test.id,
      metadata: JSON.stringify({ batchId, testNumber, questionCount: questionIds.length, moduleCounts, missingByModule, partial }),
    },
  });

  return NextResponse.json({ test, moduleCounts, missingByModule, partial });
}
