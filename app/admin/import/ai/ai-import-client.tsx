"use client";

import { BLOCKED_SURFACE } from "@/components/ui/control-states";
import { Checkbox } from "@/components/ui/checkbox";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, FileArchive, FileSearch, RefreshCcw, Search, UploadCloud } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, DisabledReason } from "@/components/ui/button";
import { CopyableTruncatedText } from "@/components/ui/copyable-truncated-text";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { MathContent } from "@/components/math-content";
import { FormattedTextField } from "@/components/formatted-text-field";
import { PdfPageCropper, type CropTarget, type CropOcrResult } from "@/app/admin/import/ai/_components/pdf-page-cropper";
import { ExtractedTestRail } from "@/app/admin/import/ai/_components/extracted-test-rail";
import { queryKeys } from "@/lib/query-keys";
import type { ExtractedTestRow } from "@/lib/ingest-sets";
import { stripIngestImagePlaceholders } from "@/lib/ingest-text-sanitize";
import { errorMessage, readApiError } from "@/lib/api-client";

const MAX_UPLOAD_BYTES = 256 * 1024 * 1024;
const targetTypes = [
  { value: "STEM", label: "Question image" },
  { value: "STIMULUS", label: "Stimulus image" },
  { value: "OPTION", label: "Single option image" },
  { value: "OPTION_BLOCK", label: "Options block to OCR" },
  { value: "ANSWER_FIELD", label: "Answer field / blank line" },
  { value: "EXPLANATION", label: "Explanation image" },
  { value: "PAGE_CONTEXT", label: "Page context" },
];

type BadgeVariant = "default" | "success" | "warning" | "danger" | "info";

type BatchSummary = {
  id: string;
  name: string;
  status: string;
  totalFiles: number;
  filesProcessed: number;
  createdAt: string;
};

type SourceFileSummary = {
  id: string;
  relativePath: string;
  contentType: string;
  sourceKind: string;
  status: string;
  section: string | null;
  domainName: string | null;
  topicName: string | null;
  difficulty: string | null;
  practiceSetVariant: string | null;
  testNumber: number | null;
};

type IncidentSummary = {
  id: string;
  code: string;
  status: string;
  severity: string;
  sourceFileId: string | null;
  message: string;
  decision: string | null;
  action: string | null;
};

type CandidateSummary = {
  id: string;
  sourceFileId: string | null;
  pageArtifactId: string | null;
  contentType: string | null;
  status: string;
  promotionStatus: string;
  questionNumber: number | null;
  questionExternalId: string | null;
  testNumber: number | null;
  moduleLabel: string | null;
  officialQuestionId: string | null;
  confidence: number;
  stem: string | null;
  stimulus: string | null;
  optionsJson: string | null;
  correctAnswer: string | null;
  explanation: string | null;
  section: string | null;
  domainName: string | null;
  topicName: string | null;
  subskillName: string | null;
  difficulty: string | null;
  type: string;
  warningsJson: string | null;
};

// Full-test files bundle modules that each restart numbering at 1, so prefix the
// module (M1/M2B) to tell two identically-numbered questions apart. Practice sets
// have no module label → plain "Q<n>".
function qLabel(moduleLabel: string | null, questionNumber: number | null) {
  const q = `Q${questionNumber ?? "?"}`;
  return moduleLabel ? `M${moduleLabel} · ${q}` : q;
}

type ImageArtifactSummary = {
  id: string;
  sourceFileId: string | null;
  pageArtifactId: string | null;
  pageNumber: number;
  origin: string;
  fileUrl: string | null;
  base64Data: string | null;
  mimeType: string | null;
};

type PracticeSetSummary = {
  sourceFileId: string;
  title: string;
  relativePath: string;
  difficulty: string | null;
  section: string | null;
  variant: string | null;
  candidates: number;
  ready: number;
  promoted: number;
  missingAnswer: number;
  promotableCandidateIds: string[];
  artifactId?: string;
  stateLabel: string;
  stateVariant: BadgeVariant;
};

type FullTestSummary = {
  testNumber: number;
  total: number;
  ready: number;
  promoted: number;
  moduleCounts: number[];
  moduleReady: number[];
  modulePromoted: number[];
  missingByModule: number[];
  artifactId?: string;
  partial: boolean;
  promotableCandidateIds: string[];
};

type AiImportWorkflowProps = {
  selectedBatchId?: string;
  selectedBatchStatus?: string;
  batches: BatchSummary[];
  files: SourceFileSummary[];
  incidents: IncidentSummary[];
  candidates: CandidateSummary[];
  images: ImageArtifactSummary[];
  practiceSets: PracticeSetSummary[];
  fullTests: FullTestSummary[];
  cropImageSources: Record<string, { imageSourceFileId: string; pageNumbers: number[] }>;
  setRows: ExtractedTestRow[];
  /** Active content sources (AI Import "Source": what the batch promotes is saved under it). */
  sources?: { id: string; name: string; forPracticeSets: boolean; forTests: boolean }[];
  counts: {
    ocrPending: number;
    openIncidents: number;
    totalIncidents: number;
    candidates: number;
    reviewCandidates: number;
    reviewItems: number;
    images: number;
  };
};

type WorkflowStep = "Load" | "Process" | "Recover" | "Review" | "Promote";
type OptionRow = { label: string; text: string };
type ImageLinkSummary = {
  id: string;
  imageArtifactId: string;
  targetType: string;
  optionLabel: string | null;
  sortOrder: number;
  image?: ImageArtifactSummary | null;
};

function formatBytes(bytes: number) {
  return `${Math.round(bytes / 1024 / 1024)} MB`;
}

function badgeVariant(status: string): BadgeVariant {
  if (["COMPLETED", "READY", "REVIEWED", "PROMOTED", "RESOLVED"].includes(status)) return "success";
  if (["FAILED", "ERROR", "REJECTED"].includes(status)) return "danger";
  if (["NEEDS_REVIEW", "NEEDS_OCR", "WARNING", "OPEN"].includes(status)) return "warning";
  if (["PROCESSING", "SCANNING", "EDITING"].includes(status)) return "info";
  return "default";
}

function parseOptions(value: string | null): OptionRow[] {
  if (!value) return ["A", "B", "C", "D"].map((label) => ({ label, text: "" }));
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) {
      const rows = parsed.map((item, index) => ({
        label: String(item?.label ?? String.fromCharCode(65 + index)).toUpperCase(),
        text: String(item?.text ?? ""),
      }));
      return rows.length ? rows : ["A", "B", "C", "D"].map((label) => ({ label, text: "" }));
    }
  } catch {
    return ["A", "B", "C", "D"].map((label) => ({ label, text: label === "A" ? value : "" }));
  }
  return ["A", "B", "C", "D"].map((label) => ({ label, text: "" }));
}

function optionsToJson(options: OptionRow[]) {
  return JSON.stringify(options.filter((option) => option.label || option.text).map((option) => ({
    label: option.label.toUpperCase(),
    text: option.text,
  })));
}

// Signature of the persisted-relevant content of a candidate. Used to detect
// unsaved edits: the on-screen draft is never auto-persisted — only Save (PATCH)
// writes to the DB — so we compare this signature against the last saved one.
function candidateContentSignature(draft: CandidateSummary | null, optionsJson: string) {
  if (!draft) return "";
  return JSON.stringify({
    stem: draft.stem ?? "",
    stimulus: draft.stimulus ?? "",
    options: optionsJson,
    correctAnswer: draft.correctAnswer ?? "",
    explanation: draft.explanation ?? "",
    section: draft.section ?? "",
    domainName: draft.domainName ?? "",
    topicName: draft.topicName ?? "",
    subskillName: draft.subskillName ?? "",
    difficulty: draft.difficulty ?? "",
    type: draft.type ?? "",
  });
}

function matches(value: string | null | undefined, query: string) {
  if (!query) return true;
  return (value ?? "").toLowerCase().includes(query.toLowerCase());
}

function candidateHaystack(candidate: CandidateSummary, file?: SourceFileSummary) {
  return [
    candidate.questionExternalId,
    candidate.stem,
    candidate.stimulus,
    candidate.correctAnswer,
    candidate.topicName,
    candidate.difficulty,
    candidate.section,
    file?.relativePath,
  ].filter(Boolean).join(" ");
}

function imageSrc(image: Pick<ImageArtifactSummary, "fileUrl" | "base64Data" | "mimeType">) {
  if (image.fileUrl) return image.fileUrl;
  if (!image.base64Data) return null;
  if (image.base64Data.startsWith("data:")) return image.base64Data;
  return `data:${image.mimeType || "image/jpeg"};base64,${image.base64Data}`;
}

function stripMarkdownImageRefs(value: string | null | undefined) {
  return stripIngestImagePlaceholders(value);
}

function targetLabel(value: string) {
  return targetTypes.find((target) => target.value === value)?.label ?? value;
}

export function AiImportWorkflowClient({
  selectedBatchId,
  selectedBatchStatus,
  batches,
  files,
  incidents,
  candidates,
  images,
  practiceSets,
  fullTests,
  cropImageSources,
  setRows,
  sources = [],
  counts,
}: AiImportWorkflowProps) {
  const router = useRouter();
  const [openStep, setOpenStep] = useState<WorkflowStep | null>(null);
  const [fileQuery, setFileQuery] = useState("");
  const [fileType, setFileType] = useState("ALL");
  const [fileStatus, setFileStatus] = useState("ALL");
  const [incidentQuery, setIncidentQuery] = useState("");
  const [incidentStatus, setIncidentStatus] = useState("OPEN");
  const [candidateQuery, setCandidateQuery] = useState("");
  const [candidateStatus, setCandidateStatus] = useState("ALL");
  const [selectedCandidateId, setSelectedCandidateId] = useState(candidates[0]?.id ?? "");
  const [selectedExtractedTestKey, setSelectedExtractedTestKey] = useState<string>(
    () => setRows.find((row) => candidates[0]?.sourceFileId && row.fileIds.includes(candidates[0].sourceFileId))?.key ?? "",
  );
  const [draft, setDraft] = useState<CandidateSummary | null>(candidates[0] ?? null);
  const [optionRows, setOptionRows] = useState<OptionRow[]>(parseOptions(candidates[0]?.optionsJson ?? null));
  const [savedSignature, setSavedSignature] = useState<string>(() =>
    candidateContentSignature(candidates[0] ?? null, optionsToJson(parseOptions(candidates[0]?.optionsJson ?? null))),
  );
  const [imageLinks, setImageLinks] = useState<ImageLinkSummary[]>([]);
  const [targetType, setTargetType] = useState("STEM");
  const [optionLabel, setOptionLabel] = useState("A");
  const [saving, setSaving] = useState(false);
  const [parsingImageId, setParsingImageId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [selectedCandidateIds, setSelectedCandidateIds] = useState<Set<string>>(new Set());

  const fileById = useMemo(() => new Map(files.map((file) => [file.id, file])), [files]);
  const processBlocked = selectedBatchStatus === "PROCESSING" || selectedBatchStatus === "SCANNING";

  useEffect(() => {
    if (!selectedCandidateId) return;
    fetch(`/api/admin/ai-import/candidates/${selectedCandidateId}/image-links`)
      .then((response) => response.ok ? response.json() : [])
      .then((data) => setImageLinks(Array.isArray(data) ? data : []))
      .catch(() => setImageLinks([]));
  }, [selectedCandidateId]);

  const filteredFiles = files.filter((file) => {
    const haystack = [file.relativePath, file.contentType, file.sourceKind, file.section, file.domainName, file.topicName, file.difficulty, file.testNumber ? `test ${file.testNumber}` : null].filter(Boolean).join(" ");
    return matches(haystack, fileQuery)
      && (fileType === "ALL" || file.contentType === fileType || file.sourceKind === fileType)
      && (fileStatus === "ALL" || file.status === fileStatus);
  });

  const filteredIncidents = incidents.filter((incident) => {
    const source = incident.sourceFileId ? fileById.get(incident.sourceFileId) : null;
    const haystack = [incident.code, incident.message, incident.severity, incident.status, incident.decision, incident.action, source?.relativePath].filter(Boolean).join(" ");
    return matches(haystack, incidentQuery)
      && (incidentStatus === "ALL" || (incidentStatus === "OPEN" ? incident.status !== "RESOLVED" : incident.status === incidentStatus));
  });

  const filteredCandidates = candidates.filter((candidate) => {
    const source = candidate.sourceFileId ? fileById.get(candidate.sourceFileId) : undefined;
    return matches(candidateHaystack(candidate, source), candidateQuery)
      && (candidateStatus === "ALL" || candidate.status === candidateStatus || candidate.promotionStatus === candidateStatus);
  });
  const promotableFilteredCandidates = filteredCandidates.filter((candidate) =>
    ["READY", "REVIEWED"].includes(candidate.status)
    && candidate.promotionStatus !== "PROMOTED"
    && Boolean(candidate.stem)
    && Boolean(candidate.correctAnswer)
  );
  // The Review modal lists questions for the Extracted Test selected in the rail.
  // An Extracted Test spans several files (question + answer + explanations), so match
  // against all of its file ids. Bulk promotion below stays batch-wide.
  const selectedExtractedTest = useMemo(
    () => setRows.find((row) => row.key === selectedExtractedTestKey) ?? null,
    [setRows, selectedExtractedTestKey],
  );
  const visibleCandidates = selectedExtractedTest
    ? filteredCandidates.filter((candidate) => candidate.sourceFileId && selectedExtractedTest.fileIds.includes(candidate.sourceFileId))
    : filteredCandidates;

  const nearbyImages = images.filter((image) => {
    if (!draft) return false;
    return image.sourceFileId === draft.sourceFileId && (!draft.pageArtifactId || image.pageArtifactId === draft.pageArtifactId || image.pageNumber === imageLinks.find((link) => link.imageArtifactId === image.id)?.image?.pageNumber);
  });
  const fileImages = draft?.sourceFileId ? images.filter((image) => image.sourceFileId === draft.sourceFileId && !nearbyImages.some((nearby) => nearby.id === image.id)) : [];
  const shownImages = [...nearbyImages, ...fileImages].slice(0, 80);
  const linkedImageIds = new Set(imageLinks.map((link) => link.imageArtifactId));

  function selectCandidate(candidate: CandidateSummary) {
    setSelectedCandidateId(candidate.id);
    setDraft(candidate);
    const rows = parseOptions(candidate.optionsJson);
    setOptionRows(rows);
    setSavedSignature(candidateContentSignature(candidate, optionsToJson(rows)));
    setMessage(null);
  }

  function selectExtractedTest(row: ExtractedTestRow) {
    setSelectedExtractedTestKey(row.key);
    // Jump the editor to the first question of the chosen Extracted Test (any of its files).
    const first = candidates.find((candidate) => candidate.sourceFileId && row.fileIds.includes(candidate.sourceFileId));
    if (first) selectCandidate(first);
  }

  function toggleCandidate(candidateId: string, checked: boolean) {
    setSelectedCandidateIds((current) => {
      const next = new Set(current);
      if (checked) next.add(candidateId);
      else next.delete(candidateId);
      return next;
    });
  }

  function selectVisiblePromotable() {
    setSelectedCandidateIds(new Set(promotableFilteredCandidates.map((candidate) => candidate.id)));
  }

  function clearSelectedCandidates() {
    setSelectedCandidateIds(new Set());
  }

  const steps: Array<{
    label: WorkflowStep;
    description: string;
    enabled: boolean;
    /** Shown when the step is not available yet. */
    blockedReason?: string;
    count?: number;
    icon: typeof UploadCloud;
  }> = [
    { label: "Load", description: "Batches and ZIP/folder load", enabled: true, count: batches.length, icon: UploadCloud },
    { label: "Process", description: "Extract text, answers and images", enabled: Boolean(selectedBatchId) && !processBlocked, blockedReason: !selectedBatchId ? "Select or load a batch first." : "The batch is being processed; wait until it finishes.", count: files.length, icon: FileArchive },
    { label: "Recover", description: "Retry OCR and failed work", enabled: Boolean(selectedBatchId) && (counts.ocrPending > 0 || counts.openIncidents > 0), blockedReason: !selectedBatchId ? "Select or load a batch first." : "Nothing to recover: no pending OCR or open incidents.", count: counts.ocrPending + counts.openIncidents, icon: RefreshCcw },
    { label: "Review", description: "Files, incidents and questions", enabled: Boolean(selectedBatchId) && (files.length > 0 || counts.candidates > 0 || counts.totalIncidents > 0), blockedReason: !selectedBatchId ? "Select or load a batch first." : "Process the batch first; there is nothing to review yet.", count: counts.reviewItems, icon: FileSearch },
    { label: "Promote", description: "Create drafts from reviewed content", enabled: Boolean(selectedBatchId) && counts.candidates > 0, blockedReason: !selectedBatchId ? "Select or load a batch first." : "No reviewed questions to promote yet.", count: practiceSets.length, icon: CheckCircle2 },
  ];

  async function saveDraft(status?: string) {
    if (!draft) return;
    setSaving(true);
    setMessage(null);
    const response = await fetch(`/api/admin/ai-import/candidates/${draft.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status,
        stem: draft.stem,
        stimulus: draft.stimulus,
        optionsJson: optionsToJson(optionRows),
        correctAnswer: draft.correctAnswer,
        explanation: draft.explanation,
        section: draft.section,
        domainName: draft.domainName,
        topicName: draft.topicName,
        subskillName: draft.subskillName,
        difficulty: draft.difficulty,
        type: draft.type,
      }),
    });
    setSaving(false);
    if (!response.ok) {
      setMessage(errorMessage(await readApiError(response, "Could not save question.")));
      return;
    }
    const data = await response.json();
    setDraft(data);
    setSavedSignature(candidateContentSignature(data, optionsToJson(optionRows)));
    setMessage(status ? `Question marked ${status}.` : "Question saved.");
    router.refresh();
  }

  async function linkImage(imageArtifactId: string) {
    if (!draft) return;
    const response = await fetch(`/api/admin/ai-import/candidates/${draft.id}/image-links`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imageArtifactId, targetType, optionLabel: targetType === "OPTION" ? optionLabel : null }),
    });
    if (response.ok) {
      const refreshed = await fetch(`/api/admin/ai-import/candidates/${draft.id}/image-links`).then((res) => res.json()).catch(() => []);
      setImageLinks(Array.isArray(refreshed) ? refreshed : []);
    }
  }

  async function unlinkImage(linkId: string) {
    if (!draft) return;
    await fetch(`/api/admin/ai-import/candidates/${draft.id}/image-links?linkId=${linkId}`, { method: "DELETE" });
    setImageLinks((current) => current.filter((link) => link.id !== linkId));
  }

  async function refreshImageLinks() {
    if (!selectedCandidateId) return;
    const refreshed = await fetch(`/api/admin/ai-import/candidates/${selectedCandidateId}/image-links`)
      .then((response) => (response.ok ? response.json() : []))
      .catch(() => []);
    setImageLinks(Array.isArray(refreshed) ? refreshed : []);
  }

  async function parseOptionImage(imageArtifactId: string) {
    if (!draft) return;
    setParsingImageId(imageArtifactId);
    setMessage(null);
    const response = await fetch(`/api/admin/ai-import/candidates/${draft.id}/parse-option-image`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imageArtifactId }),
    });
    setParsingImageId(null);
    if (!response.ok) {
      setMessage(errorMessage(await readApiError(response, "Could not parse A-D options from this image.")));
      return;
    }
    const data = await response.json();
    if (!Array.isArray(data.options) || data.options.length !== 4) {
      setMessage(data.warning || "Could not parse A-D options from this image.");
      return;
    }
    setOptionRows(data.options);
    setDraft({ ...draft, type: "MC", optionsJson: optionsToJson(data.options), status: data.status ?? draft.status });
    setMessage("Options parsed from image.");
    router.refresh();
  }

  return (
    <>
      <div className="grid gap-3 md:grid-cols-5">
        {steps.map((step) => {
          const Icon = step.icon;
          const card = (
            <button
              key={step.label}
              type="button"
              onClick={() => step.enabled && setOpenStep(step.label)}
              disabled={!step.enabled}
              aria-describedby={!step.enabled && step.blockedReason ? `step-blocked-${step.label}` : undefined}
              className={`group min-h-28 rounded-lg border border-gray-200 bg-white p-4 text-left shadow-sm transition hover:border-blue-300 hover:bg-blue-50 ${BLOCKED_SURFACE}`}
            >
              <div className="flex items-start justify-between gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-md bg-gray-100 text-gray-700 group-disabled:text-gray-400">
                  <Icon className="h-4 w-4" />
                </span>
                {step.count !== undefined && <Badge variant={step.enabled ? "info" : "default"}>{step.count}</Badge>}
              </div>
              <p className="mt-3 text-sm font-semibold text-gray-900 group-disabled:text-gray-400">{step.label}</p>
              <p className="mt-1 line-clamp-2 text-xs text-gray-500 group-disabled:text-gray-400">{step.description}</p>
            </button>
          );
          return !step.enabled && step.blockedReason ? (
            <DisabledReason key={step.label} reason={step.blockedReason} id={`step-blocked-${step.label}`} fullWidth>
              {card}
            </DisabledReason>
          ) : (
            card
          );
        })}
      </div>

      <Dialog open={openStep === "Load"} onOpenChange={(open) => !open && setOpenStep(null)}>
        <DialogContent className="max-h-[90vh] max-w-5xl overflow-auto">
          <DialogHeader>
            <DialogTitle>Load Sources</DialogTitle>
            <DialogDescription>Create a staging batch from the server folder or upload a ZIP package.</DialogDescription>
          </DialogHeader>
          <AiImportActions selectedBatchId={selectedBatchId} sources={sources} />
          <div className="rounded-md border border-gray-200">
            <div className="border-b border-gray-100 px-4 py-3 text-sm font-semibold text-gray-900">Batch selector</div>
            <div className="max-h-72 divide-y divide-gray-100 overflow-auto">
              {batches.map((batch) => (
                <div key={batch.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                  <div className="min-w-0">
                    <CopyableTruncatedText value={batch.name} className="max-w-full font-medium text-gray-900" />
                    <p className="mt-1 text-xs text-gray-500">{batch.filesProcessed}/{batch.totalFiles} files · {new Date(batch.createdAt).toLocaleString()}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={badgeVariant(batch.status)}>{batch.status}</Badge>
                    <Link href={`/admin/import/ai?batch=${batch.id}`} className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50">
                      Open
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={openStep === "Process"} onOpenChange={(open) => !open && setOpenStep(null)}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-auto">
          <DialogHeader>
            <DialogTitle>Process Batch</DialogTitle>
            <DialogDescription>Run extraction for the selected batch and monitor the result from the dashboard.</DialogDescription>
          </DialogHeader>
          <AiImportActions selectedBatchId={selectedBatchId} sources={sources} />
        </DialogContent>
      </Dialog>

      <Dialog open={openStep === "Recover"} onOpenChange={(open) => !open && setOpenStep(null)}>
        <DialogContent className="max-h-[90vh] max-w-5xl overflow-auto">
          <DialogHeader>
            <DialogTitle>Recover Processing</DialogTitle>
            <DialogDescription>Retry OCR or review open incidents before promoting drafts.</DialogDescription>
          </DialogHeader>
          {selectedBatchId && <RetryFailedJobsButton batchId={selectedBatchId} pendingCount={counts.ocrPending} />}
          <FilterBar query={incidentQuery} setQuery={setIncidentQuery} status={incidentStatus} setStatus={setIncidentStatus} statusOptions={["OPEN", "RESOLVED", "ALL"]} placeholder="Search incident, file or decision" />
          <IncidentList incidents={filteredIncidents} files={fileById} batchId={selectedBatchId} />
        </DialogContent>
      </Dialog>

      <Dialog open={openStep === "Review"} onOpenChange={(open) => !open && setOpenStep(null)}>
        <DialogContent className="max-h-[92vh] max-w-[100rem] overflow-auto">
          <DialogHeader>
            <DialogTitle>Review Staging Content</DialogTitle>
            <DialogDescription>Choose an Extracted Test, review its questions, and edit them before promoting to official content.</DialogDescription>
          </DialogHeader>
          <div className={`grid gap-4 ${selectedBatchId && setRows.length > 0 ? "xl:grid-cols-[240px_320px_minmax(0,1fr)]" : "xl:grid-cols-[360px_minmax(0,1fr)]"}`}>
            {selectedBatchId && setRows.length > 0 && (
              <ExtractedTestRail rows={setRows} batchId={selectedBatchId} currentFileId={draft?.sourceFileId ?? ""} onSelect={selectExtractedTest} />
            )}
            <div className="space-y-4">
              <section className="rounded-md border border-gray-200">
                <div className="border-b border-gray-100 p-3">
                  <p className="text-sm font-semibold text-gray-900">Questions in this Extracted Test</p>
                  {selectedExtractedTest && (
                    <p className="mt-0.5 truncate text-xs text-gray-500" title={selectedExtractedTest.title}>
                      {selectedExtractedTest.title}
                    </p>
                  )}
                  <FilterBar query={candidateQuery} setQuery={setCandidateQuery} status={candidateStatus} setStatus={setCandidateStatus} statusOptions={["ALL", "NEEDS_REVIEW", "READY", "REVIEWED", "REJECTED", "PROMOTED", "EDITING"]} placeholder="Search question, topic or file" />
                </div>
                <div className="max-h-[560px] divide-y divide-gray-100 overflow-auto">
                  {visibleCandidates.map((candidate) => (
                    <div
                      key={candidate.id}
                      className={`p-3 text-sm ${candidate.id === selectedCandidateId ? "bg-blue-50" : ""}`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex min-w-0 items-center gap-2">
                          <Checkbox
                            checked={selectedCandidateIds.has(candidate.id)}
                            onChange={(event) => toggleCandidate(candidate.id, event.target.checked)}
                            disabled={!["READY", "REVIEWED"].includes(candidate.status) || candidate.promotionStatus === "PROMOTED"}
                            className="h-4 w-4 rounded border-gray-300"
                          />
                          <button
                            type="button"
                            onClick={() => selectCandidate(candidate)}
                            className="min-w-0 text-left font-medium text-gray-900 hover:text-blue-700"
                          >
                            {qLabel(candidate.moduleLabel, candidate.questionNumber)}
                          </button>
                        </div>
                        <div className="flex gap-1">
                          <Badge variant={badgeVariant(candidate.status)}>{candidate.status}</Badge>
                          {candidate.promotionStatus === "PROMOTED" && <Badge variant="success">Official</Badge>}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => selectCandidate(candidate)}
                        className="mt-1 block w-full text-left"
                      >
                        <MathContent
                          content={stripMarkdownImageRefs(candidate.stem || candidate.explanation) || "No stem detected."}
                          className="line-clamp-2 text-xs text-gray-600"
                        />
                      </button>
                      <CopyableTruncatedText value={candidate.sourceFileId ? fileById.get(candidate.sourceFileId)?.relativePath : ""} fallback="No source" className="mt-1 max-w-full text-xs text-gray-400" />
                    </div>
                  ))}
                  {visibleCandidates.length === 0 && <p className="p-6 text-center text-sm text-gray-400">No questions in this Extracted Test for the current filter.</p>}
                </div>
              </section>
            </div>
            <QuestionStagingEditor
              draft={draft}
              setDraft={setDraft}
              optionRows={optionRows}
              setOptionRows={setOptionRows}
              images={shownImages}
              imageLinks={imageLinks}
              linkedImageIds={linkedImageIds}
              targetType={targetType}
              setTargetType={setTargetType}
              optionLabel={optionLabel}
              setOptionLabel={setOptionLabel}
              saveDraft={saveDraft}
              linkImage={linkImage}
              unlinkImage={unlinkImage}
              parseOptionImage={parseOptionImage}
              parsingImageId={parsingImageId}
              saving={saving}
              message={message}
              dirty={candidateContentSignature(draft, optionsToJson(optionRows)) !== savedSignature}
              onCropAssigned={refreshImageLinks}
              cropImageSource={draft?.sourceFileId ? cropImageSources[draft.sourceFileId] ?? null : null}
            />
          </div>
          <BulkPromoteQuestionsBar
            batchId={selectedBatchId}
            selectedCandidateIds={[...selectedCandidateIds]}
            visiblePromotableCount={promotableFilteredCandidates.length}
            onSelectVisible={selectVisiblePromotable}
            onClear={clearSelectedCandidates}
          />
          <div className="grid gap-4 lg:grid-cols-2">
            <section className="rounded-md border border-gray-200 p-3">
              <p className="mb-3 text-sm font-semibold text-gray-900">Source Files</p>
              <FileFilters query={fileQuery} setQuery={setFileQuery} fileType={fileType} setFileType={setFileType} fileStatus={fileStatus} setFileStatus={setFileStatus} />
              <FileList files={filteredFiles} batchId={selectedBatchId} />
            </section>
            <section className="rounded-md border border-gray-200 p-3">
              <p className="mb-3 text-sm font-semibold text-gray-900">Incidents</p>
              <FilterBar query={incidentQuery} setQuery={setIncidentQuery} status={incidentStatus} setStatus={setIncidentStatus} statusOptions={["OPEN", "RESOLVED", "ALL"]} placeholder="Search incident, file or decision" />
              <IncidentList incidents={filteredIncidents} files={fileById} batchId={selectedBatchId} />
            </section>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={openStep === "Promote"} onOpenChange={(open) => !open && setOpenStep(null)}>
        <DialogContent className="max-h-[90vh] max-w-6xl overflow-auto">
          <DialogHeader>
            <DialogTitle>Promote Reviewed Content</DialogTitle>
            <DialogDescription>Create draft Practice Sets or Tests only after staging review is clean.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-gray-200 p-4">
            <div>
              <p className="text-sm font-semibold text-gray-900">Tests (full-length SAT)</p>
              <p className="text-xs text-gray-500">
                {fullTests.length} tests · staging review uses 2 Extracted Tests (R&amp;W + Math); promote assembles 4 groups
                (RW M1/M2 · Math M1/M2) with timers 32/32/35/35 and section scores.
              </p>
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {fullTests.map((test) => (
              <div key={test.testNumber} className="rounded-md border border-gray-200 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">Test {test.testNumber}</p>
                    <p className="mt-1 text-xs text-gray-500">
                      {test.promoted}/{test.total} official · 2 Extracted Tests → 4 SAT groups
                    </p>
                    <p className="mt-0.5 text-[11px] text-gray-400">M1 = EASY · M2 = HARD (skill M1/M2)</p>
                  </div>
                  <Badge variant={test.artifactId ? "success" : test.promoted > 0 ? "warning" : "default"}>
                    {test.artifactId ? "Draft Created" : test.promoted > 0 ? "Ready Draft" : "No Official"}
                  </Badge>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  {[
                    { label: "RW M1", hint: "32 min · EASY" },
                    { label: "RW M2", hint: "32 min · HARD" },
                    { label: "Math M1", hint: "35 min · EASY" },
                    { label: "Math M2", hint: "35 min · HARD" },
                  ].map((item, index) => (
                    <div key={item.label}>
                      <MiniStat
                        label={item.label}
                        value={`${test.modulePromoted[index] ?? 0}/${test.moduleCounts[index] ?? 0}`}
                        warning={(test.missingByModule[index] ?? 0) > 0}
                      />
                      <p className="mt-0.5 text-center text-[10px] text-gray-400">{item.hint}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  {selectedBatchId && test.promotableCandidateIds.length > 0 && (
                    <PromoteQuestionIdsButton
                      batchId={selectedBatchId}
                      candidateIds={test.promotableCandidateIds}
                      label={`Promote ready (${test.promotableCandidateIds.length})`}
                    />
                  )}
                  {test.artifactId ? (
                    <Link href="/teacher/tests" className="rounded-md border border-green-200 px-3 py-2 text-xs font-medium text-green-700 hover:bg-green-50">
                      Open Draft Test
                    </Link>
                  ) : test.promoted > 0 && selectedBatchId ? (
                    <PromoteFullTestButton batchId={selectedBatchId} testNumber={test.testNumber} partial={test.partial} />
                  ) : (
                    <p className="text-xs text-amber-700">Promote reviewed questions first.</p>
                  )}
                </div>
              </div>
            ))}
            {fullTests.length === 0 && <p className="col-span-full py-8 text-center text-sm text-gray-400">No Tests detected in this batch.</p>}
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {practiceSets.map((set) => {
              return (
                <div key={set.sourceFileId} className="rounded-md border border-gray-200 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <CopyableTruncatedText value={set.title} className="max-w-full text-sm font-semibold text-gray-900" />
                      <CopyableTruncatedText value={set.relativePath} className="mt-1 max-w-full text-xs text-gray-500" />
                    </div>
                    <Badge variant={set.stateVariant}>{set.stateLabel}</Badge>
                  </div>
                  <div className="mt-3 grid grid-cols-4 gap-2 text-center text-xs">
                    <MiniStat label="Questions" value={set.candidates} />
                    <MiniStat label="Ready" value={set.ready} />
                    <MiniStat label="Official" value={set.promoted} />
                    <MiniStat label="Missing" value={set.missingAnswer} warning={set.missingAnswer > 0} />
                  </div>
                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    {selectedBatchId && set.promotableCandidateIds.length > 0 && (
                      <PromoteQuestionIdsButton
                        batchId={selectedBatchId}
                        candidateIds={set.promotableCandidateIds}
                        label={`Promote ready (${set.promotableCandidateIds.length})`}
                      />
                    )}
                    {set.artifactId ? (
                      <Link href={`/teacher/practice-sets/${set.artifactId}/edit`} className="rounded-md border border-green-200 px-3 py-2 text-xs font-medium text-green-700 hover:bg-green-50">
                        Open Draft Set
                      </Link>
                    ) : selectedBatchId && set.promoted > 0 ? (
                      <PromotePracticeSetButton batchId={selectedBatchId} sourceFileId={set.sourceFileId} partial={set.promoted < set.candidates} />
                    ) : (
                      <p className="text-xs text-amber-700">Needs reviewed, promoted questions with answers.</p>
                    )}
                    {selectedBatchId && (
                      <Link href={`/admin/import/ai/${selectedBatchId}/files/${set.sourceFileId}`} className="text-xs text-blue-700 hover:underline">
                        Review file
                      </Link>
                    )}
                  </div>
                </div>
              );
            })}
            {practiceSets.length === 0 && <p className="col-span-full py-10 text-center text-sm text-gray-400">No Practice Sets detected in this batch.</p>}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function BulkPromoteQuestionsBar({
  batchId,
  selectedCandidateIds,
  visiblePromotableCount,
  onSelectVisible,
  onClear,
}: {
  batchId?: string;
  selectedCandidateIds: string[];
  visiblePromotableCount: number;
  onSelectVisible: () => void;
  onClear: () => void;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function promoteSelected() {
    if (!batchId || selectedCandidateIds.length === 0) return;
    setLoading(true);
    setMessage(null);
    const response = await fetch(`/api/admin/ai-import/batches/${batchId}/promote-questions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ candidateIds: selectedCandidateIds }),
    });
    setLoading(false);
    if (!response.ok) {
      setMessage(errorMessage(await readApiError(response, "Could not promote selected questions.")));
      return;
    }
    const data = await response.json();
    setMessage(`Promoted ${data.promoted ?? 0}; skipped ${data.skipped ?? 0}; errors ${(data.errors ?? []).length}.`);
    onClear();
    router.refresh();
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-blue-100 bg-blue-50 p-3">
      <div>
        <p className="text-sm font-semibold text-gray-900">Question promotion</p>
        <p className="text-xs text-gray-600">{selectedCandidateIds.length} selected · {visiblePromotableCount} promotable in current filter.</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="secondary" size="sm" onClick={onSelectVisible} disabledReason={visiblePromotableCount === 0 ? "No promotable questions in this view." : null}>
          Select filtered ready
        </Button>
        <Button type="button" variant="secondary" size="sm" onClick={onClear} disabledReason={selectedCandidateIds.length === 0 ? "Select at least one question." : null}>
          Clear
        </Button>
        <Button type="button" size="sm" onClick={promoteSelected} disabled={loading} disabledReason={!batchId ? "Select a batch first." : selectedCandidateIds.length === 0 ? "Select at least one question." : null}>
          {loading ? "Promoting..." : "Promote selected"}
        </Button>
        {message && <span className="text-xs text-gray-600">{message}</span>}
      </div>
    </div>
  );
}

function PromoteQuestionIdsButton({ batchId, candidateIds, label }: { batchId: string; candidateIds: string[]; label: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function promote() {
    setLoading(true);
    setMessage(null);
    const response = await fetch(`/api/admin/ai-import/batches/${batchId}/promote-questions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ candidateIds }),
    });
    setLoading(false);
    if (!response.ok) {
      setMessage(errorMessage(await readApiError(response, "Could not promote questions.")));
      return;
    }
    const data = await response.json();
    setMessage(`Promoted ${data.promoted ?? 0}.`);
    router.refresh();
  }

  return (
    <div className="space-y-1">
      <Button type="button" variant="secondary" size="sm" onClick={promote} disabled={loading} disabledReason={candidateIds.length === 0 ? "No questions to promote in this set." : null}>
        {loading ? "Promoting..." : label}
      </Button>
      {message && <p className="max-w-44 text-xs text-gray-500">{message}</p>}
    </div>
  );
}

function FilterBar({
  query,
  setQuery,
  status,
  setStatus,
  statusOptions,
  placeholder,
}: {
  query: string;
  setQuery: (value: string) => void;
  status: string;
  setStatus: (value: string) => void;
  statusOptions: string[];
  placeholder: string;
}) {
  return (
    <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_160px]">
      <label className="relative block">
        <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
        <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={placeholder} className="pl-9" />
      </label>
      <select value={status} onChange={(event) => setStatus(event.target.value)} className="rounded-md border border-gray-300 px-3 py-2 text-sm">
        {statusOptions.map((option) => <option key={option} value={option}>{option}</option>)}
      </select>
    </div>
  );
}

function FileFilters({
  query,
  setQuery,
  fileType,
  setFileType,
  fileStatus,
  setFileStatus,
}: {
  query: string;
  setQuery: (value: string) => void;
  fileType: string;
  setFileType: (value: string) => void;
  fileStatus: string;
  setFileStatus: (value: string) => void;
}) {
  return (
    <div className="grid gap-2 md:grid-cols-[1fr_170px_140px]">
      <label className="relative block">
        <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
        <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search file, topic, path or test" className="pl-9" />
      </label>
      <select value={fileType} onChange={(event) => setFileType(event.target.value)} className="rounded-md border border-gray-300 px-3 py-2 text-sm">
        <option value="ALL">All types</option>
        <option value="PRACTICE_SET">Practice Sets</option>
        <option value="FULL_PRACTICE_TEST">Full Tests</option>
        <option value="PRACTICE_EXERCISE">Practice folders</option>
        <option value="MOCK_EXAM">Mock exams</option>
      </select>
      <select value={fileStatus} onChange={(event) => setFileStatus(event.target.value)} className="rounded-md border border-gray-300 px-3 py-2 text-sm">
        <option value="ALL">All status</option>
        <option value="PENDING">PENDING</option>
        <option value="PROCESSING">PROCESSING</option>
        <option value="COMPLETED">COMPLETED</option>
        <option value="FAILED">FAILED</option>
      </select>
    </div>
  );
}

function FileList({ files, batchId }: { files: SourceFileSummary[]; batchId?: string }) {
  return (
    <div className="mt-3 max-h-80 divide-y divide-gray-100 overflow-auto rounded-md border border-gray-100">
      {files.map((file) => (
        <div key={file.id} className="grid gap-2 p-3 text-xs md:grid-cols-[1fr_auto]">
          <div className="min-w-0">
            <CopyableTruncatedText value={file.relativePath} className="max-w-full font-medium text-gray-900" />
            <CopyableTruncatedText value={[file.contentType, file.sourceKind, file.section, file.domainName, file.topicName, file.difficulty, file.testNumber ? `Test ${file.testNumber}` : null].filter(Boolean).join(" · ")} fallback="No metadata" className="mt-1 max-w-full text-gray-500" />
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={badgeVariant(file.status)}>{file.status}</Badge>
            {batchId && <Link href={`/admin/import/ai/${batchId}/files/${file.id}`} className="text-blue-700 hover:underline">Review</Link>}
          </div>
        </div>
      ))}
      {files.length === 0 && <p className="p-6 text-center text-sm text-gray-400">No matching files.</p>}
    </div>
  );
}

function IncidentList({ incidents, files, batchId }: { incidents: IncidentSummary[]; files: Map<string, SourceFileSummary>; batchId?: string }) {
  return (
    <div className="mt-3 max-h-80 divide-y divide-gray-100 overflow-auto rounded-md border border-gray-100">
      {incidents.map((incident) => {
        const file = incident.sourceFileId ? files.get(incident.sourceFileId) : null;
        return (
          <div key={incident.id} className="grid gap-2 p-3 text-xs md:grid-cols-[150px_1fr_auto]">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={badgeVariant(incident.severity)}>{incident.severity}</Badge>
              <Badge variant={badgeVariant(incident.status)}>{incident.status}</Badge>
            </div>
            <div className="min-w-0">
              <CopyableTruncatedText value={incident.code} className="max-w-full font-medium text-gray-900" />
              <p className="mt-1 line-clamp-2 text-gray-600">{incident.message}</p>
              <CopyableTruncatedText value={file?.relativePath} fallback="Batch-level incident" className="mt-1 max-w-full text-gray-400" />
            </div>
            {batchId && file && <Link href={`/admin/import/ai/${batchId}/files/${file.id}`} className="text-blue-700 hover:underline">Review</Link>}
          </div>
        );
      })}
      {incidents.length === 0 && <p className="p-6 text-center text-sm text-gray-400">No matching incidents.</p>}
    </div>
  );
}

function QuestionStagingEditor({
  draft,
  setDraft,
  optionRows,
  setOptionRows,
  images,
  imageLinks,
  linkedImageIds,
  targetType,
  setTargetType,
  optionLabel,
  setOptionLabel,
  saveDraft,
  linkImage,
  unlinkImage,
  parseOptionImage,
  parsingImageId,
  saving,
  message,
  dirty,
  onCropAssigned,
  cropImageSource,
}: {
  draft: CandidateSummary | null;
  setDraft: (draft: CandidateSummary) => void;
  optionRows: OptionRow[];
  setOptionRows: (rows: OptionRow[]) => void;
  images: ImageArtifactSummary[];
  imageLinks: ImageLinkSummary[];
  linkedImageIds: Set<string>;
  targetType: string;
  setTargetType: (value: string) => void;
  optionLabel: string;
  setOptionLabel: (value: string) => void;
  saveDraft: (status?: string) => void;
  linkImage: (imageArtifactId: string) => void;
  unlinkImage: (linkId: string) => void;
  parseOptionImage: (imageArtifactId: string) => void;
  parsingImageId: string | null;
  saving: boolean;
  message: string | null;
  dirty: boolean;
  onCropAssigned: () => void;
  cropImageSource: { imageSourceFileId: string; pageNumbers: number[] } | null;
}) {
  if (!draft) {
    return <div className="rounded-md border border-gray-200 p-8 text-center text-sm text-gray-400">Select a detected question to review.</div>;
  }
  const activeDraft = draft;

  function updateOption(index: number, patch: Partial<OptionRow>) {
    setOptionRows(optionRows.map((row, rowIndex) => rowIndex === index ? { ...row, ...patch } : row));
  }

  function applyCropOcr(target: CropTarget, result: CropOcrResult) {
    const text = (result.text ?? "").trim();
    if (target.targetType === "OPTION_BLOCK" && result.options && result.options.length) {
      // Merge over existing rows so a partial OCR (2–3 of 4) still fills what it found.
      const map = new Map(optionRows.map((row) => [(row.label || "").toUpperCase(), row.text || ""]));
      for (const option of result.options) map.set((option.label || "").toUpperCase(), option.text || "");
      setOptionRows(["A", "B", "C", "D"].map((label) => ({ label, text: map.get(label) ?? "" })));
      setDraft({ ...activeDraft, type: "MC" });
    } else if (target.targetType === "OPTION" && target.optionLabel) {
      const index = optionRows.findIndex((row) => (row.label || "").toUpperCase() === target.optionLabel);
      if (index >= 0) setOptionRows(optionRows.map((row, i) => (i === index ? { ...row, text } : row)));
      else setOptionRows([...optionRows, { label: target.optionLabel, text }]);
      setDraft({ ...activeDraft, type: "MC" });
    } else if (target.targetType === "STEM") {
      setDraft({ ...activeDraft, stem: text });
    } else if (target.targetType === "STIMULUS") {
      setDraft({ ...activeDraft, stimulus: text });
    } else if (target.targetType === "EXPLANATION") {
      setDraft({ ...activeDraft, explanation: text });
    } else if (target.targetType === "ANSWER_FIELD") {
      setDraft({ ...activeDraft, correctAnswer: text });
    }
  }

  return (
    <section className="grid gap-4">
      <div className="rounded-md border border-gray-200 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase text-gray-400">Question Editor</p>
            <h3 className="mt-1 text-base font-semibold text-gray-900">{draft.moduleLabel ? `Module ${draft.moduleLabel} · ` : ""}Question {draft.questionNumber ?? "without number"}</h3>
            <div className="mt-2 flex flex-wrap gap-2">
              <Badge variant={badgeVariant(draft.status)}>{draft.status}</Badge>
              <Badge variant={badgeVariant(draft.promotionStatus)}>{draft.promotionStatus}</Badge>
              <span className="text-xs text-gray-500">{Math.round(draft.confidence * 100)}% confidence</span>
              {dirty && (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-500" /> Unsaved
                </span>
              )}
            </div>
          </div>
          <Link href={`/teacher/questions/new?ingestCandidateId=${draft.id}`} className="rounded-md border border-blue-200 px-3 py-2 text-xs font-medium text-blue-700 hover:bg-blue-50">
            Open official editor
          </Link>
        </div>
        <div className="mt-4 grid gap-3">
          <FormattedTextField
            label="Stem"
            value={stripMarkdownImageRefs(draft.stem)}
            onChange={(stem) => setDraft({ ...draft, stem })}
            rows={5}
            formatPreview={stripMarkdownImageRefs}
          />
          <FormattedTextField
            label="Stimulus"
            value={stripMarkdownImageRefs(draft.stimulus)}
            onChange={(stimulus) => setDraft({ ...draft, stimulus })}
            rows={4}
            formatPreview={stripMarkdownImageRefs}
            collapsible={!draft.stimulus?.trim()}
            collapseLabel="Add stimulus"
          />
          <div className="grid gap-2">
            <p className="text-xs font-medium text-gray-500">Options</p>
            <div className="grid gap-2 rounded-md border border-gray-200 bg-gray-50 p-3">
              {optionRows.map((option, index) => (
                <div key={`${option.label}-${index}-rendered`} className="grid gap-2 rounded border border-gray-100 bg-white p-2 sm:grid-cols-[34px_1fr]">
                  <span className="text-xs font-semibold text-gray-500">{option.label || String.fromCharCode(65 + index)}</span>
                  {option.text ? <MathContent content={option.text} className="text-sm text-gray-800" /> : <span className="text-sm text-gray-400">Empty</span>}
                </div>
              ))}
            </div>
            {optionRows.map((option, index) => (
              <div key={`${option.label}-${index}`} className="grid gap-2 sm:grid-cols-[70px_1fr]">
                <Input value={option.label} onChange={(event) => updateOption(index, { label: event.target.value.toUpperCase() })} />
                <Input value={option.text} onChange={(event) => updateOption(index, { text: event.target.value })} />
              </div>
            ))}
          </div>
          <div className="grid gap-3 md:grid-cols-4">
            <label className="grid gap-1">
              <span className="text-xs font-medium text-gray-500">Answer</span>
              <Input value={draft.correctAnswer ?? ""} onChange={(event) => setDraft({ ...draft, correctAnswer: event.target.value })} />
            </label>
            <label className="grid gap-1">
              <span className="text-xs font-medium text-gray-500">Difficulty</span>
              <Input value={draft.difficulty ?? ""} onChange={(event) => setDraft({ ...draft, difficulty: event.target.value })} />
            </label>
            <label className="grid gap-1">
              <span className="text-xs font-medium text-gray-500">Skill</span>
              <Input value={draft.topicName ?? ""} onChange={(event) => setDraft({ ...draft, topicName: event.target.value })} />
            </label>
            <label className="grid gap-1">
              <span className="text-xs font-medium text-gray-500">Type</span>
              <select value={draft.type} onChange={(event) => setDraft({ ...draft, type: event.target.value })} className="rounded-md border border-gray-300 px-3 py-2 text-sm">
                <option value="MC">MC</option>
                <option value="NUMERIC">NUMERIC</option>
              </select>
            </label>
          </div>
          <FormattedTextField
            label="Explanation"
            value={stripMarkdownImageRefs(draft.explanation)}
            onChange={(explanation) => setDraft({ ...draft, explanation })}
            rows={4}
            formatPreview={stripMarkdownImageRefs}
          />
          <div className={`flex flex-wrap items-center gap-2 rounded-md border p-3 transition-colors ${dirty ? "border-amber-300 bg-amber-50" : "border-gray-200 bg-gray-50"}`}>
            <Button type="button" onClick={() => saveDraft()} disabled={saving} disabledReason={!dirty ? "No changes to save." : null}>
              {saving ? "Saving…" : dirty ? "Save changes" : "Saved"}
            </Button>
            <Button type="button" variant="secondary" onClick={() => saveDraft("REVIEWED")} disabled={saving}>Mark Reviewed</Button>
            <Button type="button" variant="secondary" onClick={() => saveDraft("REJECTED")} disabled={saving}>Reject</Button>
            <span className="text-xs text-gray-600">
              {dirty
                ? "OCR and edits only change the on-screen draft. Click Save to write to the database."
                : "No pending changes."}
            </span>
            {message && <span className="text-xs text-gray-500">· {message}</span>}
          </div>
        </div>
      </div>

      <div className="rounded-md border border-gray-200 p-4">
        <div className="flex flex-wrap items-end gap-2">
          <label className="grid gap-1">
            <span className="text-xs font-medium text-gray-500">Image target</span>
            <select value={targetType} onChange={(event) => setTargetType(event.target.value)} className="rounded-md border border-gray-300 px-3 py-2 text-sm">
              {targetTypes.map((target) => <option key={target.value} value={target.value}>{target.label}</option>)}
            </select>
          </label>
          <label className="grid gap-1">
            <span className="text-xs font-medium text-gray-500">Option</span>
            <Input value={optionLabel} onChange={(event) => setOptionLabel(event.target.value.toUpperCase())} disabled={targetType !== "OPTION"} className="w-24" />
          </label>
          <p className="text-xs text-gray-500">
            Use Options block to OCR for A-D choices. Use Answer field for blank lines or response boxes.
          </p>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {imageLinks.map((link) => (
            <button key={link.id} type="button" onClick={() => unlinkImage(link.id)} className="rounded-md border border-blue-200 bg-blue-50 px-2 py-1 text-xs text-blue-800">
              {targetLabel(link.targetType)}{link.optionLabel ? ` ${link.optionLabel}` : ""} · remove
            </button>
          ))}
          {imageLinks.length === 0 && <span className="text-xs text-gray-400">No images linked yet.</span>}
        </div>
        {imageLinks.length > 0 && (
          <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {imageLinks.map((link) => {
              const src = link.image ? imageSrc(link.image) : null;
              return (
                <div key={`${link.id}-preview`} className="rounded-md border border-blue-100 bg-blue-50 p-2">
                  <div className="mb-2 text-xs font-medium text-blue-900">
                    {targetLabel(link.targetType)}{link.optionLabel ? ` ${link.optionLabel}` : ""} linked image
                  </div>
                  <div className="h-32 overflow-hidden rounded bg-white">
                    {src ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={src} alt={`${link.targetType} linked image`} className="h-full w-full object-contain" />
                    ) : (
                      <div className="flex h-full items-center justify-center text-xs text-gray-400">No preview</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {images.map((image) => (
            <div key={image.id} className={`rounded-md border p-2 ${linkedImageIds.has(image.id) ? "border-blue-300 bg-blue-50" : "border-gray-200"}`}>
              <div className="relative h-36 overflow-hidden rounded bg-gray-100">
                {imageSrc(image) ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={imageSrc(image) ?? ""} alt={`Extracted image page ${image.pageNumber}`} className="h-full w-full object-contain" />
                ) : (
                  <div className="flex h-full items-center justify-center text-xs text-gray-400">No preview</div>
                )}
              </div>
              <div className="mt-2 flex items-center justify-between gap-2">
                <span className="text-xs text-gray-500">p.{image.pageNumber} · {image.origin}</span>
                <div className="flex flex-wrap justify-end gap-2">
                  <Button type="button" size="sm" variant="secondary" onClick={() => linkImage(image.id)}>Link</Button>
                  {targetType === "OPTION_BLOCK" && (
                    <Button type="button" size="sm" variant="secondary" onClick={() => parseOptionImage(image.id)} disabled={parsingImageId === image.id}>
                      {parsingImageId === image.id ? "Parsing..." : "OCR Options"}
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ))}
          {images.length === 0 && <p className="text-sm text-gray-400">No extracted images for this question file.</p>}
        </div>
        {activeDraft.sourceFileId && (
          <PdfPageCropper
            className="mt-4 border-t border-gray-100 pt-4"
            candidateId={activeDraft.id}
            sourceFileId={activeDraft.sourceFileId}
            pageNumbers={images.map((image) => image.pageNumber)}
            imageSourceFileId={cropImageSource?.imageSourceFileId}
            imagePageNumbers={cropImageSource?.pageNumbers}
            onAssigned={onCropAssigned}
            onOcrText={applyCropOcr}
          />
        )}
      </div>
    </section>
  );
}

function MiniStat({ label, value, warning }: { label: string; value: number | string; warning?: boolean }) {
  return (
    <div className="rounded-md bg-gray-50 px-2 py-2">
      <p className={warning ? "font-semibold text-amber-700" : "font-semibold text-gray-900"}>{value}</p>
      <p className="text-gray-500">{label}</p>
    </div>
  );
}

export function AiImportActions({ selectedBatchId, sources = [] }: { selectedBatchId?: string; sources?: AiImportWorkflowProps["sources"] }) {
  const router = useRouter();
  // "" = the default (College Board for Practice Sets, Innovator for Tests).
  const [sourceId, setSourceId] = useState("");
  const [name, setName] = useState("SAT files_to_load ingest");
  const [basePath, setBasePath] = useState("files_to_load");
  const [zipFile, setZipFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function createBatch() {
    setLoading(true);
    setMessage(null);
    const res = await fetch("/api/admin/ai-import/batches", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, basePath, sourceId }),
    });
    setLoading(false);
    if (!res.ok) {
      setMessage(errorMessage(await readApiError(res, "Could not create batch.")));
      return;
    }
    const data = await res.json();
    setMessage(`Batch created with ${data.totalFiles ?? 0} source files. Review the scan before processing.`);
    router.push(`/admin/import/ai?batch=${data.id}`);
    router.refresh();
  }

  async function uploadZip() {
    if (!zipFile) return;
    if (zipFile.size > MAX_UPLOAD_BYTES) {
      setMessage(`The ZIP is ${formatBytes(zipFile.size)}. Maximum upload size is 256 MB.`);
      return;
    }
    setLoading(true);
    setMessage("Uploading ZIP and scanning PDF/DOCX sources...");
    const formData = new FormData();
    formData.set("name", name || zipFile.name.replace(/\.zip$/i, ""));
    formData.set("file", zipFile);
    formData.set("sourceId", sourceId);
    const res = await fetch("/api/admin/ai-import/upload", {
      method: "POST",
      body: formData,
    });
    setLoading(false);
    if (!res.ok) {
      setMessage(errorMessage(await readApiError(res, "Could not upload ZIP.")));
      return;
    }
    const data = await res.json();
    setZipFile(null);
    setMessage(`ZIP scanned into staging: ${data.totalFiles ?? 0} source files detected.`);
    router.push(`/admin/import/ai?batch=${data.id}`);
    router.refresh();
  }

  async function processBatch() {
    if (!selectedBatchId) return;
    setLoading(true);
    setMessage("Processing selected batch. OCR may continue in the background.");
    const res = await fetch(`/api/admin/ai-import/batches/${selectedBatchId}/process`, { method: "POST" });
    setLoading(false);
    if (!res.ok) {
      setMessage(errorMessage(await readApiError(res, "Could not start processing.")));
      return;
    }
    setMessage("Processing started. Refresh this page to see files, incidents and candidates.");
    router.refresh();
  }

  return (
    <div className="space-y-5">
      <label className="grid max-w-md gap-1">
        <span className="text-xs font-medium text-gray-500">Source</span>
        <Select value={sourceId} onChange={(event) => setSourceId(event.target.value)} aria-label="Source">
          <option value="">Default (College Board for Practice Sets, Innovator for Tests)</option>
          {(sources ?? []).map((source) => (
            <option key={source.id} value={source.id}>
              {source.name}
              {source.forPracticeSets && source.forTests ? "" : source.forTests ? " · Tests only" : " · Practice Sets only"}
            </option>
          ))}
        </Select>
        <span className="text-xs text-gray-500">The Practice Sets / Tests this batch creates are saved under this source (when it is used for that kind of content).</span>
      </label>
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-md border border-gray-200 bg-white p-4">
          <div className="mb-3">
            <p className="text-xs font-medium uppercase text-gray-400">Folder Load</p>
            <h2 className="text-sm font-semibold text-gray-900">Scan server folder</h2>
          </div>
          <div className="grid gap-3">
            <label className="grid gap-1">
              <span className="text-xs font-medium text-gray-500">Batch name</span>
              <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="SAT files_to_load ingest" />
            </label>
            <label className="grid gap-1">
              <span className="text-xs font-medium text-gray-500">Base path</span>
              <Input value={basePath} onChange={(event) => setBasePath(event.target.value)} placeholder="files_to_load" />
            </label>
            <div className="flex justify-end">
              <Button onClick={createBatch} disabled={loading} disabledReason={!name ? "Enter a batch name." : !basePath ? "Enter the server folder path." : null}>
                Scan Folder
              </Button>
            </div>
          </div>
        </section>

        <section className="rounded-md border border-dashed border-gray-300 bg-gray-50 p-4">
          <div className="mb-3">
            <p className="text-xs font-medium uppercase text-gray-400">ZIP Load</p>
            <h2 className="text-sm font-semibold text-gray-900">Upload ZIP</h2>
          </div>
          <div className="grid gap-3">
            <label className="block">
              <span className="text-xs font-medium text-gray-500">Source package</span>
              <input
                type="file"
                accept=".zip,application/zip,application/x-zip-compressed"
                className="mt-2 block w-full text-sm text-gray-700 file:mr-3 file:rounded-md file:border-0 file:bg-white file:px-3 file:py-2 file:text-sm file:font-medium file:text-gray-700 disabled:cursor-not-allowed disabled:text-gray-400 disabled:file:bg-gray-100 disabled:file:text-gray-400"
                disabled={loading}
                onChange={(event) => {
                  const file = event.target.files?.[0] ?? null;
                  setZipFile(file);
                  if (file && file.size > MAX_UPLOAD_BYTES) {
                    setMessage(`The ZIP is ${formatBytes(file.size)}. Maximum upload size is 256 MB.`);
                  } else if (file) {
                    setMessage(`Ready to upload ${file.name} (${formatBytes(file.size)}).`);
                  }
                }}
              />
              <span className="mt-1 block text-xs text-gray-500">ZIP files up to 256 MB. PDF and DOCX files go to staging.</span>
            </label>
            <div className="flex justify-end">
              <Button type="button" variant="secondary" onClick={uploadZip} disabled={loading} disabledReason={!zipFile ? "Choose a ZIP file." : zipFile.size > MAX_UPLOAD_BYTES ? "The ZIP exceeds the 256 MB limit." : null}>
                Upload ZIP
              </Button>
            </div>
          </div>
        </section>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-gray-200 bg-white p-4">
        <div>
          <p className="text-xs font-medium uppercase text-gray-400">Processing</p>
          <h2 className="text-sm font-semibold text-gray-900">Process selected batch</h2>
        </div>
        <Button variant="secondary" onClick={processBatch} disabled={loading} disabledReason={!selectedBatchId ? "Select a batch first." : null}>
          Process Selected
        </Button>
      </div>
      {message && <p className="text-sm text-gray-600">{message}</p>}
    </div>
  );
}

export function IngestAutoRefresh({
  batchId,
  enabled,
  intervalMs = 8000,
}: {
  batchId?: string;
  enabled: boolean;
  intervalMs?: number;
}) {
  const router = useRouter();
  const previousFingerprint = useRef<string | null>(null);

  const { data } = useQuery({
    queryKey: queryKeys.aiImport.batchProgress(batchId ?? ""),
    queryFn: async () => {
      const response = await fetch(`/api/admin/ai-import/batches/${batchId}/progress`);
      if (!response.ok) throw new Error("Unable to load batch progress.");
      return response.json() as Promise<{ fingerprint: string }>;
    },
    enabled: Boolean(enabled && batchId),
    refetchInterval: enabled && batchId ? intervalMs : false,
    staleTime: Math.floor(intervalMs / 2),
  });

  useEffect(() => {
    const fingerprint = data?.fingerprint;
    if (!fingerprint) return;
    if (previousFingerprint.current && previousFingerprint.current !== fingerprint) {
      router.refresh();
    }
    previousFingerprint.current = fingerprint;
  }, [data?.fingerprint, router]);

  return null;
}

export function RetryFailedJobsButton({
  batchId,
  sourceFileId,
  pendingCount,
  size = "md",
}: {
  batchId: string;
  sourceFileId?: string;
  pendingCount?: number;
  size?: "sm" | "md";
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function retry() {
    setLoading(true);
    setMessage(null);
    const response = await fetch(`/api/admin/ai-import/batches/${batchId}/retry-failed`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sourceFileId, limit: pendingCount ?? 5000 }),
    });
    setLoading(false);
    if (!response.ok) {
      setMessage(errorMessage(await readApiError(response, "Could not retry failed OCR.")));
      return;
    }
    const data = await response.json();
    setMessage(`Retried ${data.attempted ?? 0}; fixed ${data.fixed ?? 0}; still pending ${data.stillRequired ?? 0}.`);
    router.refresh();
  }

  return (
    <div className="space-y-1">
      <Button type="button" variant="secondary" size={size} onClick={retry} disabled={loading} disabledReason={pendingCount === 0 ? "Nothing pending in this batch." : null}>
        {loading ? "Retrying..." : sourceFileId ? "Retry File" : "Retry Failed OCR"}
      </Button>
      {message && <p className="max-w-64 text-xs text-gray-500">{message}</p>}
    </div>
  );
}

export function CandidateStatusButton({
  candidateId,
  status,
  children,
}: {
  candidateId: string;
  status: string;
  children: ReactNode;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function updateStatus() {
    setLoading(true);
    await fetch(`/api/admin/ai-import/candidates/${candidateId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    setLoading(false);
    router.refresh();
  }

  return (
    <Button type="button" variant="secondary" onClick={updateStatus} disabled={loading}>
      {children}
    </Button>
  );
}

export function PromotePracticeSetButton({ batchId, sourceFileId, partial = false }: { batchId: string; sourceFileId: string; partial?: boolean }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function promote() {
    setLoading(true);
    setMessage(null);
    const response = await fetch(`/api/admin/ai-import/batches/${batchId}/promote-practice-set`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sourceFileId, allowPartial: partial }),
    });
    setLoading(false);
    if (!response.ok) {
      setMessage(errorMessage(await readApiError(response, "Could not create draft set.")));
      router.refresh();
      return;
    }
    const data = await response.json();
    setMessage(`Draft set ready with ${data.questionCount ?? 0}/${data.totalSourceCandidates ?? data.questionCount ?? 0} questions.`);
    router.refresh();
  }

  return (
    <div className="space-y-1">
      <Button type="button" variant="secondary" size="sm" onClick={promote} disabled={loading}>
        {loading ? "Creating..." : partial ? "Create Partial Draft" : "Create Draft Set"}
      </Button>
      {message && <p className="max-w-44 text-xs text-gray-500">{message}</p>}
    </div>
  );
}

export function PromoteFullTestButton({ batchId, testNumber, partial = false }: { batchId: string; testNumber: number; partial?: boolean }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function promote() {
    setLoading(true);
    setMessage(null);
    const response = await fetch(`/api/admin/ai-import/batches/${batchId}/promote-full-test`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ testNumber, allowPartial: partial }),
    });
    setLoading(false);
    const failure = response.ok ? null : await readApiError(response, "Could not create draft exam.");
    const data = failure ? {} : await response.json();
    if (!failure) {
      const modules = Array.isArray(data.modules)
        ? data.modules
            .map((m: { moduleKey?: string; section?: string; count?: number; expected?: number }) =>
              `${m.section} ${m.moduleKey} ${m.count ?? 0}/${m.expected ?? "?"}`,
            )
            .join(" · ")
        : (data.moduleCounts ?? []).join("/");
      setMessage(`Standardized FPT ready (4 groups): ${modules}`);
    } else {
      setMessage(failure.message);
    }
    router.refresh();
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button type="button" variant="secondary" onClick={promote} disabled={loading}>
        {loading ? "Creating..." : partial ? "Create Partial Full Test" : "Assemble FPT (4 groups)"}
      </Button>
      {message && <span className="text-xs text-gray-500">{message}</span>}
    </div>
  );
}
