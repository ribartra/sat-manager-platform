"use client";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useRef, useState } from "react";
import { Download, FileText, Loader2, Mail } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Hint } from "@/components/hint";
import { InlineError } from "@/components/sat/alert";
import { errorMessage, readApiError } from "@/lib/api-client";

const AREAS = [
  { key: "math", label: "Math", color: "var(--sat-area-math)" },
  { key: "reading", label: "Reading", color: "var(--sat-area-reading)" },
  { key: "writing", label: "Writing", color: "var(--sat-area-writing)" },
  { key: "tests", label: "Full Practice Tests", color: "var(--sat-area-tests)" },
] as const;
type AreaKey = (typeof AREAS)[number]["key"];

/**
 * "Generate Report": pick one or more areas, preview the server-generated PDF and download it.
 * Several areas produce ONE file with one section per area (Math → Reading → Writing → FPT).
 * The preview regenerates by itself whenever the selection changes; the iframe points at the
 * same-origin PDF endpoint (inline) and the download at the same endpoint as an attachment,
 * so both are exactly the same document.
 * With Full Practice Tests selected, the teacher can narrow the report to one exam. The same PDF
 * can be emailed as an attachment to the parents linked to the student.
 */
export interface ReportExamOption {
  id: string;
  label: string;
}
export interface ReportParentOption {
  id: string;
  name: string;
  email: string | null;
}
interface SendResult {
  parentId: string;
  name: string;
  email: string | null;
  sent: boolean;
  reason: string | null;
}
const SEND_REASON: Record<string, string> = {
  SMTP_NOT_CONFIGURED: "email isn't set up yet. Ask your administrator",
  SEND_FAILED: "the email could not be delivered",
};
export function GenerateReportDialog({
  studentId,
  studentName,
  currentArea,
  filters,
  filterSummary,
  exams = [],
  parents = [],
  initialExamId = "",
  triggerLabel,
}: {
  studentId: string;
  studentName: string;
  currentArea: AreaKey;
  filters: { topic?: string; difficulty?: string; from?: string; to?: string };
  /** Human-readable summary of the active filters, e.g. "Skill: Circles · Difficulty: HARD". */
  filterSummary: string;
  /** Submitted Full Practice Test attempts the report can be narrowed to. */
  exams?: ReportExamOption[];
  /** Parents linked to the student (only those with an email can receive the PDF). */
  parents?: ReportParentOption[];
  initialExamId?: string;
  /** Replaces the default "Generate Report" trigger text. */
  triggerLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Set<AreaKey>>(new Set([currentArea]));
  const [examId, setExamId] = useState(initialExamId);
  const [previewQuery, setPreviewQuery] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const emailParents = parents.filter((parent) => parent.email);
  const [recipients, setRecipients] = useState<Set<string>>(() => new Set(emailParents.map((parent) => parent.id)));
  const [sending, setSending] = useState(false);
  const [sendResults, setSendResults] = useState<SendResult[] | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const endpoint = `/api/reports/students/${studentId}/pdf`;

  // One exam only makes sense with Full Practice Tests selected; it replaces the other areas.
  const effectiveExamId = selected.has("tests") ? examId : "";
  const queryFor = (areas: Set<AreaKey>, exam: string) => {
    const keys = AREAS.filter((area) => areas.has(area.key)).map((area) => area.key);
    if (keys.length === 0) return null;
    const params = new URLSearchParams({ areas: keys.join(",") });
    for (const [key, value] of Object.entries(filters)) if (value) params.set(key, value);
    if (exam && areas.has("tests")) params.set("fptAttemptId", exam);
    return params.toString();
  };
  const query = queryFor(selected, effectiveExamId);

  /** Rebuild the preview for this selection (debounced so quick clicks produce one PDF). */
  function schedulePreview(areas: Set<AreaKey>, delay = 350, exam = examId) {
    if (timer.current) clearTimeout(timer.current);
    setSendResults(null);
    const next = queryFor(areas, exam);
    if (!next) {
      setPreviewQuery(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    timer.current = setTimeout(() => setPreviewQuery(next), delay);
  }

  function toggle(key: AreaKey) {
    const next = new Set(selected);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setSelected(next);
    schedulePreview(next);
  }

  function chooseExam(value: string) {
    setExamId(value);
    schedulePreview(selected, 0, value);
  }

  function toggleRecipient(id: string) {
    const next = new Set(recipients);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setRecipients(next);
  }

  async function sendToParents() {
    if (!query || recipients.size === 0) return;
    setSending(true);
    setSendError(null);
    setSendResults(null);
    const keys = AREAS.filter((area) => selected.has(area.key)).map((area) => area.key);
    const response = await fetch(`/api/reports/students/${studentId}/email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ parentIds: [...recipients], areas: keys, filters, fptAttemptId: effectiveExamId || null }),
    });
    setSending(false);
    if (!response.ok) {
      setSendError(errorMessage(await readApiError(response, "The report could not be sent.")));
      return;
    }
    const data = (await response.json()) as { results?: SendResult[] };
    setSendResults(data.results ?? []);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        // First open: build the preview right away.
        if (next && previewQuery === null) schedulePreview(selected, 0);
      }}
    >
      <Hint label="Make a PDF report for this student. Pick the areas, preview it, then download or email it.">
        <DialogTrigger asChild>
          <button type="button" className="inline-flex h-8 items-center justify-center gap-1.5 rounded-md border border-gray-300 bg-white px-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50">
            <FileText size={14} /> {triggerLabel ?? "Generate Report"}
          </button>
        </DialogTrigger>
      </Hint>
      <DialogContent className="flex h-[92vh] max-w-5xl flex-col gap-3 p-5">
        <DialogHeader>
          <DialogTitle>Progress report · {studentName}</DialogTitle>
          <DialogDescription>
            One section per area, in a single PDF. {filterSummary ? `Filters: ${filterSummary}.` : "No filters (all activity)."}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-2">
          {AREAS.map((area) => (
            <label
              key={area.key}
              className={`inline-flex cursor-pointer items-center gap-2 rounded-md border px-3 py-1.5 text-sm font-medium ${selected.has(area.key) ? "border-gray-900 bg-gray-50 text-gray-900" : "border-gray-200 text-gray-500"}`}
            >
              <Checkbox checked={selected.has(area.key)} onChange={() => toggle(area.key)} className="rounded border-gray-300" />
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: area.color }} aria-hidden />
              {area.label}
            </label>
          ))}
          <div className="ml-auto flex items-center gap-2">
            {loading && (
              <span className="inline-flex items-center gap-1.5 text-xs text-gray-500">
                <Loader2 size={14} className="animate-spin" /> Updating preview…
              </span>
            )}
            <Button
              asChild
              className="h-9 gap-1.5 px-3"
              disabledReason={!query ? "Choose at least one area for the report." : null}
            >
              <a href={query ? `${endpoint}?${query}` : undefined} title={query ? "Download the PDF for the selected areas" : undefined}>
                <Download size={14} /> Download PDF
              </a>
            </Button>
          </div>
        </div>
        {!query && <InlineError>Select at least one area.</InlineError>}
        {selected.has("tests") && exams.length > 0 ? (
          <label className="flex flex-wrap items-center gap-2 text-sm text-gray-700">
            <span className="font-medium">Exam</span>
            <select
              value={examId}
              onChange={(event) => chooseExam(event.target.value)}
              className="h-8 rounded-md border border-gray-300 bg-white px-2 text-sm"
            >
              <option value="">All exams</option>
              {exams.map((exam) => (
                <option key={exam.id} value={exam.id}>{exam.label}</option>
              ))}
            </select>
            {effectiveExamId ? <span className="text-xs text-gray-500">The report covers this exam only.</span> : null}
          </label>
        ) : null}

        <div className="relative min-h-0 flex-1 overflow-hidden rounded-md border border-gray-200 bg-gray-100">
          {previewQuery ? (
            <iframe
              key={previewQuery}
              title="Report preview"
              src={`${endpoint}?${previewQuery}&disposition=inline`}
              onLoad={() => setLoading(false)}
              className="h-full w-full"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-gray-400">Select one or more areas to build the report.</div>
          )}
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/60 text-sm font-medium text-gray-700">
              <Loader2 size={18} className="mr-2 animate-spin" /> Generating report…
            </div>
          )}
        </div>

        <div className="rounded-md border border-gray-200 p-3">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <span className="text-sm font-medium text-gray-900">Email to parents</span>
            {emailParents.length === 0 ? (
              <span className="text-sm text-gray-500">No linked parents with email. Link a parent in Parents to send the report.</span>
            ) : (
              emailParents.map((parent) => (
                <label key={parent.id} className="inline-flex cursor-pointer items-center gap-2 text-sm text-gray-700">
                  <Checkbox
                    checked={recipients.has(parent.id)}
                    onChange={() => toggleRecipient(parent.id)}
                    className="rounded border-gray-300"
                  />
                  {parent.name} <span className="text-gray-400">{parent.email}</span>
                </label>
              ))
            )}
            {emailParents.length > 0 ? (
              <Button
                type="button"
                variant="secondary"
                className="ml-auto h-9 gap-1.5 px-3"
                onClick={() => void sendToParents()}
                disabled={sending}
                disabledReason={!query ? "Choose at least one area for the report." : recipients.size === 0 ? "Select at least one parent." : null}
                title="Email this PDF to the selected parents"
              >
                {sending ? <Loader2 size={14} className="animate-spin" /> : <Mail size={14} />} Send PDF
              </Button>
            ) : null}
          </div>
          <InlineError className="mt-2">{sendError}</InlineError>
          {sendResults ? (
            <ul className="mt-2 space-y-0.5 text-sm">
              {sendResults.map((result) => (
                <li key={result.parentId} className={result.sent ? "text-green-700" : "text-rose-600"}>
                  {result.sent
                    ? `Sent to ${result.name} (${result.email}).`
                    : `Not sent to ${result.name}: ${SEND_REASON[result.reason ?? ""] ?? result.reason ?? "unknown error"}.`}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
