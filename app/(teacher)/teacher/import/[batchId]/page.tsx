import { notFound, redirect } from "next/navigation";
import { PageHeader, PageShell } from "@/components/sat";
import { Breadcrumbs } from "@/components/sat/breadcrumbs";
import prisma from "@/lib/prisma";
import { requireContentImporter } from "@/lib/rbac";
import { NotFoundError } from "@/lib/api-error";
import { loadQuickBatch } from "@/lib/quick-import.server";
import {
  answerFileIds,
  buildCsvPrompt,
  fileName,
  moduleFileIsCombined,
  moduleQuestionFileId,
  modulesOfFile,
  questionFileIds,
  TEST_MODULE_INFO,
  TEST_MODULES,
  testModuleIndex,
} from "@/lib/quick-import";
import { buildQuestionContent, classifyQuestion } from "@/lib/ingest-sets";
import { difficultyLabel } from "@/lib/domain-meta";
import { practiceAreaLabel, type PracticeAreaCode } from "@/lib/practice-area";
import { QuickImportWorkspace, type ModuleCardInfo, type QuickQuestionRow } from "./quick-import-workspace";
import { ImportSteps } from "@/components/sat/import-steps";
import { imagePromptFor } from "@/lib/import-media.server";
import { reconcileFigureReview } from "@/lib/ingest-review";

/**
 * "Import with AI", steps 2 and 3: copy the prompt, upload the CSV the AI made (and, to reprocess,
 * the artifacts zip / images zip), then check the questions — crop figures in Review — and create the
 * Draft Practice Set or Test.
 */
export default async function QuickImportBatchPage({ params }: { params: Promise<{ batchId: string }> }) {
  const session = await requireContentImporter();
  if (!session) redirect("/teacher");
  const { batchId } = await params;
  let loaded;
  try {
    loaded = await loadQuickBatch(batchId, session.user);
  } catch (error) {
    if (error instanceof NotFoundError) notFound();
    throw error;
  }
  const { batch, target, questionFile } = loaded;
  const isTest = target.kind === "FULL_PRACTICE_TEST";
  // Review (edit and crop) opens the questions PDF the question comes from (a Test may have up to 4).
  const reviewFor = (fileId: string | null | undefined) => (fileId ? `/admin/import/ai/${batchId}/files/${fileId}` : null);
  // Self-healing and idempotent: a question whose figure is already attached no longer waits for it.
  await reconcileFigureReview(
    (await prisma.ingestQuestionCandidate.findMany({ where: { batchId, status: "NEEDS_REVIEW", promotionStatus: { not: "PROMOTED" } }, select: { id: true } })).map((c) => c.id),
  );
  const [candidates, links, source, artifact] = await Promise.all([
    prisma.ingestQuestionCandidate.findMany({ where: { batchId } }),
    prisma.ingestCandidateImageLink.findMany({ where: { batchId }, select: { candidateId: true, targetType: true } }),
    batch.sourceId ? prisma.source.findUnique({ where: { id: batch.sourceId }, select: { name: true } }) : null,
    prisma.ingestPromotionArtifact.findFirst({ where: { batchId, groupKey: `quick:${batchId}` } }),
  ]);

  // Same check as the AI Import set-load module (lib/ingest-sets.ts).
  const rows: QuickQuestionRow[] = candidates
    .sort((a, b) => testModuleIndex(a) - testModuleIndex(b) || (a.questionNumber ?? 0) - (b.questionNumber ?? 0))
    .map((c) => {
      const own = links.filter((link) => link.candidateId === c.id);
      let options: Array<{ text?: string }> = [];
      try {
        options = JSON.parse(c.optionsJson ?? "[]");
      } catch {
        options = [];
      }
      const classification = classifyQuestion(
        buildQuestionContent({
          type: c.type,
          correctAnswer: c.correctAnswer,
          stem: c.stem,
          stimulus: c.stimulus,
          explanation: c.explanation,
          section: c.section,
          optTextCount: options.filter((o) => o.text?.trim()).length,
          optImgCount: own.filter((link) => link.targetType === "OPTION").length + (own.some((link) => link.targetType === "OPTION_BLOCK") ? 4 : 0),
          hasStemImageLink: own.some((link) => link.targetType === "STEM"),
          hasStimulusImageLink: own.some((link) => link.targetType === "STIMULUS"),
        }),
      );
      let warnings: string[] = [];
      try {
        warnings = JSON.parse(c.warningsJson ?? "[]");
      } catch {
        warnings = [];
      }
      return {
        id: c.id,
        number: c.questionNumber ?? 0,
        module: isTest ? TEST_MODULES[testModuleIndex(c)] : null,
        reviewHref: reviewFor(c.sourceFileId ?? questionFile?.id),
        stem: (c.stem ?? "").slice(0, 120),
        status: c.status,
        promoted: c.promotionStatus === "PROMOTED",
        level: classification.level,
        notes: [...classification.notes, ...warnings],
        images: own.length,
      };
    });

  // A Test is loaded one module at a time: one card per module with the files to give the AI (its
  // questions file + its section's answers / explanations + the Test's answer key), its prompt and
  // what is loaded. Which file is which comes from the fields chosen in step 1.
  const names = (ids: string[]) => ids.map((id) => fileName(target, id)).filter((name): name is string => Boolean(name));
  const modules: ModuleCardInfo[] | null = isTest
    ? TEST_MODULES.map((code) => {
        const info = TEST_MODULE_INFO[code];
        const own = rows.filter((row) => row.module === code);
        const fileId = target.files ? moduleQuestionFileId(target, code) : questionFile?.id ?? null;
        return {
          code,
          name: info.name,
          expected: info.expected,
          questionsFile: fileId ? fileName(target, fileId) ?? questionFile?.relativePath.split("/").pop() ?? null : null,
          combined: moduleFileIsCombined(target, code),
          answerFiles: names(answerFileIds(target, code)),
          prompt: buildCsvPrompt(target, code),
          loaded: own.length,
          ready: own.filter((row) => row.status === "READY" || row.status === "REVIEWED").length,
          inDraft: own.filter((row) => row.promoted).length,
        };
      })
    : null;
  const questionIds = questionFileIds(target);
  const pdfNames = target.files ? names(questionIds).join(" · ") : questionFile?.relativePath.split("/").pop();

  // One Review per questions file (a Test: R&W / Math, or each module when it came in its own file).
  const sectionLabel = (id: string) => {
    const codes = modulesOfFile(target, id);
    const section = codes[0] ? TEST_MODULE_INFO[codes[0]].section : null;
    const word = section === "RW" ? "Reading and Writing" : "Math";
    return codes.length === 1 ? `Review ${word} · Module ${TEST_MODULE_INFO[codes[0]].second ? 2 : 1}` : `Review ${word}`;
  };
  const reviewLinks =
    isTest && questionIds.length
      ? questionIds.map((id) => ({ label: sectionLabel(id), href: reviewFor(id)! }))
      : questionFile
        ? [{ label: "Open Review (edit and crop)", href: reviewFor(questionFile.id)! }]
        : [];

  const title =
    target.kind === "PRACTICE_SET"
      ? `${practiceAreaLabel(target.section as PracticeAreaCode)} · ${target.domainName} · ${target.topicName} · ${difficultyLabel(target.difficulty)}`
      : `Test · ${target.testName}`;

  return (
    <PageShell>
      <Breadcrumbs
        items={[
          { label: "Home", href: "/teacher" },
          target.kind === "PRACTICE_SET" ? { label: "Practice", href: "/teacher/practice-sets" } : { label: "Tests", href: "/teacher/tests" },
          { label: "Import with AI", href: `/teacher/import?kind=${target.kind}` },
          { label: target.kind === "PRACTICE_SET" ? `${target.topicName} · ${difficultyLabel(target.difficulty)}` : target.testNumber ? `TEST ${target.testNumber}` : target.testName },
          { label: rows.length ? "Step 3 · Review & Draft" : "Step 2 · AI file" },
        ]}
      />
      <PageHeader
        title="Import with AI"
        description={
          <>
            {title} · Source: <b>{source?.name ?? "—"}</b> · PDF: {pdfNames || "—"}
          </>
        }
      />
      {/* Step 1 is done (the import exists); steps 2 and 3 are on this page. */}
      <ImportSteps current={rows.length ? 3 : 2} hrefs={{ 2: "#step-2", 3: "#step-3" }} />
      <QuickImportWorkspace
        batchId={batchId}
        kind={target.kind}
        prompt={buildCsvPrompt(target)}
        modules={modules}
        rows={rows}
        reviewLinks={reviewLinks}
        draftHref={artifact ? (artifact.artifactType === "PRACTICE_SET" ? `/teacher/practice-sets/${artifact.artifactId}?edit` : `/teacher/tests/${artifact.artifactId}?edit`) : null}
        imagePrompt={imagePromptFor(candidates.filter((c) => c.status !== "REJECTED"))}
      />
    </PageShell>
  );
}
