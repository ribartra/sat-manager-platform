"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { PanelLeftClose, PanelLeftOpen, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { filterExtractedTests, type ExtractedTestRow, type SetSectionFilter, type SetTypeFilter } from "@/lib/ingest-sets";

interface ExtractedTestRailProps {
  rows: ExtractedTestRow[];
  batchId: string;
  // The file currently open in the workspace; its Extracted Test is highlighted.
  currentFileId: string;
  // Link-mode (default): each Extracted Test navigates to its primary file's review page.
  // Select-mode: pass onSelect to keep selection in-place (used inside the wizard
  // Review modal, where navigating away would close the modal).
  onSelect?: (row: ExtractedTestRow) => void;
  /** Offers the hide button (default). Off where hiding cannot give the space back to the page. */
  collapsible?: boolean;
}

const SECTION_TABS: { value: SetSectionFilter; label: string }[] = [
  { value: "ALL", label: "All" },
  { value: "RW", label: "R&W" },
  { value: "MATH", label: "Math" },
];

function sectionLabel(section: string | null) {
  if (section === "MATH") return "Math";
  if (section === "RW") return "R&W";
  return section;
}

// Slim completeness bar: green complete · amber attention · red needs review.
function CompletenessBar({ row }: { row: ExtractedTestRow }) {
  const total = row.total || 1;
  // Keep a single flagged question visible instead of a hairline lost in green.
  const seg = (n: number, cls: string) =>
    n > 0 ? <span className={cls} style={{ width: `${Math.max((n / total) * 100, 6)}%`, minWidth: 4 }} /> : null;
  return (
    <span className="mt-1 flex h-1.5 w-full overflow-hidden rounded-full bg-gray-100" title={`${row.complete} complete · ${row.attention} attention · ${row.needsReview} review`}>
      {seg(row.complete, "bg-emerald-500")}
      {seg(row.attention, "bg-amber-500")}
      {seg(row.needsReview, "bg-rose-500")}
    </span>
  );
}

// Extracted Test navigation rail shown inside the per-file review workspace and
// the dashboard Review modal. An Extracted Test is the group of files that form
// one staging set; selecting one lists that set's questions. Mirrors /sets filters.
export function ExtractedTestRail({ rows, batchId, currentFileId, onSelect, collapsible = true }: ExtractedTestRailProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<SetTypeFilter>("ALL");
  const [sectionFilter, setSectionFilter] = useState<SetSectionFilter>("ALL");
  const [onlyPending, setOnlyPending] = useState(false);
  const activeRef = useRef<HTMLElement | null>(null);

  const filtered = useMemo(
    () => filterExtractedTests(rows, { query, type: typeFilter, section: sectionFilter, onlyPending }),
    [rows, query, typeFilter, sectionFilter, onlyPending],
  );

  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: "nearest" });
  }, []);

  const totalPending = useMemo(() => rows.reduce((acc, row) => acc + row.needsReview + row.attention, 0), [rows]);

  if (collapsed && collapsible) {
    return (
      <div className="flex flex-col items-center">
        <button
          type="button"
          onClick={() => setCollapsed(false)}
          className="inline-flex items-center gap-1 rounded-md border border-gray-300 px-2 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50"
          title="Show Extracted Tests"
        >
          <PanelLeftOpen className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <aside className="flex max-h-[calc(var(--app-vh)-2rem)] min-w-0 flex-col rounded-md border border-gray-200 bg-white">
      <div className="flex items-center justify-between gap-2 border-b border-gray-100 px-3 py-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-gray-900">Extracted Tests</p>
          <p className="text-xs text-gray-400">
            {filtered.length} of {rows.length}
            {totalPending > 0 ? ` · ${totalPending} to review` : ""}
          </p>
        </div>
        {collapsible && (
          <button
            type="button"
            onClick={() => setCollapsed(true)}
            className="rounded-md border border-gray-200 p-1.5 text-gray-500 hover:bg-gray-50"
            title="Hide Extracted Tests"
          >
            <PanelLeftClose className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="space-y-2 border-b border-gray-100 p-3">
        <div className="flex flex-wrap gap-1">
          {SECTION_TABS.map((tab) => (
            <button
              key={tab.value}
              type="button"
              onClick={() => setSectionFilter(tab.value)}
              className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                sectionFilter === tab.value ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search Extracted Test…"
            className="h-8 pl-8 text-xs"
          />
        </div>
        <select
          value={typeFilter}
          onChange={(event) => setTypeFilter(event.target.value as SetTypeFilter)}
          className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-xs"
        >
          <option value="ALL">All types</option>
          <option value="PRACTICE_SET">Practice sets</option>
          <option value="FULL_PRACTICE_TEST">Full practice tests</option>
        </select>
        <label className="flex items-center gap-2 text-xs text-gray-700">
          <Checkbox
            checked={onlyPending}
            onChange={(event) => setOnlyPending(event.target.checked)}
            className="h-3.5 w-3.5 rounded border-gray-300"
          />
          Only with pending items
        </label>
      </div>

      <div className="min-h-0 flex-1 divide-y divide-gray-50 overflow-y-auto">
        {filtered.map((row) => {
          const active = row.fileIds.includes(currentFileId);
          const className = `block w-full text-left px-3 py-2.5 text-sm transition-colors ${
            active ? "bg-blue-50 ring-1 ring-inset ring-blue-200" : "hover:bg-gray-50"
          }`;
          const pending = row.needsReview + row.attention;
          const inner = (
            <>
              <p className={`truncate font-medium ${active ? "text-blue-800" : "text-gray-900"}`} title={row.title}>
                {row.title}
              </p>
              <div className="mt-1 flex flex-wrap items-center gap-1">
                {row.section && <Badge variant="default">{sectionLabel(row.section)}</Badge>}
                {row.difficulty && <Badge variant="default">{row.difficulty}</Badge>}
                <span className="text-xs text-gray-400">{row.total} Q</span>
                <span className="text-xs text-gray-400">{row.files.length} files</span>
                {row.needsReview > 0 && <Badge variant="warning">{row.needsReview} review</Badge>}
                {row.needsReview === 0 && row.attention > 0 && <Badge variant="warning">{row.attention} attention</Badge>}
                {pending === 0 && row.total > 0 && <Badge variant="success">Complete</Badge>}
              </div>
              <CompletenessBar row={row} />
            </>
          );
          if (onSelect) {
            return (
              <button
                key={row.key}
                type="button"
                ref={active ? (el) => { activeRef.current = el; } : undefined}
                onClick={() => onSelect(row)}
                className={className}
                aria-current={active ? "true" : undefined}
              >
                {inner}
              </button>
            );
          }
          return (
            <Link
              key={row.key}
              ref={active ? (el) => { activeRef.current = el; } : undefined}
              href={`/admin/import/ai/${batchId}/files/${row.primaryFileId}`}
              className={className}
              aria-current={active ? "true" : undefined}
            >
              {inner}
            </Link>
          );
        })}
        {filtered.length === 0 && (
          <p className="px-3 py-8 text-center text-xs text-gray-400">No Extracted Tests match this filter.</p>
        )}
      </div>
    </aside>
  );
}
