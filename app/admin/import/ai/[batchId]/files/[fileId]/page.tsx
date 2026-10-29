import { Breadcrumbs } from "@/components/sat/breadcrumbs";
import Link from "next/link";
import { promotionSourceId } from "@/lib/content-source";
import { ImportSteps } from "@/components/sat/import-steps";
import { parseTarget } from "@/lib/quick-import";
import { randomUUID } from "crypto";
import { redirect } from "next/navigation";
import { Card } from "@/components/ui/card";
import { PageShell } from "@/components/sat";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { computeCropImageSources } from "@/lib/ingest-crop-source";
import { computeExtractedTests, resolveExtractedTestScope } from "@/lib/ingest-sets.server";
import { reconcileWarningsJson } from "@/lib/ingest-warnings";
import { ExtractedTestRail } from "@/app/admin/import/ai/_components/extracted-test-rail";
import { FileReviewClient } from "./review-client";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ batchId: string; fileId: string }>;
  searchParams: Promise<{ candidate?: string }>;
}

function formatDuration(seconds: number) {
  if (!Number.isFinite(seconds) || seconds <= 0) return "0 min";
  const minutes = Math.ceil(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours}h ${rest}m` : `${hours}h`;
}

export default async function AiImportFileReviewPage({ params, searchParams }: PageProps) {
  const session = await auth();
  if (!session) redirect("/login");
  if (!["TEACHER", "ADMIN"].includes(session.user.role)) redirect("/student");

  const { batchId, fileId } = await params;
  const { candidate: candidateParam } = await searchParams;
  const [batch, file, reviewSession, latestEvent] = await Promise.all([
    prisma.ingestBatch.findUnique({ where: { id: batchId } }),
    prisma.ingestSourceFile.findFirst({ where: { id: fileId, batchId } }),
    prisma.ingestReviewSession.upsert({
      where: { batchId },
      create: {
        id: `review_${randomUUID().replace(/-/g, "")}`,
        batchId,
        sourceFileId: fileId,
        currentStep: "QUESTIONS",
        status: "IN_PROGRESS",
      },
      update: { sourceFileId: fileId, currentStep: "QUESTIONS" },
    }),
    prisma.ingestJobEvent.findFirst({
      where: { batchId },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  if (!batch || !file) redirect("/admin/import/ai");
  // "Import with AI" target (breadcrumb + stepper) when this batch comes from it.
  const quickTarget = batch.importMode === "AI_CSV" ? parseTarget(batch.targetJson) : null;

  // Extracted Test grouping + crop siblings first — candidates for FPT/PS often
  // live on the answer/explanation file while images live on the question file.
  const [cropImageSourceMap, setRows] = await Promise.all([
    computeCropImageSources(batchId),
    computeExtractedTests(batchId),
  ]);
  const scope = resolveExtractedTestScope(setRows, fileId);
  const candidateFileIds = scope.candidateSourceFileIds;
  const answerFileIds = scope.extractedTest?.fileIds ?? [fileId];

  const [pages, candidates, answers, fileImages, incidents] = await Promise.all([
    prisma.ingestPageArtifact.findMany({
      where: { batchId, sourceFileId: fileId },
      orderBy: { pageNumber: "asc" },
    }),
    prisma.ingestQuestionCandidate.findMany({
      where: {
        batchId,
        sourceFileId: { in: candidateFileIds },
        NOT: { OR: [{ status: "REJECTED" }, { promotionStatus: "REJECTED" }] },
      },
      // moduleLabel first so a full test's modules don't interleave (each module
      // restarts numbering at 1); practice sets have a null label and fall through.
      orderBy: [{ moduleLabel: "asc" }, { questionNumber: "asc" }, { createdAt: "asc" }],
    }),
    prisma.ingestAnswerCandidate.findMany({
      where: { batchId, sourceFileId: { in: answerFileIds } },
      orderBy: [{ moduleLabel: "asc" }, { questionNumber: "asc" }, { createdAt: "asc" }],
      take: 400,
    }),
    prisma.ingestImageArtifact.findMany({
      where: { batchId, sourceFileId: fileId },
      orderBy: [{ pageNumber: "asc" }, { imageIndex: "asc" }],
      take: 300,
    }),
    prisma.ingestIncident.findMany({
      where: { batchId, sourceFileId: { in: answerFileIds } },
      orderBy: [{ status: "asc" }, { severity: "asc" }, { createdAt: "desc" }],
      take: 100,
    }),
  ]);

  const candidateLinks = candidates.length
    ? await prisma.ingestCandidateImageLink.findMany({
        where: { batchId, candidateId: { in: candidates.map((candidate) => candidate.id) } },
        orderBy: [{ candidateId: "asc" }, { sortOrder: "asc" }],
      })
    : [];

  // Crops for sibling-scoped candidates are often stored under the answer file;
  // include those artifacts so STEM slots can resolve previews on the question DOCX.
  const linkedImageIds = [...new Set(candidateLinks.map((link) => link.imageArtifactId))];
  const missingLinkedIds = linkedImageIds.filter((id) => !fileImages.some((image) => image.id === id));
  const linkedImages =
    missingLinkedIds.length > 0
      ? await prisma.ingestImageArtifact.findMany({
          where: { batchId, id: { in: missingLinkedIds } },
        })
      : [];
  const images = [...fileImages, ...linkedImages].sort(
    (a, b) => (a.pageNumber ?? 0) - (b.pageNumber ?? 0) || (a.imageIndex ?? 0) - (b.imageIndex ?? 0),
  );
  // Promoted questions of the matching full test — offered as targets when assigning
  // an extracted image to a question from the gallery (a full-test question source
  // often has images but no candidates, so there's no per-candidate board to use).
  let assignTargets: { questionId: string; label: string }[] = [];
  if (file.contentType === "FULL_PRACTICE_TEST" && file.testNumber != null) {
    // The Test this batch promoted for that number, else TEST N of the batch's source (several
    // sources can each have a TEST N, so the number alone is not enough).
    const promotedTest = await prisma.ingestPromotionArtifact.findFirst({
      where: { batchId, artifactType: "FULL_PRACTICE_TEST", groupKey: `full-test:${file.testNumber}` },
      select: { artifactId: true },
    });
    const match = promotedTest
      ? { id: promotedTest.artifactId }
      : await prisma.fullPracticeTest.findFirst({
          where: { number: file.testNumber, sourceId: await promotionSourceId(batchId, "tests") },
          select: { id: true },
        });
    if (match) {
      const wantSection = file.section ? (file.section.toUpperCase().includes("MATH") ? "MATH" : "RW") : null;
      const ftqs = await prisma.fullPracticeTestQuestion.findMany({
        where: { module: { testId: match.id, ...(wantSection ? { section: wantSection } : {}) } },
        orderBy: [{ module: { order: "asc" } }, { order: "asc" }],
        select: { order: true, questionId: true, module: { select: { name: true, section: true } } },
      });
      assignTargets = ftqs.map((r) => {
        const mod = r.module.name.replace(/Reading\s*&?\s*Writing\s*/i, "").replace(/Mathematics?\s*/i, "").trim() || r.module.section;
        return { questionId: r.questionId, label: `${mod} · Q${r.order + 1}` };
      });
    }
  }

  // Resolve which source to crop from — this file if it has renderable pages,
  // otherwise a sibling in the batch that does (e.g. Test 1 R&W images live in the
  // questions DOCX while the candidates come from the answers DOCX).
  const cropImageSource = cropImageSourceMap[file.id] ?? null;
  // The Extracted Test this file belongs to — shown as context so the reviewer sees
  // the whole set (question + answer + explanation files) and its completeness.
  const extractedTest = scope.extractedTest;
  const ROLE_LABEL: Record<string, string> = { QUESTION: "Questions", ANSWER: "Answers", EXPLANATION: "Explanations", OTHER: "Other" };
  const questionsHost =
    extractedTest?.files
      .filter((f) => f.nQ > 0)
      .map((f) => f.name)
      .join(", ") ?? null;

  const estimatedPages = pages.length || file.pageCount || 0;
  const secondsPerPage = latestEvent?.secondsPerPage && latestEvent.secondsPerPage > 0 ? latestEvent.secondsPerPage : 60;
  const estimatedSeconds = Math.ceil(estimatedPages * secondsPerPage);

  return (
    <PageShell className="grid grid-cols-1 gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
      <div className="min-w-0 lg:sticky lg:top-4 lg:self-start">
        <ExtractedTestRail rows={setRows} batchId={batchId} currentFileId={file.id} />
      </div>

      <div className="min-w-0 space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          {/* "Import with AI" batches come back to their wizard (step 3); OCR batches to AI Import. */}
          {batch?.importMode === "AI_CSV" ? (
            <>
              <Breadcrumbs
                items={[
                  { label: "Home", href: "/teacher" },
                  quickTarget?.kind === "FULL_PRACTICE_TEST" ? { label: "Tests", href: "/teacher/tests" } : { label: "Practice", href: "/teacher/practice-sets" },
                  { label: "Import with AI", href: `/teacher/import/${batchId}` },
                  ...(quickTarget
                    ? [{ label: quickTarget.kind === "PRACTICE_SET" ? quickTarget.topicName : quickTarget.testNumber ? `TEST ${quickTarget.testNumber}` : quickTarget.testName, href: `/teacher/import/${batchId}` }]
                    : []),
                  { label: "Step 3 · Review & crop" },
                ]}
              />
              <ImportSteps current={3} hrefs={{ 2: `/teacher/import/${batchId}#step-2`, 3: `/teacher/import/${batchId}#step-3` }} />
            </>
          ) : (
            <Breadcrumbs items={[{ label: "Home", href: "/teacher" }, { label: "Admin" }, { label: "AI Import", href: `/admin/import/ai?batch=${batchId}` }, { label: "Review file" }]} />
          )}
          <h1 className="text-[26px] font-bold tracking-[-0.3px] text-gray-900">Review File</h1>
          <p className="mt-1 text-sm text-gray-500">{file.relativePath}</p>
        </div>
        {batch?.importMode === "AI_CSV" ? (
          <Link href={`/teacher/import/${batchId}#step-3`} className="shrink-0 self-start rounded-lg border border-[var(--sat-border)] bg-white px-3 py-2 text-sm font-semibold text-gray-800 hover:bg-[var(--sat-primary-soft)]">
            ← Back to step 3
          </Link>
        ) : (
          <Card padding="md">
            <p className="text-xs uppercase text-gray-400">Estimated processing time</p>
            <p className="mt-1 text-lg font-semibold text-gray-900">{formatDuration(estimatedSeconds)}</p>
            <p className="mt-1 text-xs text-gray-500">{estimatedPages} pages · {secondsPerPage.toFixed(1)} sec/page</p>
          </Card>
        )}
      </div>

      {extractedTest && (
        <Card padding="md">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs uppercase text-gray-400">Extracted Test</p>
              <p className="truncate text-base font-semibold text-gray-900" title={extractedTest.title}>{extractedTest.title}</p>
            </div>
            <div className="flex flex-col items-end gap-1">
              <span className="flex h-2 w-40 overflow-hidden rounded-full bg-gray-100" title={`${extractedTest.complete} complete · ${extractedTest.attention} attention · ${extractedTest.needsReview} review`}>
                {extractedTest.complete > 0 && <span className="bg-emerald-500" style={{ width: `${(extractedTest.complete / (extractedTest.total || 1)) * 100}%` }} />}
                {extractedTest.attention > 0 && <span className="bg-amber-500" style={{ width: `${(extractedTest.attention / (extractedTest.total || 1)) * 100}%` }} />}
                {extractedTest.needsReview > 0 && <span className="bg-rose-500" style={{ width: `${(extractedTest.needsReview / (extractedTest.total || 1)) * 100}%` }} />}
              </span>
              <span className="text-xs text-gray-500">
                {extractedTest.total} questions · <span className="text-rose-600">{extractedTest.needsReview} review</span> · <span className="text-amber-600">{extractedTest.attention} attention</span>
              </span>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {extractedTest.files.map((f) => (
              <Link
                key={f.id}
                href={`/admin/import/ai/${batchId}/files/${f.id}`}
                className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs hover:bg-gray-50 ${f.id === file.id ? "border-blue-300 bg-blue-50 text-blue-800" : "border-gray-200 text-gray-600"}`}
                title={`${ROLE_LABEL[f.role]} · ${f.nQ} questions · ${f.nA} answers`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${f.role === "QUESTION" ? "bg-blue-500" : f.role === "ANSWER" ? "bg-emerald-500" : f.role === "EXPLANATION" ? "bg-violet-500" : "bg-gray-300"}`} />
                <span className="font-medium">{ROLE_LABEL[f.role]}</span>
                <span className="truncate max-w-[16rem] text-gray-400">{f.name}</span>
                {f.nQ > 0 && <span className="text-gray-400">· {f.nQ}q</span>}
              </Link>
            ))}
          </div>
          {(extractedTest.needsReview > 0 || extractedTest.attention > 0) && (
            <div className="mt-3 rounded-md border border-amber-200 bg-amber-50/70 px-3 py-2">
              <p className="text-[11px] font-medium text-amber-900">
                Pending questions (same status as the sidebar · {extractedTest.needsReview + extractedTest.attention})
              </p>
              <div className="mt-1.5 flex flex-wrap gap-1">
                {extractedTest.questions
                  .filter((q) => q.level === "crit" || q.level === "warn")
                  .slice(0, 40)
                  .map((q) => (
                    <Link
                      key={q.candidateId}
                      href={`/admin/import/ai/${batchId}/files/${file.id}?candidate=${q.candidateId}`}
                      className={`rounded border px-1.5 py-0.5 text-[11px] font-medium ${
                        q.level === "crit"
                          ? "border-rose-200 bg-rose-50 text-rose-800"
                          : "border-amber-200 bg-white text-amber-900"
                      }`}
                      title={q.notes.join(" · ") || undefined}
                    >
                      {q.moduleLabel ? `M${q.moduleLabel} · Q${q.questionNumber ?? "?"}` : `Q${q.questionNumber ?? "?"}`}
                    </Link>
                  ))}
              </div>
            </div>
          )}
          <Link href={`/admin/import/ai/sets?batch=${batchId}`} className="mt-3 inline-block text-xs text-blue-600 hover:underline">
            View all Extracted Tests and per-question detail →
          </Link>
        </Card>
      )}

      <FileReviewClient
        batchId={batchId}
        file={{
          id: file.id,
          relativePath: file.relativePath,
          contentType: file.contentType,
          sourceKind: file.sourceKind,
          section: file.section,
          topicName: file.topicName,
          difficulty: file.difficulty,
          status: file.status,
          extension: file.extension,
        }}
        reviewSession={{ currentStep: reviewSession.currentStep, status: reviewSession.status }}
        assignTargets={assignTargets}
        cropImageSource={cropImageSource}
        candidateScope={
          scope.scopedFromSiblings
            ? {
                kind: "extracted-test",
                title: extractedTest?.title ?? "Extracted Test",
                hostFiles: questionsHost,
              }
            : null
        }
        pages={pages.map((page) => ({
          id: page.id,
          pageNumber: page.pageNumber,
          method: page.method,
          extractedText: page.extractedText,
          warning: page.warning,
        }))}
        candidates={candidates.map((candidate) => ({
          id: candidate.id,
          questionNumber: candidate.questionNumber,
          questionExternalId: candidate.questionExternalId,
          moduleLabel: candidate.moduleLabel,
          section: candidate.section,
          domainName: candidate.domainName,
          topicName: candidate.topicName,
          subskillName: candidate.subskillName,
          difficulty: candidate.difficulty,
          type: candidate.type,
          stem: candidate.stem,
          stimulus: candidate.stimulus,
          optionsJson: candidate.optionsJson,
          correctAnswer: candidate.correctAnswer,
          explanation: candidate.explanation,
          confidence: candidate.confidence,
          status: candidate.status,
          officialQuestionId: candidate.officialQuestionId,
          promotionStatus: candidate.promotionStatus,
          warningsJson: reconcileWarningsJson(candidate.warningsJson, {
            correctAnswer: candidate.correctAnswer,
          }).json,
        }))}
        answers={answers.map((answer) => ({
          id: answer.id,
          questionNumber: answer.questionNumber,
          moduleLabel: answer.moduleLabel,
          answer: answer.answer,
          explanation: answer.explanation,
          confidence: answer.confidence,
        }))}
        images={images.map((image) => ({
          id: image.id,
          pageArtifactId: image.pageArtifactId,
          pageNumber: image.pageNumber,
          imageIndex: image.imageIndex,
          origin: image.origin,
          fileUrl: image.fileUrl,
          base64Data: image.base64Data,
          mimeType: image.mimeType,
          width: image.width,
          height: image.height,
          status: image.status,
        }))}
        imageLinks={candidateLinks.map((link) => ({
          id: link.id,
          candidateId: link.candidateId,
          imageArtifactId: link.imageArtifactId,
          targetType: link.targetType,
          optionLabel: link.optionLabel,
          sortOrder: link.sortOrder,
        }))}
        questionStatuses={extractedTest?.questions ?? []}
        initialCandidateId={candidateParam ?? null}
        incidents={incidents.map((incident) => ({
          id: incident.id,
          severity: incident.severity,
          code: incident.code,
          message: incident.message,
          status: incident.status,
          decision: incident.decision,
          action: incident.action,
        }))}
      />
      </div>
    </PageShell>
  );
}
