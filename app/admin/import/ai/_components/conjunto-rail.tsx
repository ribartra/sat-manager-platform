"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { PanelLeftClose, PanelLeftOpen, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { filterSetRows, type SetRow, type SetSectionFilter, type SetTypeFilter } from "@/lib/ingest-sets";

interface ConjuntoRailProps {
  rows: SetRow[];
  batchId: string;
  currentFileId: string;
  // Link-mode (default): each conjunto navigates to its per-file review page.
  // Select-mode: pass onSelect to keep selection in-place (used inside the
  // wizard Review modal, where navigating away would close the modal).
  onSelect?: (sourceFileId: string) => void;
}

const SECTION_TABS: { value: SetSectionFilter; label: string }[] = [
  { value: "ALL", label: "Todas" },
  { value: "RW", label: "R&W" },
  { value: "MATH", label: "Math" },
];

function sectionLabel(section: string | null) {
  if (section === "MATH") return "Math";
  if (section === "RW") return "R&W";
  return section;
}

// Conjunto navigation rail shown inside the per-file review workspace. Mirrors
// the filters of the standalone /sets index (section tabs, type, solo-pendientes,
// search) so a reviewer can filter and jump between conjuntos without leaving the
// review view. Selecting a conjunto is a normal server navigation to another
// fileId — the workspace then lists that set's questions.
export function ConjuntoRail({ rows, batchId, currentFileId, onSelect }: ConjuntoRailProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<SetTypeFilter>("ALL");
  const [sectionFilter, setSectionFilter] = useState<SetSectionFilter>("ALL");
  const [onlyPending, setOnlyPending] = useState(false);
  const activeRef = useRef<HTMLElement | null>(null);

  const filtered = useMemo(
    () => filterSetRows(rows, { query, type: typeFilter, section: sectionFilter, onlyPending }),
    [rows, query, typeFilter, sectionFilter, onlyPending],
  );

  // Keep the conjunto being reviewed visible when the rail first renders.
  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: "nearest" });
  }, []);

  const totalPending = useMemo(() => rows.reduce((acc, row) => acc + row.pending, 0), [rows]);

  if (collapsed) {
    return (
      <div className="flex flex-col items-center">
        <button
          type="button"
          onClick={() => setCollapsed(false)}
          className="inline-flex items-center gap-1 rounded-md border border-gray-300 px-2 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50"
          title="Mostrar conjuntos"
        >
          <PanelLeftOpen className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <aside className="flex max-h-[calc(100vh-2rem)] flex-col rounded-md border border-gray-200 bg-white">
      <div className="flex items-center justify-between gap-2 border-b border-gray-100 px-3 py-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-gray-900">Conjuntos</p>
          <p className="text-xs text-gray-400">
            {filtered.length} de {rows.length}
            {totalPending > 0 ? ` · ${totalPending} pendientes` : ""}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setCollapsed(true)}
          className="rounded-md border border-gray-200 p-1.5 text-gray-500 hover:bg-gray-50"
          title="Ocultar conjuntos"
        >
          <PanelLeftClose className="h-4 w-4" />
        </button>
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
            placeholder="Buscar conjunto…"
            className="h-8 pl-8 text-xs"
          />
        </div>
        <select
          value={typeFilter}
          onChange={(event) => setTypeFilter(event.target.value as SetTypeFilter)}
          className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-xs"
        >
          <option value="ALL">Todos los tipos</option>
          <option value="PRACTICE_SET">Practice sets</option>
          <option value="FULL_PRACTICE_TEST">Full practice tests</option>
        </select>
        <label className="flex items-center gap-2 text-xs text-gray-700">
          <input
            type="checkbox"
            checked={onlyPending}
            onChange={(event) => setOnlyPending(event.target.checked)}
            className="h-3.5 w-3.5 rounded border-gray-300"
          />
          Solo con pendientes
        </label>
      </div>

      <div className="min-h-0 flex-1 divide-y divide-gray-50 overflow-y-auto">
        {filtered.map((row) => {
          const active = row.sourceFileId === currentFileId;
          const className = `block w-full text-left px-3 py-2.5 text-sm transition-colors ${
            active ? "bg-blue-50 ring-1 ring-inset ring-blue-200" : "hover:bg-gray-50"
          }`;
          const inner = (
            <>
              <p className={`truncate font-medium ${active ? "text-blue-800" : "text-gray-900"}`} title={row.title}>
                {row.title}
              </p>
              <div className="mt-1 flex flex-wrap items-center gap-1">
                {row.section && <Badge variant="default">{sectionLabel(row.section)}</Badge>}
                {row.difficulty && <Badge variant="default">{row.difficulty}</Badge>}
                {row.testNumber && <Badge variant="info">Test {row.testNumber}</Badge>}
                {row.pending > 0 ? (
                  <Badge variant="warning">{row.pending} pend.</Badge>
                ) : (
                  <Badge variant="success">Completo</Badge>
                )}
              </div>
            </>
          );
          if (onSelect) {
            return (
              <button
                key={row.sourceFileId}
                type="button"
                ref={active ? (el) => { activeRef.current = el; } : undefined}
                onClick={() => onSelect(row.sourceFileId)}
                className={className}
                aria-current={active ? "true" : undefined}
              >
                {inner}
              </button>
            );
          }
          return (
            <Link
              key={row.sourceFileId}
              ref={active ? (el) => { activeRef.current = el; } : undefined}
              href={`/admin/import/ai/${batchId}/files/${row.sourceFileId}`}
              className={className}
              aria-current={active ? "true" : undefined}
            >
              {inner}
            </Link>
          );
        })}
        {filtered.length === 0 && (
          <p className="px-3 py-8 text-center text-xs text-gray-400">No hay conjuntos que coincidan con el filtro.</p>
        )}
      </div>
    </aside>
  );
}
