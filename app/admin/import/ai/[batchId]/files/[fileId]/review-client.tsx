"use client";

import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDown, Plus, Trash2, Braces } from "lucide-react";
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
  extension: string | null;
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
  moduleLabel: string | null;
  answer: string | null;
  explanation: string | null;
  confidence: number;
};

// A full-test file bundles several modules whose question numbers each restart
// at 1 (e.g. Module 1 has Q1–Q27 and Module 2B has Q1–Q27). Prefix the module so
// the two are distinguishable instead of showing two "Q1", two "Q2", … Practice
// sets carry no module → plain "Q<n>".
function qLabel(moduleLabel: string | null, questionNumber: number | null) {
  const q = `Q${questionNumber ?? "?"}`;
  return moduleLabel ? `M${moduleLabel} · ${q}` : q;
}

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

const targetTypes = [
  { value: "STEM", label: "Stem image" },
  { value: "STIMULUS", label: "Stimulus image" },
  { value: "OPTION", label: "Option image" },
  { value: "OPTION_BLOCK", label: "Options block (OCR)" },
  { value: "ANSWER_FIELD", label: "Answer field" },
  { value: "EXPLANATION", label: "Explanation image" },
  { value: "PAGE_CONTEXT", label: "Page context" },
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

// Signature of the persisted-relevant fields — used to flag unsaved edits.
// OCR/crop and manual edits only mutate the on-screen draft; nothing reaches
// the DB until Save (PATCH) runs.
function candidateSignature(draft: Candidate | null) {
  if (!draft) return "";
  return JSON.stringify({
    stem: draft.stem ?? "",
    stimulus: draft.stimulus ?? "",
    optionsJson: draft.optionsJson ?? "",
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

// Human label for the concrete slot a link occupies, e.g. "Option A".
function slotLabel(targetType: string, optionLabel: string | null) {
  if (targetType === "OPTION") return `Option ${optionLabel ?? "?"}`;
  return targetLabel(targetType);
}

// Editable options table (replaces the raw JSON textarea). Fully controlled by
// the draft: rows are derived from `optionsJson` each render and every edit
// serializes straight back through onChange, so the stored shape stays the
// canonical [{label,text}]. Marking a row correct writes the letter to
// correctAnswer in the SAME update (one setDraft) to keep them in sync. A "JSON"
// escape hatch stays available for repair / bulk paste, and auto-opens when the
// stored JSON is malformed so no data is silently dropped.
function OptionsEditor({
  optionsJson,
  correctAnswer,
  onChange,
}: {
  optionsJson: string | null;
  correctAnswer: string | null;
  onChange: (partial: { optionsJson?: string; correctAnswer?: string }) => void;
}) {
  const raw = optionsJson ?? "";
  const parsed = parseOptions(optionsJson) as { label?: string; text?: string }[];
  const rows = parsed.map((o, i) => ({ label: (o.label ?? String.fromCharCode(65 + i)).toUpperCase(), text: o.text ?? "" }));
  const jsonInvalid = raw.trim() !== "" && raw.trim() !== "[]" && rows.length === 0;
  const [showRaw, setShowRaw] = useState(jsonInvalid);
  const correct = (correctAnswer ?? "").trim().toUpperCase();

  const commit = (next: { label: string; text: string }[], nextCorrect?: string) =>
    onChange({ optionsJson: JSON.stringify(next), ...(nextCorrect !== undefined ? { correctAnswer: nextCorrect } : {}) });

  const setText = (i: number, text: string) => commit(rows.map((o, idx) => (idx === i ? { ...o, text } : o)));
  const setLabel = (i: number, value: string) => {
    const label = value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 2);
    const prev = rows[i].label;
    const next = rows.map((o, idx) => (idx === i ? { ...o, label } : o));
    commit(next, prev && prev === correct ? label : undefined);
  };
  const remove = (i: number) => commit(rows.filter((_, idx) => idx !== i));
  const add = () => {
    const used = new Set(rows.map((o) => o.label));
    let letter = "";
    for (let c = 65; c <= 90; c++) {
      if (!used.has(String.fromCharCode(c))) { letter = String.fromCharCode(c); break; }
    }
    commit([...rows, { label: letter || String.fromCharCode(65 + rows.length), text: "" }]);
  };
  const seedAD = () => commit(["A", "B", "C", "D"].map((l) => ({ label: l, text: "" })));

  return (
    <div className="grid gap-1">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-gray-500">Options</span>
        <button
          type="button"
          onClick={() => setShowRaw((v) => !v)}
          className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium ${showRaw ? "bg-gray-800 text-white" : "text-gray-500 hover:bg-gray-100"}`}
          title="Edit raw JSON"
        >
          <Braces className="h-3 w-3" /> JSON
        </button>
      </div>

      {showRaw ? (
        <>
          {jsonInvalid && <p className="text-xs text-rose-600">Invalid JSON — fix it here; the table re-enables once valid.</p>}
          <textarea
            value={raw}
            onChange={(event) => onChange({ optionsJson: event.target.value })}
            className="min-h-28 rounded-md border border-gray-300 px-3 py-2 font-mono text-xs"
          />
        </>
      ) : (
        <div className="grid gap-1.5">
          {rows.length === 0 && (
            <div className="flex items-center gap-2 rounded-md border border-dashed border-gray-300 px-3 py-2 text-xs text-gray-500">
              No options.
              <button type="button" onClick={seedAD} className="font-medium text-blue-600 hover:underline">Create A–D</button>
            </div>
          )}
          {rows.map((option, i) => {
            const isCorrect = correct !== "" && option.label === correct;
            return (
              <div
                key={i}
                className={`flex items-center gap-2 rounded-md border px-2 py-1.5 ${isCorrect ? "border-emerald-300 bg-emerald-50" : "border-gray-200"}`}
              >
                <button
                  type="button"
                  onClick={() => commit(rows, option.label)}
                  title="Mark as correct answer"
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[10px] font-bold transition-colors ${
                    isCorrect ? "border-emerald-500 bg-emerald-500 text-white" : "border-gray-300 text-transparent hover:border-emerald-400"
                  }`}
                >
                  ✓
                </button>
                <input
                  value={option.label}
                  onChange={(event) => setLabel(i, event.target.value)}
                  className="w-9 shrink-0 rounded border border-gray-300 px-1 py-1 text-center text-xs font-semibold uppercase"
                  aria-label="Option label"
                />
                <input
                  value={option.text}
                  onChange={(event) => setText(i, event.target.value)}
                  placeholder="Option text (KaTeX $…$)"
                  className="min-w-0 flex-1 rounded border border-gray-300 px-2 py-1 text-sm"
                  aria-label="Option text"
                />
                <button
                  type="button"
                  onClick={() => remove(i)}
                  title="Remove option"
                  className="shrink-0 rounded p-1 text-gray-400 hover:bg-rose-50 hover:text-rose-600"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            );
          })}
          {rows.length > 0 && (
            <button type="button" onClick={add} className="mt-0.5 inline-flex w-fit items-center gap-1 text-xs font-medium text-blue-600 hover:underline">
              <Plus className="h-3.5 w-3.5" /> Add option
            </button>
          )}
        </div>
      )}
    </div>
  );
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

// Collapsible section shell for the single-view review layout.
function Section({
  title,
  subtitle,
  defaultOpen = true,
  children,
}: {
  title: string;
  subtitle?: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  return (
    <details open={defaultOpen} className="group rounded-lg border border-gray-200 bg-white">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 text-sm font-semibold text-gray-900">
        <span className="flex flex-wrap items-center gap-2">
          {title}
          {subtitle && <span className="text-xs font-normal text-gray-400">{subtitle}</span>}
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-gray-400 transition group-open:rotate-180" />
      </summary>
      <div className="border-t border-gray-100 p-4">{children}</div>
    </details>
  );
}

// True when the candidate's options are resolved (numeric, an OCR'd block, or
// four option texts/images). Mirrors the pending rule used in the sets index.
function optionsResolvedFor(
  type: string,
  optionsJson: string | null,
  links: { targetType: string; optionLabel: string | null }[],
): boolean {
  if ((type ?? "MC") === "NUMERIC") return true;
  if (links.some((link) => link.targetType === "OPTION_BLOCK")) return true;
  const textCount = parseOptions(optionsJson).filter(
    (option: { text?: string }) => typeof option?.text === "string" && option.text.trim(),
  ).length;
  const imageLetters = new Set(
    links.filter((link) => link.targetType === "OPTION" && link.optionLabel).map((link) => link.optionLabel),
  ).size;
  return textCount + imageLetters >= 4;
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
  assignTargets = [],
  cropImageSource = null,
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
  assignTargets?: { questionId: string; label: string }[];
  cropImageSource?: { imageSourceFileId: string; pageNumbers: number[] } | null;
}) {
  const router = useRouter();
  const [galleryAssign, setGalleryAssign] = useState<{ imageId: string; questionId: string } | null>(null);
  const [assigning, setAssigning] = useState(false);

  async function assignGalleryImage(imageArtifactId: string, questionId: string) {
    if (!questionId) return;
    setAssigning(true);
    const res = await fetch(`/api/admin/ai-import/attach-question-image`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imageArtifactId, questionId }),
    });
    setAssigning(false);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) { setMessage(data.error || "No se pudo asignar la imagen."); return; }
    setGalleryAssign(null);
    setMessage(`Image assigned to ${assignTargets.find((t) => t.questionId === questionId)?.label ?? "the question"}.`);
    router.refresh();
  }
  const [selectedId, setSelectedId] = useState(candidates[0]?.id ?? "");
  const selected = candidates.find((candidate) => candidate.id === selectedId) ?? candidates[0] ?? null;
  const [draft, setDraft] = useState<Candidate | null>(selected);
  const [savedSignature, setSavedSignature] = useState<string>(() => candidateSignature(selected));
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
    ? answers.filter(
        (answer) =>
          answer.questionNumber === selected.questionNumber &&
          // Only cross-check the module when both sides carry one, so answers
          // from Module 2B don't attach to Module 1's identically-numbered Q.
          (!selected.moduleLabel || !answer.moduleLabel || answer.moduleLabel === selected.moduleLabel),
      )
    : [];

  // Option letters for this candidate (from parsed options, else A–D for MC).
  const optionLetters = (() => {
    const opts = parseOptions(selected?.optionsJson ?? null) as { label?: string }[];
    const letters = opts.map((opt) => (opt.label ?? "").toUpperCase()).filter(Boolean);
    return letters.length ? letters : ["A", "B", "C", "D"];
  })();
  // The concrete assignment slots shown in the board.
  const imageSlots: { targetType: string; optionLabel: string | null; label: string }[] = [
    { targetType: "STEM", optionLabel: null, label: "Stem" },
    ...optionLetters.map((letter) => ({ targetType: "OPTION", optionLabel: letter, label: `Option ${letter}` })),
    { targetType: "STIMULUS", optionLabel: null, label: "Stimulus" },
  ];
  function linkForSlot(tType: string, oLabel: string | null) {
    return selectedLinks.find((link) => link.targetType === tType && (link.optionLabel ?? null) === (oLabel ?? null));
  }
  // imageId → the slots it currently occupies. Keyed by link id, not label:
  // one image can legitimately hold several links with the same slot label
  // (e.g. two OPTION_BLOCK crops), which would collide on a label-based React key.
  const assignmentsByImage = new Map<string, { id: string; label: string }[]>();
  for (const link of selectedLinks) {
    const list = assignmentsByImage.get(link.imageArtifactId) ?? [];
    list.push({ id: link.id, label: slotLabel(link.targetType, link.optionLabel) });
    assignmentsByImage.set(link.imageArtifactId, list);
  }
  const dirty = candidateSignature(draft) !== savedSignature;
  const isMc = (draft?.type ?? "MC") !== "NUMERIC";
  const optsResolved = draft ? optionsResolvedFor(draft.type, draft.optionsJson, selectedLinks) : false;
  // Links on non-board targets (answer field, explanation, page context…).
  const otherLinks = selectedLinks.filter((link) => !["STEM", "OPTION", "STIMULUS"].includes(link.targetType));

  async function persistCandidate(candidateId = selectedId) {
    await fetch(`/api/admin/ai-import/batches/${batchId}/review-session`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sourceFileId: file.id,
        currentStep: "REVIEW",
        progressJson: JSON.stringify({ candidateId }),
      }),
    });
  }

  async function completeReview() {
    await fetch(`/api/admin/ai-import/batches/${batchId}/review-session`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sourceFileId: file.id, currentStep: "REVIEW", status: "COMPLETED" }),
    });
    router.refresh();
  }

  function selectCandidate(candidate: Candidate) {
    setSelectedId(candidate.id);
    setDraft(candidate);
    setSavedSignature(candidateSignature(candidate));
    setActiveSlot(null);
    setMessage(null);
    void persistCandidate(candidate.id);
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
    setSavedSignature(candidateSignature({ ...draft, status: status ?? draft.status }));
    setMessage(status ? `Guardado y marcado ${status}.` : "Cambios guardados en la base de datos.");
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

  // Assign an image to a concrete slot (stem / option X / stimulus…).
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
    if (target.targetType === "OPTION_BLOCK" && result.options && result.options.length) {
      // Merge parsed options over the existing rows so a partial OCR (2–3 of 4)
      // still fills what it found and leaves the rest for the reviewer.
      const existing = parseOptions(draft.optionsJson) as { label?: string; text?: string }[];
      const map = new Map(existing.map((o) => [(o.label ?? "").toUpperCase(), o.text ?? ""]));
      for (const o of result.options) map.set((o.label ?? "").toUpperCase(), o.text ?? "");
      const ordered = ["A", "B", "C", "D"].map((label) => ({ label, text: map.get(label) ?? "" }));
      setDraft({ ...draft, type: "MC", optionsJson: JSON.stringify(ordered) });
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
    setMessage("OCR text applied to the draft. Click Save to write to the database.");
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
            {candidates.map((candidate) => {
              const cLinks = linksByCandidate.get(candidate.id) ?? [];
              const resolved = optionsResolvedFor(candidate.type, candidate.optionsJson, cLinks);
              const state = candidate.status === "REJECTED"
                ? { dot: "bg-gray-300", label: "rejected" }
                : !candidate.correctAnswer
                ? { dot: "bg-amber-500", label: "missing answer" }
                : !resolved
                ? { dot: "bg-amber-500", label: "missing options" }
                : { dot: "bg-green-500", label: "ready" };
              return (
                <button
                  key={candidate.id}
                  type="button"
                  onClick={() => selectCandidate(candidate)}
                  className={`block w-full border-b border-gray-100 px-3 py-3 text-left text-sm ${candidate.id === selected?.id ? "bg-blue-50" : "hover:bg-gray-50"}`}
                >
                  <span className="flex items-center gap-2">
                    <span className={`h-2 w-2 shrink-0 rounded-full ${state.dot}`} aria-hidden />
                    <span className="font-medium">{qLabel(candidate.moduleLabel, candidate.questionNumber)}</span>
                    <span className="text-xs text-gray-400">{state.label}</span>
                  </span>
                  <span className="mt-1 block truncate text-xs text-gray-500">{candidate.questionExternalId ?? candidate.topicName ?? "no ID"}</span>
                </button>
              );
            })}
            {candidates.length === 0 && <p className="px-3 py-6 text-sm text-gray-400">No questions detected in this file.</p>}
          </div>
        </Card>
      </aside>

      <main className="space-y-4">
        {selected && draft ? (
          <>
            {/* Sticky context + actions bar (shared across all sections). */}
            <div className="sticky top-0 z-10 rounded-lg border border-gray-200 bg-white/95 px-4 py-3 shadow-sm backdrop-blur">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-base font-semibold text-gray-900">{qLabel(draft.moduleLabel, draft.questionNumber)}</h2>
                  <span className="text-xs text-gray-500">{draft.questionExternalId ?? "no ID"} · {Math.round(draft.confidence * 100)}%</span>
                  <Badge variant={badgeVariant(draft.status)}>{draft.status}</Badge>
                  <Badge variant={badgeVariant(draft.promotionStatus)}>{draft.promotionStatus}</Badge>
                  {draft.section && <Badge>{draft.section}</Badge>}
                  {draft.difficulty && <Badge>{draft.difficulty}</Badge>}
                  {draft.topicName && (
                    <span className="max-w-[180px] truncate text-xs text-gray-500" title={draft.topicName}>{draft.topicName}</span>
                  )}
                  {dirty && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                      <span className="h-1.5 w-1.5 rounded-full bg-amber-500" /> Unsaved
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {candidates.length > 1 && (
                    <Button type="button" variant="secondary" size="sm" onClick={() => setMergeOpen(true)}>Merge</Button>
                  )}
                  {draft.officialQuestionId ? (
                    <Link href={`/teacher/questions/${draft.officialQuestionId}/edit`} className="text-xs font-medium text-blue-700 hover:underline">
                      Open official
                    </Link>
                  ) : (
                    <Button type="button" variant="secondary" size="sm" onClick={() => openQuestionEditor(draft.id)}>Open in editor</Button>
                  )}
                  <Button type="button" variant="ghost" size="sm" onClick={() => saveCandidate("REJECTED")} disabled={saving}>Reject</Button>
                  <Button type="button" variant={dirty ? "primary" : "secondary"} size="sm" onClick={() => saveCandidate()} disabled={saving || !dirty}>
                    {saving ? "Saving…" : dirty ? "Save changes" : "Saved"}
                  </Button>
                  <Button type="button" variant="secondary" size="sm" onClick={() => saveCandidate("REVIEWED")} disabled={saving}>Mark reviewed</Button>
                </div>
              </div>
              <p className={`mt-2 text-xs ${dirty ? "text-amber-700" : "text-gray-500"}`}>
                {dirty
                  ? "Crop OCR and edits only change the on-screen draft. Click Save to write to the database."
                  : message ?? "No pending changes."}
              </p>
            </div>

            {incidents.length > 0 && (
              <Section title="Open checks" subtitle={String(incidents.length)} defaultOpen={false}>
                <div className="grid gap-2">
                  {incidents.slice(0, 8).map((incident) => (
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
              </Section>
            )}

            {/* SECTION: Question — editor + live rendered preview. */}
            <Section title="Question" subtitle={isMc ? "multiple choice" : "numeric response"}>
              <div className="grid gap-4 lg:grid-cols-2">
                <div className="grid gap-3">
                  <label className="grid gap-1">
                    <span className="text-xs font-medium text-gray-500">Stem</span>
                    <textarea value={stripMarkdownImageRefs(draft.stem)} onChange={(event) => setDraft({ ...draft, stem: event.target.value })} className="min-h-32 rounded-md border border-gray-300 px-3 py-2 text-sm" />
                  </label>
                  {(isMc || draft.stimulus) && (
                    <label className="grid gap-1">
                      <span className="text-xs font-medium text-gray-500">Stimulus</span>
                      <textarea value={stripMarkdownImageRefs(draft.stimulus)} onChange={(event) => setDraft({ ...draft, stimulus: event.target.value })} className="min-h-20 rounded-md border border-gray-300 px-3 py-2 text-sm" />
                    </label>
                  )}
                  {isMc && (
                    <OptionsEditor
                      optionsJson={draft.optionsJson}
                      correctAnswer={draft.correctAnswer}
                      onChange={(partial) => setDraft({ ...draft, ...partial })}
                    />
                  )}
                  <div className="grid gap-3 md:grid-cols-2">
                    <label className="grid gap-1">
                      <span className="text-xs font-medium text-gray-500">Difficulty</span>
                      <Input value={draft.difficulty ?? ""} onChange={(event) => setDraft({ ...draft, difficulty: event.target.value })} />
                    </label>
                    <label className="grid gap-1">
                      <span className="text-xs font-medium text-gray-500">Skill</span>
                      <Input value={draft.topicName ?? ""} onChange={(event) => setDraft({ ...draft, topicName: event.target.value })} />
                    </label>
                  </div>
                  {parseWarnings(draft.warningsJson).length > 0 && <p className="text-sm text-amber-700">{parseWarnings(draft.warningsJson).join(" ")}</p>}
                </div>
                <div className="grid content-start gap-3 rounded-md border border-gray-200 bg-gray-50 p-3">
                  <p className="text-xs font-medium uppercase text-gray-400">Rendered preview</p>
                  {stripMarkdownImageRefs(draft.stem) ? (
                    <MathContent content={stripMarkdownImageRefs(draft.stem)} className="text-sm leading-6 text-gray-800" />
                  ) : (
                    <p className="text-xs text-gray-400">No stem.</p>
                  )}
                  {stripMarkdownImageRefs(draft.stimulus) && (
                    <MathContent content={stripMarkdownImageRefs(draft.stimulus)} className="text-sm leading-6 text-gray-700" />
                  )}
                  {isMc && parseOptions(draft.optionsJson).length > 0 && (
                    <div className="grid gap-2">
                      {parseOptions(draft.optionsJson).map((option: { label?: string; text?: string }) => (
                        <div key={option.label ?? option.text} className="rounded-md border border-gray-200 bg-white px-3 py-2">
                          <span className="mr-2 font-medium text-gray-900">{option.label}</span>
                          <MathContent content={option.text ?? ""} className="inline text-sm text-gray-800" />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </Section>

            {/* SECTION: Answer and explanation. */}
            <Section title="Answer and explanation" subtitle={draft.correctAnswer ? undefined : "missing answer"}>
              <div className="grid gap-4 lg:grid-cols-[1fr_260px]">
                <div className="grid content-start gap-3">
                  <label className="grid gap-1">
                    <span className="text-xs font-medium text-gray-500">Correct answer</span>
                    <Input value={draft.correctAnswer ?? ""} onChange={(event) => setDraft({ ...draft, correctAnswer: event.target.value })} />
                  </label>
                  <label className="grid gap-1">
                    <span className="text-xs font-medium text-gray-500">Explanation</span>
                    <textarea value={stripMarkdownImageRefs(draft.explanation)} onChange={(event) => setDraft({ ...draft, explanation: event.target.value })} className="min-h-28 rounded-md border border-gray-300 px-3 py-2 text-sm" />
                  </label>
                  {stripMarkdownImageRefs(draft.explanation) && (
                    <div className="rounded-md border border-gray-200 bg-gray-50 p-3">
                      <p className="mb-1 text-xs font-medium uppercase text-gray-400">Rendered preview</p>
                      <MathContent content={stripMarkdownImageRefs(draft.explanation)} className="max-h-56 overflow-auto text-sm leading-6 text-gray-800" />
                    </div>
                  )}
                </div>
                <div>
                  <p className="text-xs font-medium uppercase text-gray-500">Answer suggestions</p>
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
                    {answersForQuestion.length === 0 && <p className="text-sm text-gray-400">No suggestions for this question.</p>}
                  </div>
                </div>
              </div>
            </Section>

            {/* SECTION: Images — A–D board + grid. */}
            <Section title="Images" subtitle={`${selectedLinks.length} linked`}>
              <p className="text-xs text-gray-500">
                Pick a slot, then an image below, or use each image’s buttons. Each slot keeps a single image.
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
                          <span className="text-[10px] text-gray-400">no image</span>
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
                          Remove
                        </span>
                      ) : (
                        <span className="text-[10px] text-gray-400">{isActive ? "pick image ↓" : "empty"}</span>
                      )}
                    </button>
                  );
                })}
              </div>

              {otherLinks.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {otherLinks.map((link) => {
                    const image = images.find((item) => item.id === link.imageArtifactId);
                    return (
                      <span key={link.id} className="inline-flex items-center gap-2 rounded-md border border-gray-200 bg-gray-50 px-2 py-1 text-xs text-gray-600">
                        {slotLabel(link.targetType, link.optionLabel)} · p.{image?.pageNumber ?? "?"}
                        <button type="button" onClick={() => unlinkImage(link.id)} className="text-red-600 hover:underline">Remove</button>
                      </span>
                    );
                  })}
                </div>
              )}

              <PdfPageCropper
                className="mt-4"
                candidateId={selected.id}
                sourceFileId={file.id}
                pageNumbers={pages.map((page) => page.pageNumber)}
                imageSourceFileId={cropImageSource?.imageSourceFileId}
                imagePageNumbers={cropImageSource?.pageNumbers}
                onAssigned={() => router.refresh()}
                onOcrText={applyCropOcr}
              />

              <div className="mt-4 flex items-center justify-between">
                <p className="text-xs font-medium uppercase text-gray-500">Extracted images ({images.length})</p>
                {activeSlot && (
                  <span className="text-xs text-blue-700">
                    Assigning to <strong>{activeSlot.label}</strong>
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
                          <img src={imageSrc(image) ?? ""} alt={`Extracted image page ${image.pageNumber}`} className="h-full w-full object-contain" />
                        ) : (
                          <div className="flex h-full items-center justify-center text-xs text-gray-400">No preview</div>
                        )}
                      </div>
                      <div className="mt-2 flex items-center justify-between gap-2">
                        <span className="text-xs text-gray-500">p.{image.pageNumber} · {image.origin}</span>
                        {assignments.length > 0 && (
                          <div className="flex flex-wrap justify-end gap-1">
                            {assignments.map((assignment) => (
                              <Badge key={assignment.id} variant="info">{assignment.label}</Badge>
                            ))}
                          </div>
                        )}
                      </div>
                      {activeSlot && (
                        <Button type="button" size="sm" className="mt-2 w-full" onClick={() => assignToSlot(image.id, activeSlot.targetType, activeSlot.optionLabel)}>
                          Assign to {activeSlot.label}
                        </Button>
                      )}
                      <div className="mt-2 flex flex-wrap gap-1">
                        {imageSlots.map((slot) => {
                          const occupies = linkForSlot(slot.targetType, slot.optionLabel)?.imageArtifactId === image.id;
                          const chip = slot.targetType === "STEM" ? "Stem" : slot.targetType === "STIMULUS" ? "Stim." : slot.optionLabel;
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
                {images.length === 0 && <p className="text-sm text-gray-400">No extracted images for this file yet.</p>}
              </div>

              <details className="mt-4 rounded-md border border-gray-200 p-3">
                <summary className="cursor-pointer text-xs font-medium text-gray-600">Advanced targets</summary>
                <div className="mt-3 grid gap-3 md:grid-cols-[1fr_120px]">
                  <select value={targetType} onChange={(event) => setTargetType(event.target.value)} className="rounded-md border border-gray-300 px-3 py-2 text-sm">
                    {targetTypes.filter((t) => !["STEM", "OPTION", "STIMULUS"].includes(t.value)).map((target) => (
                      <option key={target.value} value={target.value}>{target.label}</option>
                    ))}
                  </select>
                  <Input value={optionLabel} onChange={(event) => setOptionLabel(event.target.value.toUpperCase())} placeholder="Letra" disabled={targetType !== "OPTION"} />
                </div>
                <p className="mt-2 text-xs text-gray-500">Choose a target and click “Link” on an image. Use “Options block (OCR)” to extract A–D as text.</p>
                <div className="mt-2 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                  {images.map((image) => (
                    <Button key={`adv-${image.id}`} type="button" size="sm" variant="secondary" onClick={() => linkImage(image.id)}>
                      Link p.{image.pageNumber} → {targetLabel(targetType)}
                    </Button>
                  ))}
                </div>
              </details>
            </Section>

            {/* SECTION: Finalizar — checklist + completar. */}
            <Section title="Finalizar" defaultOpen={false}>
              <ul className="grid gap-1 text-sm">
                <li className={draft.correctAnswer ? "text-green-700" : "text-amber-700"}>
                  {draft.correctAnswer ? "✓" : "✗"} Answer assigned
                </li>
                <li className={optsResolved ? "text-green-700" : "text-amber-700"}>
                  {optsResolved ? "✓" : "✗"} {isMc ? "Options resolved (text or A–D images)" : "Numeric answer (N/A options)"}
                </li>
                <li className={draft.status === "REVIEWED" ? "text-green-700" : "text-gray-500"}>
                  {draft.status === "REVIEWED" ? "✓" : "•"} Marked as reviewed
                </li>
              </ul>
              <p className="mt-3 text-sm text-gray-700">
                Revisadas {candidates.filter((candidate) => candidate.status === "REVIEWED").length} de {candidates.length} · Estado del archivo: {reviewSession.status}
              </p>
              <Button className="mt-3" type="button" onClick={() => void completeReview()}>
                Complete file review
              </Button>
            </Section>
          </>
        ) : (
          <Card padding="md">
            <p className="text-sm text-gray-400">Selecciona una pregunta en la lista de la izquierda.</p>
          </Card>
        )}

        {/* SECTION: Gallery of all extracted images for the file.
            Only when NO candidate is selected — with a selection, the Images section
            already shows the extracted-images grid (with assignment), so we avoid a
            duplicate. Covers files with no candidates (screenshot docx) where that board
            does not appear. */}
        {!selected && (
          <Section title="Extracted image gallery" subtitle={`${images.length} images`} defaultOpen={candidates.length === 0}>
            {images.length === 0 ? (
              <p className="py-4 text-sm text-gray-400">No extracted images in this file.</p>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {images.map((image) => {
                  const src = imageSrc(image);
                  return (
                    <figure key={image.id} className="overflow-hidden rounded-md border border-gray-200">
                      {src ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <a href={src} target="_blank" rel="noreferrer" className="block bg-gray-50" title={`${image.origin} · page ${image.pageNumber}`}>
                          <img src={src} alt={`Page ${image.pageNumber} image ${image.imageIndex}`} className="h-40 w-full object-contain" loading="lazy" />
                        </a>
                      ) : (
                        <div className="flex h-40 items-center justify-center text-xs text-gray-400">no preview</div>
                      )}
                      <figcaption className="flex items-center justify-between gap-2 px-2 py-1 text-xs text-gray-500">
                        <span>p.{image.pageNumber}{typeof image.imageIndex === "number" ? ` · #${image.imageIndex}` : ""}</span>
                        {image.width && image.height ? <span className="shrink-0 text-gray-400">{image.width}×{image.height}</span> : null}
                      </figcaption>
                      {assignTargets.length > 0 && (
                        <div className="flex items-center gap-1 border-t border-gray-100 px-2 py-1.5">
                          <select
                            value={galleryAssign?.imageId === image.id ? galleryAssign.questionId : ""}
                            onChange={(e) => setGalleryAssign({ imageId: image.id, questionId: e.target.value })}
                            className="min-w-0 flex-1 rounded border border-gray-300 px-1 py-1 text-xs"
                          >
                            <option value="">Assign to…</option>
                            {assignTargets.map((t) => (
                              <option key={t.questionId} value={t.questionId}>{t.label}</option>
                            ))}
                          </select>
                          <button
                            type="button"
                            disabled={assigning || galleryAssign?.imageId !== image.id || !galleryAssign?.questionId}
                            onClick={() => galleryAssign && assignGalleryImage(image.id, galleryAssign.questionId)}
                            className="shrink-0 rounded bg-blue-600 px-2 py-1 text-xs font-medium text-white disabled:opacity-40"
                          >
                            OK
                          </button>
                        </div>
                      )}
                    </figure>
                  );
                })}
              </div>
            )}
          </Section>
        )}

        {/* SECTION: File pages (context). */}
        <Section title="Pages and extracted text" subtitle={`${pages.length} pages`} defaultOpen={false}>
          <div className="divide-y divide-gray-100">
            {pages.map((page) => (
              <div key={page.id} className="grid gap-3 py-4 lg:grid-cols-[140px_1fr]">
                <div className="text-sm text-gray-600">
                  Page {page.pageNumber}
                  <p className="text-xs text-gray-400">{page.method}</p>
                </div>
                <PageTextPreview page={page} />
              </div>
            ))}
            {pages.length === 0 && <p className="py-4 text-sm text-gray-400">No pages recorded.</p>}
          </div>
        </Section>
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
