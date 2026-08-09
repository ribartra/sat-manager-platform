"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ScissorsSquare, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { filterSetRows, type SetRow, type SetSectionFilter, type SetTypeFilter } from "@/lib/ingest-sets";

export type { SetRow };

interface SetsIndexClientProps {
  rows: SetRow[];
  batchId: string;
  batches: { id: string; name: string }[];
}

type TypeFilter = SetTypeFilter;
type SectionFilter = SetSectionFilter;

const SECTION_TABS: { value: SectionFilter; label: string }[] = [
  { value: "ALL", label: "Todas" },
  { value: "RW", label: "R&W" },
  { value: "MATH", label: "Math" },
];

function contentLabel(contentType: string) {
  return contentType === "FULL_PRACTICE_TEST" ? "Full test" : "Practice set";
}

function sectionLabel(section: string | null) {
  if (section === "MATH") return "Math";
  if (section === "RW") return "R&W";
  return section;
}

export function SetsIndexClient({ rows, batchId, batches }: SetsIndexClientProps) {
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("ALL");
  const [sectionFilter, setSectionFilter] = useState<SectionFilter>("ALL");
  const [onlyPending, setOnlyPending] = useState(true);

  const filtered = useMemo(
    () => filterSetRows(rows, { query, type: typeFilter, section: sectionFilter, onlyPending }),
    [rows, query, typeFilter, sectionFilter, onlyPending],
  );

  const totals = useMemo(() => {
    return filtered.reduce(
      (acc, row) => {
        acc.pending += row.pending;
        acc.sinResp += row.sinResp;
        acc.faltanOpt += row.faltanOpt;
        acc.total += row.total;
        return acc;
      },
      { pending: 0, sinResp: 0, faltanOpt: 0, total: 0 },
    );
  }, [filtered]);

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <Link href={`/admin/import/ai?batch=${batchId}`} className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline">
            <ArrowLeft className="h-3.5 w-3.5" /> Volver al lote
          </Link>
          <h1 className="mt-2 text-2xl font-semibold text-gray-900">Conjuntos por revisar</h1>
          <p className="mt-1 text-sm text-gray-500">
            Cada conjunto es un documento de ingesta. Filtra, abre el detalle y usa <strong>Recortar desde el PDF</strong> en
            cualquier página para asignar la imagen del enunciado o de las alternativas.
          </p>
        </div>
        {batches.length > 1 && (
          <select
            value={batchId}
            onChange={(event) => {
              window.location.href = `/admin/import/ai/sets?batch=${event.target.value}`;
            }}
            className="max-w-72 rounded-md border border-gray-300 px-3 py-2 text-sm"
          >
            {batches.map((batch) => (
              <option key={batch.id} value={batch.id}>
                {batch.name}
              </option>
            ))}
          </select>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        <Card padding="md">
          <p className="text-xs uppercase text-gray-400">Conjuntos</p>
          <p className="mt-1 text-2xl font-semibold text-gray-900">{filtered.length}</p>
        </Card>
        <Card padding="md">
          <p className="text-xs uppercase text-gray-400">Preguntas pendientes</p>
          <p className="mt-1 text-2xl font-semibold text-gray-900">{totals.pending}</p>
        </Card>
        <Card padding="md">
          <p className="text-xs uppercase text-gray-400">Sin respuesta</p>
          <p className="mt-1 text-2xl font-semibold text-amber-700">{totals.sinResp}</p>
        </Card>
        <Card padding="md">
          <p className="text-xs uppercase text-gray-400">Faltan opciones</p>
          <p className="mt-1 text-2xl font-semibold text-amber-700">{totals.faltanOpt}</p>
        </Card>
      </div>

      <div className="flex flex-wrap items-center gap-1 border-b border-gray-200">
        {SECTION_TABS.map((tab) => (
          <button
            key={tab.value}
            type="button"
            onClick={() => setSectionFilter(tab.value)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
              sectionFilter === tab.value
                ? "border-blue-600 text-blue-700"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-64 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar conjunto, ruta, sección o test…"
            className="pl-9"
          />
        </div>
        <select
          value={typeFilter}
          onChange={(event) => setTypeFilter(event.target.value as TypeFilter)}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm"
        >
          <option value="ALL">Todos los tipos</option>
          <option value="PRACTICE_SET">Practice sets</option>
          <option value="FULL_PRACTICE_TEST">Full practice tests</option>
        </select>
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input type="checkbox" checked={onlyPending} onChange={(event) => setOnlyPending(event.target.checked)} className="h-4 w-4 rounded border-gray-300" />
          Solo con pendientes
        </label>
      </div>

      <Card padding="none" className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50 text-left text-xs uppercase text-gray-400">
                <th className="px-4 py-3">Conjunto</th>
                <th className="px-3 py-3">Tipo</th>
                <th className="px-3 py-3 text-right">Preguntas</th>
                <th className="px-3 py-3 text-right">Sin resp.</th>
                <th className="px-3 py-3 text-right">Faltan opc.</th>
                <th className="px-3 py-3 text-right">Pendientes</th>
                <th className="px-4 py-3 text-right">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((row) => (
                <tr key={row.sourceFileId} className="hover:bg-blue-50/40">
                  <td className="max-w-sm px-4 py-3">
                    <p className="truncate font-medium text-gray-900" title={row.title}>{row.title}</p>
                    <p className="truncate text-xs text-gray-400" title={row.relativePath}>{row.relativePath}</p>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {row.section && <Badge variant="default">{sectionLabel(row.section)}</Badge>}
                      {row.difficulty && <Badge variant="default">{row.difficulty}</Badge>}
                      {row.testNumber && <Badge variant="info">Test {row.testNumber}</Badge>}
                      {row.promoted > 0 && <Badge variant="success">{row.promoted} oficiales</Badge>}
                    </div>
                  </td>
                  <td className="px-3 py-3 text-xs text-gray-500">{contentLabel(row.contentType)}</td>
                  <td className="px-3 py-3 text-right text-gray-700">{row.total}</td>
                  <td className="px-3 py-3 text-right text-gray-700">{row.sinResp || "—"}</td>
                  <td className="px-3 py-3 text-right text-gray-700">{row.faltanOpt || "—"}</td>
                  <td className="px-3 py-3 text-right">
                    {row.pending > 0 ? (
                      <Badge variant="warning">{row.pending}</Badge>
                    ) : (
                      <Badge variant="success">Completo</Badge>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/admin/import/ai/${row.batchId}/files/${row.sourceFileId}`}
                      className="inline-flex items-center gap-1 rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                    >
                      <ScissorsSquare className="h-3.5 w-3.5" /> Revisar / recortar
                    </Link>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-sm text-gray-400">
                    No hay conjuntos que coincidan con el filtro.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
