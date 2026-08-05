import { redirect } from "next/navigation";
import { Activity, AlertTriangle, CheckCircle2, Clock3, FileSearch, RefreshCcw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { CopyableTruncatedText } from "@/components/ui/copyable-truncated-text";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { AiImportWorkflowClient, IngestAutoRefresh } from "./ai-import-client";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ batch?: string }>;
}

type BadgeVariant = "default" | "success" | "warning" | "danger" | "info";

function fmtDate(value: Date) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(value);
}

function pct(done: number, total: number) {
  if (!total) return 0;
  return Math.min(100, Math.round((done / total) * 100));
}

function formatDuration(seconds: number) {
  if (!Number.isFinite(seconds) || seconds <= 0) return "0 min";
  const minutes = Math.ceil(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours}h ${rest}m` : `${hours}h`;
}

type EtaSnapshot = {
  totalFiles: number;
  processedFiles: number;
  countedFiles: number;
  unknownFiles: number;
  totalPagesKnown: number;
  processedPages: number;
  pendingOcrPages: number;
  avgPagesPerFile: number;
  secondsPerPage: number;
  estimatedRemainingPages: number;
  estimatedSecondsRemaining: number;
  source: string;
};

function buildEtaSnapshot({
  totalFiles,
  processedFiles,
  totalPagesKnown,
  processedPages,
  countedFiles,
  pendingOcrPages,
  latestEvent,
}: {
  totalFiles: number;
  processedFiles: number;
  totalPagesKnown: number;
  processedPages: number;
  countedFiles: number;
  pendingOcrPages: number;
  latestEvent?: {
    processedFiles: number;
    processedPages: number;
    totalFilesKnown: number;
    totalPagesKnown: number;
    estimatedRemainingPages: number;
    estimatedSecondsRemaining: number;
    secondsPerPage: number;
    avgPagesPerFile: number;
  } | null;
}): EtaSnapshot {
  if (latestEvent && latestEvent.estimatedSecondsRemaining > 0) {
    return {
      totalFiles: latestEvent.totalFilesKnown || totalFiles,
      processedFiles: latestEvent.processedFiles || processedFiles,
      countedFiles,
      unknownFiles: Math.max((latestEvent.totalFilesKnown || totalFiles) - countedFiles, 0),
      totalPagesKnown: latestEvent.totalPagesKnown || totalPagesKnown,
      processedPages: latestEvent.processedPages || processedPages,
      pendingOcrPages,
      avgPagesPerFile: latestEvent.avgPagesPerFile || (countedFiles ? totalPagesKnown / countedFiles : 1),
      secondsPerPage: latestEvent.secondsPerPage || 60,
      estimatedRemainingPages: latestEvent.estimatedRemainingPages,
      estimatedSecondsRemaining: latestEvent.estimatedSecondsRemaining,
      source: "last event",
    };
  }

  const avgPagesPerFile = countedFiles > 0 ? totalPagesKnown / countedFiles : 1;
  const unknownFiles = Math.max(totalFiles - countedFiles, 0);
  const estimatedTotalPages = totalPagesKnown + unknownFiles * avgPagesPerFile;
  const estimatedRemainingPages = Math.max(estimatedTotalPages - processedPages, 0) + pendingOcrPages;
  const secondsPerPage = latestEvent?.secondsPerPage && latestEvent.secondsPerPage > 0 ? latestEvent.secondsPerPage : 60;
  return {
    totalFiles,
    processedFiles,
    countedFiles,
    unknownFiles,
    totalPagesKnown,
    processedPages,
    pendingOcrPages,
    avgPagesPerFile,
    secondsPerPage,
    estimatedRemainingPages,
    estimatedSecondsRemaining: Math.ceil(estimatedRemainingPages * secondsPerPage),
    source: latestEvent ? "derived from last event" : "derived from files",
  };
}

function badgeVariant(status: string): BadgeVariant {
  if (["COMPLETED", "READY", "REVIEWED", "PROMOTED", "RESOLVED"].includes(status)) return "success";
  if (["FAILED", "ERROR", "REJECTED"].includes(status)) return "danger";
  if (["NEEDS_REVIEW", "NEEDS_OCR", "WARNING", "OPEN"].includes(status)) return "warning";
  if (["PROCESSING", "SCANNING", "EDITING"].includes(status)) return "info";
  return "default";
}

function batchUiState(status: string, ocrPending: number, openIncidents: number) {
  if (status === "FAILED") {
    return {
      label: "Failed",
      description: "Processing stopped. Review the error and retry the affected items.",
      variant: "danger" as BadgeVariant,
      icon: AlertTriangle,
    };
  }
  if (status === "PROCESSING" || status === "SCANNING") {
    return {
      label: "Processing",
      description: "Extraction, OCR, pairing or candidate detection is running.",
      variant: "info" as BadgeVariant,
      icon: RefreshCcw,
    };
  }
  if (ocrPending > 0) {
    return {
      label: "OCR Review",
      description: "Some pages need OCR recovery before the batch can be considered complete.",
      variant: "warning" as BadgeVariant,
      icon: AlertTriangle,
    };
  }
  if (openIncidents > 0) {
    return {
      label: "Needs Review",
      description: "The batch has warnings or inconsistencies that should be reviewed.",
      variant: "warning" as BadgeVariant,
      icon: FileSearch,
    };
  }
  if (status === "COMPLETED") {
    return {
      label: "Ready",
      description: "The batch is processed and ready for question review or promotion.",
      variant: "success" as BadgeVariant,
      icon: CheckCircle2,
    };
  }
  return {
    label: "Pending",
    description: "Scan or process the selected batch to start extraction.",
    variant: "default" as BadgeVariant,
    icon: Clock3,
  };
}

function ProgressBar({ value }: { value: number }) {
  return (
    <div className="h-2 overflow-hidden rounded-full bg-gray-100">
      <div className="h-full rounded-full bg-blue-600 transition-all" style={{ width: `${value}%` }} />
    </div>
  );
}

function practiceSetState({
  candidates,
  ready,
  promoted,
  missingAnswer,
  artifactId,
}: {
  candidates: number;
  ready: number;
  promoted: number;
  missingAnswer: number;
  artifactId?: string;
}) {
  if (artifactId) return { label: "Draft Created", variant: "success" as BadgeVariant };
  if (candidates === 0) return { label: "No Questions", variant: "warning" as BadgeVariant };
  if (missingAnswer > 0) return { label: "Missing Answers", variant: "warning" as BadgeVariant };
  if (promoted > 0) return { label: "Ready to Create Set", variant: "success" as BadgeVariant };
  if (ready === candidates) return { label: "Questions Not Promoted", variant: "warning" as BadgeVariant };
  return { label: "Needs Review", variant: "warning" as BadgeVariant };
}

function fullTestModuleIndex(section: string | null, moduleLabel: string | null) {
  const normalizedSection = (section ?? "").toUpperCase().includes("RW") || (section ?? "").toUpperCase().includes("READ") ? "RW" : "MATH";
  const label = (moduleLabel ?? "").toUpperCase();
  const secondModule = /\b2\b|2B|MODULE\s*2|MOD\s*2/.test(label);
  if (normalizedSection === "RW") return secondModule ? 1 : 0;
  return secondModule ? 3 : 2;
}

const fullTestExpectedCounts = [27, 27, 22, 22];

export default async function AiImportPage({ searchParams }: PageProps) {
  const session = await auth();
  if (!session) redirect("/login");
  if (!["TEACHER", "ADMIN"].includes(session.user.role)) redirect("/student");

  const { batch: requestedBatchId } = await searchParams;
  const batches = await prisma.ingestBatch.findMany({
    orderBy: { createdAt: "desc" },
    take: 20,
  });
  const selectedBatchId = requestedBatchId ?? batches[0]?.id;
  const selectedBatch = selectedBatchId
    ? await prisma.ingestBatch.findUnique({ where: { id: selectedBatchId } })
    : null;

  const [files, pages, candidates, answers, imageArtifacts, incidents, ocrRequiredBySource, latestEvents, countedFiles, practiceSources, practiceCandidates, practiceArtifacts, fullTestCandidates, fullTestArtifacts, totalCandidates, reviewCandidateCount, totalIncidents, openIncidentCount, totalImages] = selectedBatchId
    ? await Promise.all([
        prisma.ingestSourceFile.findMany({
          where: { batchId: selectedBatchId },
          orderBy: [{ status: "asc" }, { relativePath: "asc" }],
          take: 300,
        }),
        prisma.ingestPageArtifact.findMany({
          where: { batchId: selectedBatchId },
          orderBy: [{ status: "asc" }, { pageNumber: "asc" }],
          take: 80,
        }),
        prisma.ingestQuestionCandidate.findMany({
          where: { batchId: selectedBatchId },
          orderBy: [{ status: "asc" }, { confidence: "desc" }],
          take: 300,
        }),
        prisma.ingestAnswerCandidate.count({ where: { batchId: selectedBatchId } }),
        prisma.ingestImageArtifact.findMany({
          where: { batchId: selectedBatchId },
          orderBy: [{ sourceFileId: "asc" }, { pageNumber: "asc" }],
          take: 500,
        }),
        prisma.ingestIncident.findMany({
          where: { batchId: selectedBatchId },
          orderBy: [{ severity: "asc" }, { createdAt: "desc" }],
          take: 100,
        }),
        prisma.ingestPageArtifact.groupBy({
          by: ["sourceFileId"],
          where: { batchId: selectedBatchId, status: "NEEDS_OCR" },
          _count: { _all: true },
        }),
        prisma.ingestJobEvent.findMany({
          where: { batchId: selectedBatchId },
          orderBy: { createdAt: "desc" },
          take: 12,
        }),
        prisma.ingestSourceFile.count({
          where: { batchId: selectedBatchId, pageCount: { gt: 0 } },
        }),
        prisma.ingestSourceFile.findMany({
          where: { batchId: selectedBatchId, contentType: "PRACTICE_SET", sourceKind: "PRACTICE_EXERCISE" },
          orderBy: [{ topicName: "asc" }, { difficulty: "asc" }, { relativePath: "asc" }],
        }),
        prisma.ingestQuestionCandidate.findMany({
          where: { batchId: selectedBatchId, contentType: "PRACTICE_SET" },
          select: {
            id: true,
            sourceFileId: true,
            status: true,
            promotionStatus: true,
            correctAnswer: true,
            stem: true,
          },
        }),
        prisma.ingestPromotionArtifact.findMany({
          where: { batchId: selectedBatchId, artifactType: "PRACTICE_SET" },
          select: { sourceFileId: true, artifactId: true, groupKey: true },
        }),
        prisma.ingestQuestionCandidate.findMany({
          where: { batchId: selectedBatchId, contentType: "FULL_PRACTICE_TEST" },
          select: {
            id: true,
            testNumber: true,
            section: true,
            moduleLabel: true,
            status: true,
            promotionStatus: true,
            correctAnswer: true,
            stem: true,
            officialQuestionId: true,
          },
        }),
        prisma.ingestPromotionArtifact.findMany({
          where: { batchId: selectedBatchId, artifactType: "FULL_PRACTICE_TEST" },
          select: { artifactId: true, groupKey: true },
        }),
        prisma.ingestQuestionCandidate.count({ where: { batchId: selectedBatchId } }),
        prisma.ingestQuestionCandidate.count({
          where: {
            batchId: selectedBatchId,
            OR: [
              { status: { in: ["NEEDS_REVIEW", "EDITING"] } },
              { correctAnswer: null },
              { stem: null },
            ],
          },
        }),
        prisma.ingestIncident.count({ where: { batchId: selectedBatchId } }),
        prisma.ingestIncident.count({ where: { batchId: selectedBatchId, status: { not: "RESOLVED" } } }),
        prisma.ingestImageArtifact.count({ where: { batchId: selectedBatchId } }),
      ])
    : [[], [], [], 0, [], [], [], [], 0, [], [], [], [], [], 0, 0, 0, 0, 0];

  const openIncidents = incidents.filter((incident) => incident.status !== "RESOLVED");
  const currentOpenIncidents = openIncidentCount ?? openIncidents.length;
  const ocrRequiredTotal = ocrRequiredBySource.reduce((sum, row) => sum + row._count._all, 0);
  const totalPages = selectedBatch?.totalPages || pages.length;
  const filesPct = pct(selectedBatch?.filesProcessed ?? 0, selectedBatch?.totalFiles ?? 0);
  const pagesPct = pct(selectedBatch?.pagesProcessed ?? 0, totalPages);
  const latestEvent = latestEvents[0] ?? null;
  const eta = buildEtaSnapshot({
    totalFiles: selectedBatch?.totalFiles ?? 0,
    processedFiles: selectedBatch?.filesProcessed ?? 0,
    totalPagesKnown: totalPages,
    processedPages: selectedBatch?.pagesProcessed ?? 0,
    countedFiles,
    pendingOcrPages: ocrRequiredTotal,
    latestEvent,
  });
  const statusSummary = selectedBatch ? batchUiState(selectedBatch.status, ocrRequiredTotal, currentOpenIncidents) : null;
  const StatusIcon = statusSummary?.icon;
  const processBlocked = selectedBatch?.status === "PROCESSING" || selectedBatch?.status === "SCANNING";
  const autoRefresh = Boolean(selectedBatch && (processBlocked || latestEvent?.status === "RUNNING" || latestEvent?.status === "STARTED"));
  const practiceCandidatesBySource = new Map<string, typeof practiceCandidates>();
  for (const candidate of practiceCandidates) {
    const group = practiceCandidatesBySource.get(candidate.sourceFileId) ?? [];
    group.push(candidate);
    practiceCandidatesBySource.set(candidate.sourceFileId, group);
  }
  const practiceArtifactBySource = new Map(practiceArtifacts.filter((artifact) => artifact.sourceFileId).map((artifact) => [artifact.sourceFileId!, artifact]));
  const practiceSetSummaries = practiceSources.map((source) => {
    const sourceCandidates = practiceCandidatesBySource.get(source.id) ?? [];
    const missingAnswer = sourceCandidates.filter((candidate) => !candidate.correctAnswer).length;
    const ready = sourceCandidates.filter((candidate) => candidate.status === "READY" || candidate.status === "REVIEWED").length;
    const promoted = sourceCandidates.filter((candidate) => candidate.promotionStatus === "PROMOTED").length;
    const promotableCandidateIds = sourceCandidates
      .filter((candidate) => ["READY", "REVIEWED"].includes(candidate.status) && candidate.promotionStatus !== "PROMOTED" && candidate.correctAnswer && candidate.stem)
      .map((candidate) => candidate.id);
    const artifact = practiceArtifactBySource.get(source.id);
    return {
      source,
      candidates: sourceCandidates.length,
      ready,
      promoted,
      promotableCandidateIds,
      missingAnswer,
      artifactId: artifact?.artifactId,
      state: practiceSetState({ candidates: sourceCandidates.length, ready, promoted, missingAnswer, artifactId: artifact?.artifactId }),
    };
  });
  const fullTestArtifactByNumber = new Map(
    fullTestArtifacts.map((artifact) => {
      const match = /^full-test:(\d+)$/.exec(artifact.groupKey);
      return [match ? Number(match[1]) : null, artifact.artifactId] as const;
    }).filter((entry): entry is readonly [number, string] => entry[0] !== null)
  );
  const fullTestByNumber = new Map<number, typeof fullTestCandidates>();
  for (const candidate of fullTestCandidates) {
    if (!candidate.testNumber) continue;
    const group = fullTestByNumber.get(candidate.testNumber) ?? [];
    group.push(candidate);
    fullTestByNumber.set(candidate.testNumber, group);
  }
  const fullTestSummaries = [...fullTestByNumber.entries()].sort(([a], [b]) => a - b).map(([testNumber, group]) => {
    const moduleCounts = [0, 0, 0, 0];
    const modulePromoted = [0, 0, 0, 0];
    const moduleReady = [0, 0, 0, 0];
    const promotableCandidateIds: string[] = [];
    for (const candidate of group) {
      const index = fullTestModuleIndex(candidate.section, candidate.moduleLabel);
      moduleCounts[index] += 1;
      if (candidate.promotionStatus === "PROMOTED" && candidate.officialQuestionId) modulePromoted[index] += 1;
      if (candidate.status === "READY" || candidate.status === "REVIEWED") moduleReady[index] += 1;
      if (["READY", "REVIEWED"].includes(candidate.status) && candidate.promotionStatus !== "PROMOTED" && candidate.correctAnswer && candidate.stem) {
        promotableCandidateIds.push(candidate.id);
      }
    }
    const promoted = modulePromoted.reduce((sum, count) => sum + count, 0);
    const total = moduleCounts.reduce((sum, count) => sum + count, 0);
    const artifactId = fullTestArtifactByNumber.get(testNumber);
    return {
      testNumber,
      total,
      ready: moduleReady.reduce((sum, count) => sum + count, 0),
      promoted,
      moduleCounts,
      moduleReady,
      modulePromoted,
      missingByModule: fullTestExpectedCounts.map((expected, index) => Math.max(expected - modulePromoted[index], 0)),
      artifactId,
      partial: promoted > 0 && fullTestExpectedCounts.some((expected, index) => modulePromoted[index] < expected),
      promotableCandidateIds,
    };
  });
  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-8">
      <IngestAutoRefresh enabled={autoRefresh} />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Admin / AI Import</p>
          <h1 className="mt-1 text-2xl font-semibold text-gray-900">AI Batch Import</h1>
          <p className="mt-1 max-w-3xl text-sm text-gray-500">
            Work through staging in order: load files, process extraction, recover OCR issues, review candidates and promote clean drafts.
          </p>
        </div>
        {selectedBatch && (
          <div className="min-w-0 rounded-lg border border-gray-200 bg-white px-4 py-3 text-right shadow-sm">
            <p className="text-xs uppercase text-gray-400">Selected batch</p>
            <CopyableTruncatedText value={selectedBatch.name} className="mt-1 max-w-72 justify-end text-sm font-semibold text-gray-900" />
            <p className="mt-1 text-xs text-gray-500">Updated {fmtDate(selectedBatch.updatedAt)}</p>
          </div>
        )}
      </div>

      {selectedBatch && statusSummary && StatusIcon && (
        <Card padding="md" variant={statusSummary.variant === "danger" ? "danger" : statusSummary.variant === "warning" ? "warning" : statusSummary.variant === "success" ? "success" : "default"}>
          <div className="grid gap-4 lg:grid-cols-[1fr_auto]">
            <div className="flex min-w-0 gap-3">
              <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-gray-700">
                <StatusIcon className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={statusSummary.variant}>{statusSummary.label}</Badge>
                  <Badge variant={badgeVariant(selectedBatch.status)}>{selectedBatch.status}</Badge>
                </div>
                <p className="mt-2 text-sm font-medium text-gray-900">{statusSummary.description}</p>
                {selectedBatch.lastError && <p className="mt-1 text-sm text-red-700">{selectedBatch.lastError}</p>}
              </div>
            </div>
            <div className="grid min-w-64 gap-3 text-xs text-gray-600">
              <div>
                <div className="mb-1 flex justify-between gap-3">
                  <span>Files</span>
                  <span>{selectedBatch.filesProcessed}/{selectedBatch.totalFiles} · {filesPct}%</span>
                </div>
                <ProgressBar value={filesPct} />
              </div>
              <div>
                <div className="mb-1 flex justify-between gap-3">
                  <span>Pages</span>
                  <span>{selectedBatch.pagesProcessed}/{totalPages} · {pagesPct}%</span>
                </div>
                <ProgressBar value={pagesPct} />
              </div>
            </div>
          </div>
        </Card>
      )}

      <AiImportWorkflowClient
        selectedBatchId={selectedBatch?.id}
        selectedBatchStatus={selectedBatch?.status}
        batches={batches.map((batch) => ({
          id: batch.id,
          name: batch.name,
          status: batch.status,
          totalFiles: batch.totalFiles,
          filesProcessed: batch.filesProcessed,
          createdAt: batch.createdAt.toISOString(),
        }))}
        files={files.map((file) => ({
          id: file.id,
          relativePath: file.relativePath,
          contentType: file.contentType,
          sourceKind: file.sourceKind,
          status: file.status,
          section: file.section,
          domainName: file.domainName,
          topicName: file.topicName,
          difficulty: file.difficulty,
          practiceSetVariant: file.practiceSetVariant,
          testNumber: file.testNumber,
        }))}
        incidents={incidents.map((incident) => ({
          id: incident.id,
          code: incident.code,
          status: incident.status,
          severity: incident.severity,
          sourceFileId: incident.sourceFileId,
          message: incident.message,
          decision: incident.decision,
          action: incident.action,
        }))}
        candidates={candidates.map((candidate) => ({
          id: candidate.id,
          sourceFileId: candidate.sourceFileId,
          pageArtifactId: candidate.pageArtifactId,
          contentType: candidate.contentType,
          status: candidate.status,
          promotionStatus: candidate.promotionStatus,
          questionNumber: candidate.questionNumber,
          questionExternalId: candidate.questionExternalId,
          testNumber: candidate.testNumber,
          moduleLabel: candidate.moduleLabel,
          officialQuestionId: candidate.officialQuestionId,
          confidence: Number(candidate.confidence),
          stem: candidate.stem,
          stimulus: candidate.stimulus,
          optionsJson: candidate.optionsJson,
          correctAnswer: candidate.correctAnswer,
          explanation: candidate.explanation,
          section: candidate.section,
          domainName: candidate.domainName,
          topicName: candidate.topicName,
          subskillName: candidate.subskillName,
          difficulty: candidate.difficulty,
          type: candidate.type,
          warningsJson: candidate.warningsJson,
        }))}
        images={imageArtifacts.map((image) => ({
          id: image.id,
          sourceFileId: image.sourceFileId,
          pageArtifactId: image.pageArtifactId,
          pageNumber: image.pageNumber,
          origin: image.origin,
          fileUrl: image.fileUrl,
          base64Data: image.base64Data,
          mimeType: image.mimeType,
        }))}
        practiceSets={practiceSetSummaries.map(({ source, candidates: totalCandidates, ready, promoted, missingAnswer, artifactId, state, promotableCandidateIds }) => ({
          sourceFileId: source.id,
          title: source.topicName || source.relativePath.split("/").at(-1) || "Imported Practice Set",
          relativePath: source.relativePath,
          difficulty: source.difficulty,
          section: source.section,
          variant: source.practiceSetVariant,
          candidates: totalCandidates,
          ready,
          promoted,
          missingAnswer,
          artifactId,
          promotableCandidateIds,
          stateLabel: state.label,
          stateVariant: state.variant,
        }))}
        fullTests={fullTestSummaries}
        counts={{
          ocrPending: ocrRequiredTotal,
          openIncidents: currentOpenIncidents,
          totalIncidents,
          candidates: totalCandidates,
          reviewCandidates: reviewCandidateCount,
          reviewItems: reviewCandidateCount + currentOpenIncidents,
          images: totalImages,
        }}
      />

      {selectedBatch ? (
        <>
          <Card padding="none" className="overflow-hidden">
            <div className="grid gap-0 divide-y divide-gray-100 md:grid-cols-[1fr_1fr_1fr_1fr] md:divide-x md:divide-y-0">
              <div className="p-4">
                <p className="text-xs font-medium uppercase text-gray-400">Detected</p>
                <p className="mt-1 text-sm font-semibold text-gray-900">{totalCandidates} questions</p>
                <p className="mt-1 text-xs text-gray-500">{answers} answers · {totalImages} images</p>
              </div>
              <div className="p-4">
                <p className="text-xs font-medium uppercase text-gray-400">Recovery</p>
                <p className="mt-1 text-sm font-semibold text-gray-900">{ocrRequiredTotal} OCR pending</p>
                <p className="mt-1 text-xs text-gray-500">{currentOpenIncidents} open incidents</p>
              </div>
              <div className="p-4">
                <p className="text-xs font-medium uppercase text-gray-400">ETA</p>
                <p className="mt-1 text-sm font-semibold text-gray-900">{formatDuration(eta.estimatedSecondsRemaining)}</p>
                <p className="mt-1 text-xs text-gray-500">{Math.ceil(eta.estimatedRemainingPages)} estimated pages left</p>
              </div>
              <div className="p-4">
                <p className="text-xs font-medium uppercase text-gray-400">Pace</p>
                <p className="mt-1 text-sm font-semibold text-gray-900">{eta.secondsPerPage.toFixed(1)} sec/page</p>
                <p className="mt-1 text-xs text-gray-500">{eta.source} · {eta.countedFiles}/{eta.totalFiles} files counted</p>
              </div>
            </div>
          </Card>

          <Card padding="none" className="overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 px-4 py-3">
              <div>
                <p className="text-xs font-medium uppercase text-gray-400">Observability</p>
                <h2 className="text-sm font-semibold text-gray-900">Latest Processing Events</h2>
                <p className="mt-1 text-xs text-gray-500">Use the step buttons above for load, process, recover, review and promote actions.</p>
              </div>
              {autoRefresh && (
                <Badge variant="info">
                  <RefreshCcw className="mr-1 h-3 w-3" />
                  Auto-refresh
                </Badge>
              )}
            </div>
            <div className="max-h-72 divide-y divide-gray-100 overflow-auto">
              {latestEvents.map((event) => (
                <div key={event.id} className="grid gap-3 px-4 py-3 text-xs md:grid-cols-[130px_1fr_220px]">
                  <div className="flex items-center gap-2">
                    <Activity className="h-3.5 w-3.5 text-gray-400" />
                    <Badge variant={badgeVariant(event.status)}>{event.status}</Badge>
                  </div>
                  <div className="min-w-0">
                    <p className="line-clamp-2 font-medium text-gray-800">{event.message}</p>
                    <CopyableTruncatedText value={event.sourceFileId} fallback={event.jobType} className="mt-1 max-w-full text-gray-400" />
                  </div>
                  <div className="text-gray-500">
                    <p>{event.processedPages}/{event.totalPagesKnown || eta.totalPagesKnown} known pages</p>
                    <p>{formatDuration(event.estimatedSecondsRemaining)} left · {Number(event.secondsPerPage).toFixed(1)} sec/page</p>
                  </div>
                </div>
              ))}
              {latestEvents.length === 0 && <p className="px-4 py-10 text-center text-sm text-gray-400">No processing events have been recorded yet.</p>}
            </div>
          </Card>
        </>
      ) : (
        <Card padding="md">
          <p className="text-sm text-gray-500">Create a batch from files_to_load or upload a ZIP to scan PDF/DOCX files into staging.</p>
        </Card>
      )}
    </div>
  );
}
