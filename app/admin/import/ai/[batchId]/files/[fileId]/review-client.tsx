"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { CopyableTruncatedText } from "@/components/ui/copyable-truncated-text";
import { MathContent } from "@/components/math-content";
import { PdfPageCropper, type CropTarget, type CropOcrResult } from "@/app/admin/import/ai/_components/pdf-page-cropper";
import { MergeDialog } from "./merge-dialog";

type SourceFile = {
  id: string;
  relativePath: string;
  contentType: string;
  sourceKind: string;
  section: string | null;
  topicName: string | null;
  difficulty: string | null;
  status: string;
};

type PageArtifact = {
  id: string;
  pageNumber: number;
  method: string;
  extractedText: string | null;
  warning: string | null;
};

type Candidate = {
  id: string;
  questionNumber: number | null;
  questionExternalId: string | null;
  moduleLabel: string | null;
  section: string | null;
  domainName: string | null;
  topicName: string | null;
  subskillName: string | null;
  difficulty: string | null;
  type: string;
  stem: string | null;
  stimulus: string | null;
  optionsJson: string | null;
  correctAnswer: string | null;
  explanation: string | null;
  confidence: number;
  status: string;
  officialQuestionId: string | null;
  promotionStatus: string;
  warningsJson: string | null;
};

type AnswerCandidate = {
  id: string;
  questionNumber: number | null;
  answer: string | null;
  explanation: string | null;
  confidence: number;
};

type ImageArtifact = {
  id: string;
  pageArtifactId: string | null;
  pageNumber: number;
  imageIndex: number;
  origin: string;
  fileUrl: string | null;
  base64Data: string | null;
  mimeType: string | null;
  width: number | null;
  height: number | null;
  status: string;
};

type ImageLink = {
  id: string;
  candidateId: string;
  imageArtifactId: string;
  targetType: string;
  optionLabel: string | null;
  sortOrder: number;
};

type Incident = {
  id: string;
  severity: string;
  code: string;
  message: string;
  status: string;
  decision: string | null;
  action: string | null;
};

type ReviewSession = {
  currentStep: string;
  status: string;
};

const steps = ["PAGES", "QUESTIONS", "ANSWERS", "IMAGES", "FINAL"];
const targetTypes = [
  { value: "STEM", label: "Imagen de enunciado" },
  { value: "STIMULUS", label: "Imagen de estímulo" },
  { value: "OPTION", label: "Imagen de una opción" },
  { value: "OPTION_BLOCK", label: "Bloque de opciones (OCR)" },
  { value: "ANSWER_FIELD", label: "Campo de respuesta" },
  { value: "EXPLANATION", label: "Imagen de explicación" },
  { value: "PAGE_CONTEXT", label: "Contexto de página" },
];
const questionLinePattern = /^(?:question|q)\s*\.?\s*\d+[:.)\s-]/i;

function parseOptions(value: string | null) {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function parseWarnings(value: string | null) {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function imageSrc(image: Pick<ImageArtifact, "fileUrl" | "base64Data" | "mimeType">) {
  if (image.fileUrl) return image.fileUrl;
  if (!image.base64Data) return null;
  if (image.base64Data.startsWith("data:")) return image.base64Data;
  return `data:${image.mimeType || "image/jpeg"};base64,${image.base64Data}`;
}

function stripMarkdownImageRefs(value: string | null | undefined) {
  return (value ?? "").replace(/!\[[^\]]*]\([^)]+\)/g, "").replace(/\n{3,}/g, "\n\n").trim();
}

function targetLabel(value: string) {
  return targetTypes.find((target) => target.value === value)?.label ?? value;
}

// Human label for the concrete slot a link occupies, e.g. "Opción A".
function slotLabel(targetType: string, optionLabel: string | null) {
  if (targetType === "OPTION") return `Opción ${optionLabel ?? "?"}`;
  return targetLabel(targetType);
}

function textStats(value: string | null) {
  const text = value?.trim() ?? "";
  const lines = text ? text.split(/\r?\n/).filter((line) => line.trim()).length : 0;
  const questions = text ? text.split(/\r?\n/).filter((line) => questionLinePattern.test(line.trim())).length : 0;
  return { chars: text.length, lines, questions };
}

function compactSnippets(value: string | null, maxLines = 8) {
  const lines = (value ?? "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length <= maxLines) return lines;
  const questionLines = lines.filter((line) => questionLinePattern.test(line)).slice(0, maxLines);
  return questionLines.length >= 3 ? questionLines : lines.slice(0, maxLines);
}

function badgeVariant(status: string): "default" | "success" | "warning" | "danger" | "info" {
  if (["COMPLETED", "READY", "REVIEWED", "PROMOTED", "RESOLVED"].includes(status)) return "success";
  if (["FAILED", "ERROR", "REJECTED"].includes(status)) return "danger";
  if (["NEEDS_REVIEW", "NEEDS_OCR", "WARNING", "OPEN"].includes(status)) return "warning";
  if (["PROCESSING", "SCANNING", "EDITING"].includes(status)) return "info";
  return "default";
}

function incidentResolution(incident: Incident) {
  if (incident.code === "FULL_TEST_ANSWER_KEY_MISSING") return "Needs source file";
  if (incident.code === "FULL_TEST_DUPLICATE_SOURCE") return incident.status === "RESOLVED" ? "Duplicate ignored" : "Review duplicate";
  if (incident.code === "FULL_TEST_SECTION_UNRESOLVED" && incident.status !== "RESOLVED") return "Cannot auto-resolve";
  if (incident.status === "RESOLVED") return "Auto-resolved";
  return "Review source";
}

function PageTextPreview({ page }: { page: PageArtifact }) {
  const stats = textStats(page.extractedText);
  const snippets = compactSnippets(page.extractedText);
  const hasText = Boolean(page.extractedText?.trim());

  return (
    <div className="min-w-0 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={badgeVariant(page.method)}>{page.method}</Badge>
        <span className="text-xs text-gray-500">{stats.chars.toLocaleString()} chars</span>
        <span className="text-xs text-gray-500">{stats.lines} lines</span>
        {stats.questions > 0 && <span className="text-xs text-gray-500">{stats.questions} question markers</span>}
      </div>
      {hasText ? (
        <div className="rounded-md border border-gray-200 bg-gray-50 p-3">
          <div className="space-y-1">
            {snippets.map((line, index) => (
              <p key={`${page.id}-${index}`} className="line-clamp-2 text-xs leading-5 text-gray-700">
                {line}
              </p>
            ))}
          </div>
          {(page.extractedText?.length ?? 0) > 900 && (
            <details className="mt-3 border-t border-gray-200 pt-2">
              <summary className="cursor-pointer text-xs font-medium text-blue-700">Open full extracted text</summary>
              <pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap rounded bg-white p-3 text-xs leading-5 text-gray-700">
                {page.extractedText}
              </pre>
            </details>
          )}
        </div>
      ) : (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">{page.warning || "No text extracted."}</p>
      )}
      {page.warning && hasText && <p className="text-xs text-amber-700">{page.warning}</p>}
    </div>
  );
}

function FieldPreview({ label, value }: { label: string; value: string | null }) {
  if (!value?.trim()) return null;
  return (
    <section className="rounded-md border border-gray-200 bg-white p-3">
      <p className="mb-2 text-xs font-medium uppercase text-gray-400">{label}</p>
      <MathContent content={value} className="max-h-44 overflow-auto text-sm leading-6 text-gray-800" />
    </section>
  );
}

export function FileReviewClient({
  batchId,
  file,
  reviewSession,
  pages,
  candidates,
  answers,
  images,
  imageLinks,
  incidents,
}: {
  batchId: string;
  file: SourceFile;
  reviewSession: ReviewSession;
  pages: PageArtifact[];
  candidates: Candidate[];
  answers: AnswerCandidate[];
  images: ImageArtifact[];
  imageLinks: ImageLink[];
  incidents: Incident[];
}) {
  const router = useRouter();
  const [step, setStep] = useState(reviewSession.currentStep || "QUESTIONS");
  const [selectedId, setSelectedId] = useState(candidates[0]?.id ?? "");
  const selected = candidates.find((candidate) => candidate.id === selectedId) ?? candidates[0] ?? null;
  const [draft, setDraft] = useState<Candidate | null>(selected);
  const [saving, setSaving] = useState(false);
  const [parsingImageId, setParsingImageId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [targetType, setTargetType] = useState("ANSWER_FIELD");
  const [optionLabel, setOptionLabel] = useState("");
  const [mergeOpen, setMergeOpen] = useState(false);
  const [activeSlot, setActiveSlot] = useState<{ targetType: string; optionLabel: string | null; label: string } | null>(null);

  const linksByCandidate = useMemo(() => {
    const map = new Map<string, ImageLink[]>();
    for (const link of imageLinks) {
      const current = map.get(link.candidateId) ?? [];
      current.push(link);
      map.set(link.candidateId, current);
    }
    return map;
  }, [imageLinks]);

  const selectedLinks = selected ? linksByCandidate.get(selected.id) ?? [] : [];
  const answersForQuestion = selected?.questionNumber
    ? answers.filter((answer) => answer.questionNumber === selected.questionNumber)
    : [];

  // Option letters for this candidate (from parsed options, else A–D for MC).
  const optionLetters = (() => {
    const opts = parseOptions(selected?.optionsJson ?? null) as { label?: string }[];
    const letters = opts.map((opt) => (opt.label ?? "").toUpperCase()).filter(Boolean);
    return letters.length ? letters : ["A", "B", "C", "D"];
  })();
  // The concrete assignment slots shown in the board.
  const imageSlots: { targetType: string; optionLabel: string | null; label: string }[] = [
    { targetType: "STEM", optionLabel: null, label: "Enunciado" },
    ...optionLetters.map((letter) => ({ targetType: "OPTION", optionLabel: letter, label: `Opción ${letter}` })),
    { targetType: "STIMULUS", optionLabel: null, label: "Estímulo" },
  ];
  function linkForSlot(tType: string, oLabel: string | null) {
    return selectedLinks.find((link) => link.targetType === tType && (link.optionLabel ?? null) === (oLabel ?? null));
  }
  // imageId → list of slot labels it currently occupies.
  const assignmentsByImage = new Map<string, string[]>();
  for (const link of selectedLinks) {
    const list = assignmentsByImage.get(link.imageArtifactId) ?? [];
    list.push(slotLabel(link.targetType, link.optionLabel));
    assignmentsByImage.set(link.imageArtifactId, list);
  }

  async function updateSession(nextStep: string, candidateId = selectedId) {
    setStep(nextStep);
    await fetch(`/api/admin/ai-import/batches/${batchId}/review-session`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sourceFileId: file.id,
        currentStep: nextStep,
        progressJson: JSON.stringify({ candidateId }),
      }),
    });
  }

  function selectCandidate(candidate: Candidate) {
    setSelectedId(candidate.id);
    setDraft(candidate);
    void updateSession(step, candidate.id);
  }

  async function saveCandidate(status?: string) {
    if (!draft) return;
    setSaving(true);
    await fetch(`/api/admin/ai-import/candidates/${draft.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        stem: draft.stem,
        stimulus: draft.stimulus,
        optionsJson: draft.optionsJson,
        correctAnswer: draft.correctAnswer,
        explanation: draft.explanation,
        section: draft.section,
        domainName: draft.domainName,
        topicName: draft.topicName,
        subskillName: draft.subskillName,
        difficulty: draft.difficulty,
        type: draft.type,
        status: status ?? draft.status,
      }),
    });
    setSaving(false);
    router.refresh();
  }

  async function linkImage(imageId: string) {
    if (!selected) return;
    await fetch(`/api/admin/ai-import/candidates/${selected.id}/image-links`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        imageArtifactId: imageId,
        targetType,
        optionLabel: targetType === "OPTION" ? optionLabel || null : null,
      }),
    });
    router.refresh();
  }

  async function unlinkImage(linkId: string) {
    if (!selected) return;
    await fetch(`/api/admin/ai-import/candidates/${selected.id}/image-links?linkId=${linkId}`, { method: "DELETE" });
    router.refresh();
  }

  // Assign an image to a concrete slot (enunciado / opción X / estímulo…).
  // A slot holds exactly one image, so any current occupant is cleared first.
  async function assignToSlot(imageId: string, tType: string, oLabel: string | null) {
    if (!selected) return;
    const occupants = selectedLinks.filter(
      (link) => link.targetType === tType && (link.optionLabel ?? null) === (oLabel ?? null)
    );
    for (const occupant of occupants) {
      await fetch(`/api/admin/ai-import/candidates/${selected.id}/image-links?linkId=${occupant.id}`, { method: "DELETE" });
    }
    await fetch(`/api/admin/ai-import/candidates/${selected.id}/image-links`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imageArtifactId: imageId, targetType: tType, optionLabel: oLabel }),
    });
    router.refresh();
  }

  async function clearSlot(tType: string, oLabel: string | null) {
    if (!selected) return;
    const occupants = selectedLinks.filter(
      (link) => link.targetType === tType && (link.optionLabel ?? null) === (oLabel ?? null)
    );
    for (const occupant of occupants) {
      await fetch(`/api/admin/ai-import/candidates/${selected.id}/image-links?linkId=${occupant.id}`, { method: "DELETE" });
    }
    router.refresh();
  }

  async function parseOptionImage(imageId: string) {
    if (!selected) return;
    setParsingImageId(imageId);
    setMessage(null);
    const response = await fetch(`/api/admin/ai-import/candidates/${selected.id}/parse-option-image`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imageArtifactId: imageId }),
    });
    const data = await response.json().catch(() => ({}));
    setParsingImageId(null);
    if (!response.ok || !Array.isArray(data.options) || data.options.length !== 4) {
      setMessage(data.error || data.warning || "Could not parse A-D options from this image.");
      return;
    }
    setDraft({ ...selected, type: "MC", optionsJson: JSON.stringify(data.options), status: data.status ?? selected.status });
    setMessage("Options parsed from image.");
    router.refresh();
  }

  function applyCropOcr(target: CropTarget, result: CropOcrResult) {
    if (!draft) return;
    const text = (result.text ?? "").trim();
    if (target.targetType === "OPTION_BLOCK" && result.options && result.options.length === 4) {
      setDraft({ ...draft, type: "MC", optionsJson: JSON.stringify(result.options) });
    } else if (target.targetType === "OPTION" && target.optionLabel) {
      const opts = parseOptions(draft.optionsJson) as { label?: string; text?: string }[];
      const map = new Map(opts.map((o) => [(o.label ?? "").toUpperCase(), o.text ?? ""]));
      map.set(target.optionLabel, text);
      const ordered = ["A", "B", "C", "D"].map((label) => ({ label, text: map.get(label) ?? "" }));
      setDraft({ ...draft, type: "MC", optionsJson: JSON.stringify(ordered) });
    } else if (target.targetType === "STEM") {
      setDraft({ ...draft, stem: text });
    } else if (target.targetType === "STIMULUS") {
      setDraft({ ...draft, stimulus: text });
    } else if (target.targetType === "EXPLANATION") {
      setDraft({ ...draft, explanation: text });
    } else if (target.targetType === "ANSWER_FIELD") {
      setDraft({ ...draft, correctAnswer: text });
    }
    setMessage("Texto de OCR aplicado al borrador. Ve al paso QUESTIONS para revisar y Guardar.");
  }

  async function openQuestionEditor(candidateId: string) {
    await fetch(`/api/admin/ai-import/candidates/${candidateId}/mark-editing`, { method: "POST" });
    window.location.href = `/teacher/questions/new?ingestCandidateId=${candidateId}`;
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[260px_1fr]">
      <aside className="space-y-4">
        <Card padding="md">
          <p className="text-xs uppercase text-gray-400">File</p>
          <p className="mt-1 text-sm font-medium text-gray-900">{file.contentType}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Badge variant={badgeVariant(file.status)}>{file.status}</Badge>
            <Badge>{file.sourceKind}</Badge>
          </div>
          <CopyableTruncatedText value={file.relativePath} className="mt-3 max-w-full text-xs text-gray-500" />
        </Card>
        <Card padding="none" className="overflow-hidden">
          <div className="border-b border-gray-100 px-3 py-2 text-xs font-medium uppercase text-gray-500">Questions</div>
          <div className="max-h-[620px] overflow-auto">
            {candidates.map((candidate) => (
              <button
                key={candidate.id}
                type="button"
                onClick={() => selectCandidate(candidate)}
                className={`block w-full border-b border-gray-100 px-3 py-3 text-left text-sm ${candidate.id === selected?.id ? "bg-blue-50" : "hover:bg-gray-50"}`}
              >
                <span className="font-medium">Q{candidate.questionNumber ?? "?"}</span>
                <span className="ml-2 text-xs text-gray-500">{candidate.status}</span>
                <span className="ml-2 text-xs text-blue-600">{candidate.promotionStatus}</span>
                <span className="mt-1 block truncate text-xs text-gray-500">{candidate.questionExternalId ?? candidate.topicName ?? "No ID"}</span>
              </button>
            ))}
            {candidates.length === 0 && <p className="px-3 py-6 text-sm text-gray-400">No questions detected in this file.</p>}
          </div>
        </Card>
      </aside>

      <main className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {steps.map((item) => (
            <Button key={item} type="button" variant={step === item ? "primary" : "secondary"} size="sm" onClick={() => updateSession(item)}>
              {item}
            </Button>
          ))}
        </div>

        {incidents.length > 0 && (
          <Card padding="md">
            <p className="text-xs font-medium uppercase text-gray-500">Open checks</p>
            <div className="mt-2 grid gap-2">
              {incidents.slice(0, 5).map((incident) => (
                <div key={incident.id} className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={badgeVariant(incident.severity)}>{incident.severity}</Badge>
                    <Badge variant={badgeVariant(incident.status)}>{incidentResolution(incident)}</Badge>
                    <CopyableTruncatedText value={incident.code} className="max-w-64 text-xs font-medium text-gray-800" />
                    <span className="text-xs text-gray-400">{incident.status}</span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-sm text-gray-600">{incident.message}</p>
                  {(incident.decision || incident.action) && (
                    <p className="mt-1 line-clamp-2 text-xs text-gray-500">{incident.decision || incident.action}</p>
                  )}
                </div>
              ))}
            </div>
          </Card>
        )}

        {step === "PAGES" && (
          <Card padding="none" className="overflow-hidden">
            <div className="border-b border-gray-100 px-4 py-3 text-sm font-semibold text-gray-900">Pages and extracted text</div>
            <div className="divide-y divide-gray-100">
              {pages.map((page) => (
                <div key={page.id} className="grid gap-3 px-4 py-4 lg:grid-cols-[140px_1fr]">
                  <div className="text-sm text-gray-600">
                    Page {page.pageNumber}
                    <p className="text-xs text-gray-400">{page.method}</p>
                  </div>
                  <PageTextPreview page={page} />
                </div>
              ))}
            </div>
          </Card>
        )}

        {selected && draft && step !== "PAGES" && (
          <section className="grid gap-4 lg:grid-cols-[1fr_340px]">
            <Card padding="md">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs uppercase text-gray-400">Question candidate</p>
                  <h2 className="mt-1 text-lg font-semibold text-gray-900">Question {draft.questionNumber ?? "without number"}</h2>
                  <p className="mt-1 text-xs text-gray-500">
                    {draft.questionExternalId ?? "No external ID"} · {Math.round(draft.confidence * 100)}% confidence
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {candidates.length > 1 && (
                    <Button type="button" variant="secondary" onClick={() => setMergeOpen(true)}>
                      Fusionar con otra pregunta
                    </Button>
                  )}
                  <Button type="button" onClick={() => saveCandidate("REVIEWED")} disabled={saving}>
                    Mark Reviewed
                  </Button>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-2 rounded-md border border-blue-100 bg-blue-50 px-3 py-2 text-sm">
                <span className="text-blue-900">Promotion: {draft.promotionStatus}</span>
                {draft.officialQuestionId ? (
                  <Link href={`/teacher/questions/${draft.officialQuestionId}/edit`} className="font-medium text-blue-700 hover:underline">
                    Open official question
                  </Link>
                ) : (
                  <Button type="button" size="sm" onClick={() => openQuestionEditor(draft.id)}>
                    Open in Question Editor
                  </Button>
                )}
              </div>

              <div className="mt-5 grid gap-3 rounded-md border border-gray-200 bg-gray-50 p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={badgeVariant(draft.status)}>{draft.status}</Badge>
                  {draft.section && <Badge>{draft.section}</Badge>}
                  {draft.difficulty && <Badge>{draft.difficulty}</Badge>}
                  {draft.topicName && <CopyableTruncatedText value={draft.topicName} className="max-w-72 text-xs text-gray-600" />}
                </div>
                <FieldPreview label="Readable stem" value={stripMarkdownImageRefs(draft.stem)} />
                <FieldPreview label="Readable stimulus" value={stripMarkdownImageRefs(draft.stimulus)} />
                {parseOptions(draft.optionsJson).length > 0 && (
                  <section className="rounded-md border border-gray-200 bg-white p-3">
                    <p className="mb-2 text-xs font-medium uppercase text-gray-400">Readable options</p>
                    <div className="grid gap-2">
                      {parseOptions(draft.optionsJson).map((option: { label?: string; text?: string }) => (
                        <div key={option.label ?? option.text} className="rounded-md border border-gray-200 px-3 py-2">
                          <span className="mr-2 font-medium text-gray-900">{option.label}</span>
                          <MathContent content={option.text ?? ""} className="inline text-sm text-gray-800" />
                        </div>
                      ))}
                    </div>
                  </section>
                )}
                <FieldPreview label="Readable explanation" value={stripMarkdownImageRefs(draft.explanation)} />
              </div>

              <div className="mt-5 grid gap-4">
                <label className="grid gap-1">
                  <span className="text-xs font-medium text-gray-500">Stem</span>
                  <textarea value={stripMarkdownImageRefs(draft.stem)} onChange={(event) => setDraft({ ...draft, stem: event.target.value })} className="min-h-32 rounded-md border border-gray-300 px-3 py-2 text-sm" />
                </label>
                <label className="grid gap-1">
                  <span className="text-xs font-medium text-gray-500">Stimulus</span>
                  <textarea value={stripMarkdownImageRefs(draft.stimulus)} onChange={(event) => setDraft({ ...draft, stimulus: event.target.value })} className="min-h-20 rounded-md border border-gray-300 px-3 py-2 text-sm" />
                </label>
                <label className="grid gap-1">
                  <span className="text-xs font-medium text-gray-500">Options JSON</span>
                  <textarea value={draft.optionsJson ?? ""} onChange={(event) => setDraft({ ...draft, optionsJson: event.target.value })} className="min-h-28 rounded-md border border-gray-300 px-3 py-2 font-mono text-xs" />
                </label>
                <div className="grid gap-3 md:grid-cols-3">
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
                </div>
                <label className="grid gap-1">
                  <span className="text-xs font-medium text-gray-500">Explanation</span>
                  <textarea value={stripMarkdownImageRefs(draft.explanation)} onChange={(event) => setDraft({ ...draft, explanation: event.target.value })} className="min-h-24 rounded-md border border-gray-300 px-3 py-2 text-sm" />
                </label>
                {parseWarnings(draft.warningsJson).length > 0 && <p className="text-sm text-amber-700">{parseWarnings(draft.warningsJson).join(" ")}</p>}
                <div className="flex gap-2">
                  <Button type="button" onClick={() => saveCandidate()} disabled={saving}>
                    Save
                  </Button>
                  <Button type="button" variant="secondary" onClick={() => saveCandidate("REJECTED")} disabled={saving}>
                    Reject
                  </Button>
                </div>
              </div>
            </Card>

            <div className="space-y-4">
              <Card padding="md">
                <p className="text-xs font-medium uppercase text-gray-500">Answer candidates</p>
                <div className="mt-2 space-y-2">
                  {answersForQuestion.map((answer) => (
                    <button
                      key={answer.id}
                      type="button"
                      onClick={() => setDraft({ ...draft, correctAnswer: answer.answer ?? draft.correctAnswer, explanation: answer.explanation ?? draft.explanation })}
                      className="block w-full rounded-md border border-gray-200 px-3 py-2 text-left text-sm hover:bg-gray-50"
                    >
                      <span className="font-medium">{answer.answer ?? "No answer"}</span>
                      <span className="ml-2 text-xs text-gray-400">{Math.round(answer.confidence * 100)}%</span>
                    </button>
                  ))}
                  {answersForQuestion.length === 0 && <p className="text-sm text-gray-400">No answer candidates for this question.</p>}
                </div>
              </Card>

              <Card padding="md">
                <p className="text-xs font-medium uppercase text-gray-500">Imágenes enlazadas</p>
                <p className="mt-1 text-xs text-gray-400">Ve al paso IMAGES para asignar por ranura (Enunciado / A-D / Estímulo).</p>
                {selectedLinks.length > 0 ? (
                  <div className="mt-3 grid gap-2">
                    {selectedLinks.map((link) => {
                      const image = images.find((item) => item.id === link.imageArtifactId);
                      const src = image ? imageSrc(image) : null;
                      return (
                        <div key={link.id} className="rounded-md border border-blue-100 bg-blue-50 p-2">
                          <div className="mb-2 flex items-center justify-between gap-2">
                            <Badge variant="info">{slotLabel(link.targetType, link.optionLabel)}</Badge>
                            <span className="text-xs text-gray-500">p.{image?.pageNumber ?? "?"}</span>
                            <Button type="button" variant="ghost" size="sm" onClick={() => unlinkImage(link.id)}>Quitar</Button>
                          </div>
                          <div className="h-28 overflow-hidden rounded bg-white">
                            {src ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={src} alt={slotLabel(link.targetType, link.optionLabel)} className="h-full w-full object-contain" />
                            ) : (
                              <div className="flex h-full items-center justify-center text-xs text-gray-400">Sin vista previa</div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-gray-400">Aún no hay imágenes enlazadas.</p>
                )}
              </Card>
            </div>
          </section>
        )}

        {step === "IMAGES" && selected && (
          <Card padding="md">
            {/* Integrated assignment board: one slot per enunciado / opción / estímulo. */}
            <p className="text-xs font-medium uppercase text-gray-500">Asignación de imágenes</p>
            <p className="mt-1 text-xs text-gray-500">
              Elige una ranura y luego una imagen de abajo, o usa los botones de cada imagen. Cada ranura guarda una sola
              imagen.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {imageSlots.map((slot) => {
                const link = linkForSlot(slot.targetType, slot.optionLabel);
                const image = link ? images.find((item) => item.id === link.imageArtifactId) : undefined;
                const src = image ? imageSrc(image) : null;
                const isActive = activeSlot?.targetType === slot.targetType && (activeSlot?.optionLabel ?? null) === slot.optionLabel;
                return (
                  <button
                    key={`${slot.targetType}-${slot.optionLabel ?? ""}`}
                    type="button"
                    onClick={() => setActiveSlot(isActive ? null : slot)}
                    className={`flex w-28 flex-col items-center gap-1 rounded-md border p-2 text-center transition ${
                      isActive ? "border-blue-500 ring-2 ring-blue-200" : link ? "border-blue-200 bg-blue-50" : "border-dashed border-gray-300"
                    }`}
                  >
                    <span className="text-xs font-semibold text-gray-800">{slot.label}</span>
                    <div className="flex h-16 w-full items-center justify-center overflow-hidden rounded bg-white">
                      {src ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={src} alt={slot.label} className="h-full w-full object-contain" />
                      ) : (
                        <span className="text-[10px] text-gray-400">sin imagen</span>
                      )}
                    </div>
                    {link ? (
                      <span
                        role="button"
                        tabIndex={0}
                        onClick={(event) => {
                          event.stopPropagation();
                          void clearSlot(slot.targetType, slot.optionLabel);
                        }}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.stopPropagation();
                            void clearSlot(slot.targetType, slot.optionLabel);
                          }
                        }}
                        className="text-[10px] text-red-600 hover:underline"
                      >
                        Quitar
                      </span>
                    ) : (
                      <span className="text-[10px] text-gray-400">{isActive ? "elige imagen ↓" : "vacío"}</span>
                    )}
                  </button>
                );
              })}
            </div>

            {message && <p className="mt-3 text-xs text-gray-600">{message}</p>}

            <PdfPageCropper
              className="mt-4"
              candidateId={selected.id}
              sourceFileId={file.id}
              pageNumbers={pages.map((page) => page.pageNumber)}
              onAssigned={() => router.refresh()}
              onOcrText={applyCropOcr}
            />

            <div className="mt-4 flex items-center justify-between">
              <p className="text-xs font-medium uppercase text-gray-500">Imágenes extraídas ({images.length})</p>
              {activeSlot && (
                <span className="text-xs text-blue-700">
                  Asignando a <strong>{activeSlot.label}</strong>
                </span>
              )}
            </div>
            <div className="mt-2 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {images.map((image) => {
                const assignments = assignmentsByImage.get(image.id) ?? [];
                return (
                  <div key={image.id} className={`rounded-md border p-2 ${assignments.length ? "border-blue-300 bg-blue-50" : "border-gray-200"}`}>
                    <div className="relative h-40 overflow-hidden rounded bg-gray-100">
                      {imageSrc(image) ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={imageSrc(image) ?? ""} alt={`Imagen extraída página ${image.pageNumber}`} className="h-full w-full object-contain" />
                      ) : (
                        <div className="flex h-full items-center justify-center text-xs text-gray-400">Sin vista previa</div>
                      )}
                    </div>
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <span className="text-xs text-gray-500">p.{image.pageNumber} · {image.origin}</span>
                      {assignments.length > 0 && (
                        <div className="flex flex-wrap justify-end gap-1">
                          {assignments.map((label) => (
                            <Badge key={label} variant="info">{label}</Badge>
                          ))}
                        </div>
                      )}
                    </div>
                    {activeSlot && (
                      <Button type="button" size="sm" className="mt-2 w-full" onClick={() => assignToSlot(image.id, activeSlot.targetType, activeSlot.optionLabel)}>
                        Asignar a {activeSlot.label}
                      </Button>
                    )}
                    <div className="mt-2 flex flex-wrap gap-1">
                      {imageSlots.map((slot) => {
                        const occupies = linkForSlot(slot.targetType, slot.optionLabel)?.imageArtifactId === image.id;
                        const chip = slot.targetType === "STEM" ? "Enun." : slot.targetType === "STIMULUS" ? "Est." : slot.optionLabel;
                        return (
                          <button
                            key={`${image.id}-${slot.targetType}-${slot.optionLabel ?? ""}`}
                            type="button"
                            onClick={() => assignToSlot(image.id, slot.targetType, slot.optionLabel)}
                            className={`rounded border px-2 py-0.5 text-xs ${occupies ? "border-blue-500 bg-blue-500 text-white" : "border-gray-300 text-gray-600 hover:bg-gray-50"}`}
                          >
                            {chip}
                          </button>
                        );
                      })}
                      <Button type="button" size="sm" variant="ghost" onClick={() => parseOptionImage(image.id)} disabled={parsingImageId === image.id}>
                        {parsingImageId === image.id ? "OCR…" : "OCR A-D"}
                      </Button>
                    </div>
                  </div>
                );
              })}
              {images.length === 0 && <p className="text-sm text-gray-400">Aún no hay imágenes extraídas para este archivo.</p>}
            </div>

            {/* Advanced: less-common targets (answer field, explanation, options block, page context). */}
            <details className="mt-4 rounded-md border border-gray-200 p-3">
              <summary className="cursor-pointer text-xs font-medium text-gray-600">Destinos avanzados</summary>
              <div className="mt-3 grid gap-3 md:grid-cols-[1fr_120px]">
                <select value={targetType} onChange={(event) => setTargetType(event.target.value)} className="rounded-md border border-gray-300 px-3 py-2 text-sm">
                  {targetTypes.filter((t) => !["STEM", "OPTION", "STIMULUS"].includes(t.value)).map((target) => (
                    <option key={target.value} value={target.value}>{target.label}</option>
                  ))}
                </select>
                <Input value={optionLabel} onChange={(event) => setOptionLabel(event.target.value.toUpperCase())} placeholder="Letra" disabled={targetType !== "OPTION"} />
              </div>
              <p className="mt-2 text-xs text-gray-500">Elige el destino y pulsa “Enlazar aquí” en una imagen. Usa “Bloque de opciones (OCR)” para extraer A-D como texto.</p>
              <div className="mt-2 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                {images.map((image) => (
                  <Button key={`adv-${image.id}`} type="button" size="sm" variant="secondary" onClick={() => linkImage(image.id)}>
                    Enlazar p.{image.pageNumber} → {targetLabel(targetType)}
                  </Button>
                ))}
              </div>
            </details>
          </Card>
        )}

        {step === "FINAL" && (
          <Card padding="md">
            <p className="text-sm text-gray-700">
              Reviewed {candidates.filter((candidate) => candidate.status === "REVIEWED").length} of {candidates.length} questions.
            </p>
            <Button className="mt-3" type="button" onClick={() => updateSession("FINAL").then(() => fetch(`/api/admin/ai-import/batches/${batchId}/review-session`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ sourceFileId: file.id, currentStep: "FINAL", status: "COMPLETED" }),
            }).then(() => router.refresh()))}>
              Complete File Review
            </Button>
          </Card>
        )}

        {step === "QUESTIONS" && selected && (
          <Card padding="md">
            <p className="text-xs font-medium uppercase text-gray-500">Rendered options quick view</p>
            <div className="mt-2 grid gap-2">
              {parseOptions(selected.optionsJson).map((option: { label?: string; text?: string }) => (
                <div key={option.label ?? option.text} className="rounded-md border border-gray-200 px-3 py-2 text-sm">
                  <span className="mr-2 font-medium">{option.label}</span>
                  <MathContent content={option.text ?? ""} className="inline text-sm text-gray-800" />
                </div>
              ))}
              {parseOptions(selected.optionsJson).length === 0 && <p className="text-sm text-gray-400">No options detected for this candidate.</p>}
            </div>
          </Card>
        )}
      </main>

      {mergeOpen && selected && (
        <MergeDialog
          open={mergeOpen}
          onClose={() => setMergeOpen(false)}
          candidates={candidates}
          imageLinks={imageLinks}
          images={images}
          initialCandidateId={selected.id}
          onMerged={(survivorId) => {
            setMergeOpen(false);
            setSelectedId(survivorId);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
