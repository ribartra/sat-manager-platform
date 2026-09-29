"use client";

import { useRef, useState } from "react";
import { Download, FileText, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Hint } from "@/components/hint";

const AREAS = [
  { key: "math", label: "Math", color: "var(--sat-area-math)" },
  { key: "reading", label: "Reading", color: "var(--sat-area-reading)" },
  { key: "writing", label: "Writing", color: "var(--sat-area-writing)" },
  { key: "mocks", label: "Full Practice Tests", color: "var(--sat-area-mocks)" },
] as const;
type AreaKey = (typeof AREAS)[number]["key"];

/**
 * "Generate Report": pick one or more areas, preview the server-generated PDF and download it.
 * Several areas produce ONE file with one section per area (Math → Reading → Writing → FPT).
 * The preview regenerates by itself whenever the selection changes; the iframe points at the
 * same-origin PDF endpoint (inline) and the download at the same endpoint as an attachment,
 * so both are exactly the same document.
 */
export function GenerateReportDialog({
  studentId,
  studentName,
  currentArea,
  filters,
  filterSummary,
}: {
  studentId: string;
  studentName: string;
  currentArea: AreaKey;
  filters: { topic?: string; difficulty?: string; from?: string; to?: string };
  /** Human-readable summary of the active filters, e.g. "Skill: Circles · Difficulty: HARD". */
  filterSummary: string;
}) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Set<AreaKey>>(new Set([currentArea]));
  const [previewQuery, setPreviewQuery] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const endpoint = `/api/reports/students/${studentId}/pdf`;

  const queryFor = (areas: Set<AreaKey>) => {
    const keys = AREAS.filter((area) => areas.has(area.key)).map((area) => area.key);
    if (keys.length === 0) return null;
    const params = new URLSearchParams({ areas: keys.join(",") });
    for (const [key, value] of Object.entries(filters)) if (value) params.set(key, value);
    return params.toString();
  };
  const query = queryFor(selected);

  /** Rebuild the preview for this selection (debounced so quick clicks produce one PDF). */
  function schedulePreview(areas: Set<AreaKey>, delay = 350) {
    if (timer.current) clearTimeout(timer.current);
    const next = queryFor(areas);
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

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        // First open: build the preview right away.
        if (next && previewQuery === null) schedulePreview(selected, 0);
      }}
    >
      <Hint label="Build a printable PDF report for this student: pick the areas, preview it, then download. Several areas are combined into one file.">
        <DialogTrigger asChild>
          <button type="button" className="inline-flex h-8 items-center justify-center gap-1.5 rounded-md border border-gray-300 bg-white px-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50">
            <FileText size={14} /> Generate Report
          </button>
        </DialogTrigger>
      </Hint>
      <DialogContent className="flex h-[92vh] max-w-5xl flex-col gap-3 p-5">
        <DialogHeader>
          <DialogTitle>Progress report · {studentName}</DialogTitle>
          <DialogDescription>
            One section per selected area, in a single PDF. {filterSummary ? `Filters: ${filterSummary}.` : "No filters (all activity)."} Skill and difficulty apply to Math, Reading and Writing; dates apply to all.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-2">
          {AREAS.map((area) => (
            <label
              key={area.key}
              className={`inline-flex cursor-pointer items-center gap-2 rounded-md border px-3 py-1.5 text-sm font-medium ${selected.has(area.key) ? "border-gray-900 bg-gray-50 text-gray-900" : "border-gray-200 text-gray-500"}`}
            >
              <input type="checkbox" checked={selected.has(area.key)} onChange={() => toggle(area.key)} className="rounded border-gray-300" />
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
            <a
              href={query ? `${endpoint}?${query}` : undefined}
              aria-disabled={!query}
              onClick={(event) => {
                if (!query) event.preventDefault();
              }}
              className={`inline-flex h-9 items-center gap-1.5 rounded-md bg-blue-600 px-3 text-sm font-medium text-white hover:bg-blue-700 ${!query ? "pointer-events-none opacity-50" : ""}`}
              title="Download the PDF for the selected areas"
            >
              <Download size={14} /> Download PDF
            </a>
          </div>
        </div>
        {!query && <p className="text-sm text-rose-600">Select at least one area.</p>}

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
      </DialogContent>
    </Dialog>
  );
}
