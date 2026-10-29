import { notFound, redirect } from "next/navigation";
import { PageShell } from "@/components/sat";
import { Breadcrumbs } from "@/components/sat/breadcrumbs";
import prisma from "@/lib/prisma";
import { requireContentImporter } from "@/lib/rbac";
import { NotFoundError } from "@/lib/api-error";
import { loadQuickBatch } from "@/lib/quick-import.server";
import { buildCsvPrompt, TEST_MODULES, testModuleIndex } from "@/lib/quick-import";
import { buildQuestionContent, classifyQuestion } from "@/lib/ingest-sets";
import { difficultyLabel } from "@/lib/domain-meta";
import { practiceAreaLabel, type PracticeAreaCode } from "@/lib/practice-area";
import { QuickImportWorkspace, type QuickQuestionRow } from "./quick-import-workspace";

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
        module: target.kind === "FULL_PRACTICE_TEST" ? TEST_MODULES[testModuleIndex(c)] : null,
        stem: (c.stem ?? "").slice(0, 120),
        status: c.status,
        promoted: c.promotionStatus === "PROMOTED",
        level: classification.level,
        notes: [...classification.notes, ...warnings],
        images: own.length,
      };
    });

  const title =
    target.kind === "PRACTICE_SET"
      ? `${practiceAreaLabel(target.section as PracticeAreaCode)} · ${target.domainName} · ${target.topicName} · ${difficultyLabel(target.difficulty)}`
      : `Test · ${target.testName}`;

  return (
    <PageShell width="wide">
      <Breadcrumbs items={[{ label: "Home", href: "/teacher" }, { label: "Import with AI", href: "/teacher/import" }, { label: target.kind === "PRACTICE_SET" ? target.topicName : target.testName }]} />
      <h1 className="text-[26px] font-bold tracking-[-0.3px] text-gray-900">Import with AI</h1>
      <p className="mb-5 mt-1 text-sm text-gray-500">
        {title} · Source: <b>{source?.name ?? "—"}</b> · PDF: {questionFile?.relativePath.split("/").pop() ?? "—"}
      </p>
      <QuickImportWorkspace
        batchId={batchId}
        kind={target.kind}
        prompt={buildCsvPrompt(target)}
        rows={rows}
        reviewHref={questionFile ? `/admin/import/ai/${batchId}/files/${questionFile.id}` : null}
        draftHref={artifact ? (artifact.artifactType === "PRACTICE_SET" ? `/teacher/practice-sets/${artifact.artifactId}/edit` : `/teacher/tests/${artifact.artifactId}/edit`) : null}
      />
    </PageShell>
  );
}
