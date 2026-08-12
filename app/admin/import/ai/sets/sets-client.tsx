"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ChevronDown, ChevronRight, ScissorsSquare, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  filterConjuntos,
  type ConjuntoRow,
  type FieldState,
  type QuestionStatusRow,
  type SetSectionFilter,
  type SetTypeFilter,
} from "@/lib/ingest-sets";

export type { ConjuntoRow };

interface SetsIndexClientProps {
  rows: ConjuntoRow[];
  batchId: string;
  batches: { id: string; name: string }[];
}

const SECTION_TABS: { value: SetSectionFilter; label: string }[] = [
  { value: "ALL", label: "Todas" },
  { value: "RW", label: "R&W" },
  { value: "MATH", label: "Math" },
];

const ROLE_LABEL: Record<string, string> = { QUESTION: "Preguntas", ANSWER: "Respuestas", EXPLANATION: "Explicaciones", OTHER: "Otro" };

function contentLabel(contentType: string) {
  return contentType === "FULL_PRACTICE_TEST" ? "Full test" : "Practice set";
}
function sectionLabel(section: string | null) {
  if (section === "MATH") return "Math";
  if (section === "RW") return "R&W";
  return section;
}

const DOT: Record<FieldState, string> = {
  ok: "bg-emerald-500",
  warn: "bg-amber-500",
  crit: "bg-rose-500",
  info: "bg-sky-500",
  na: "bg-gray-200",
};
function FieldDot({ state, label }: { state: FieldState; label: string }) {
  const title = `${label}: ${state === "na" ? "no aplica" : state === "ok" ? "ok" : state === "info" ? "nota" : state === "warn" ? "atención" : "falta"}`;
  return (
    <span className="inline-flex items-center gap-1 text-[11px] text-gray-500" title={title}>
      <span className={`h-2 w-2 rounded-full ${DOT[state]}`} />
      {label}
    </span>
  );
}

function CompletenessBar({ row }: { row: ConjuntoRow }) {
  const total = row.total || 1;
  // A single flagged question must stay visible: clamp each present segment to a
  // minimum width so a mostly-green bar can't hide one "revisar" and read as done.
  const seg = (n: number, cls: string) =>
    n > 0 ? <span className={cls} style={{ width: `${Math.max((n / total) * 100, 6)}%`, minWidth: 4 }} /> : null;
  return (
    <span className="flex h-2 w-full min-w-24 overflow-hidden rounded-full bg-gray-100">
      {seg(row.complete, "bg-emerald-500")}
      {seg(row.atencion, "bg-amber-500")}
      {seg(row.revisar, "bg-rose-500")}
    </span>
  );
}

// Worst-state accent so a whole conjunto row reads as its true status at a glance
// (rose if any revisar, amber if any atención, emerald only when fully complete).
function worstLevel(row: ConjuntoRow): "crit" | "warn" | "ok" {
  return row.revisar > 0 ? "crit" : row.atencion > 0 ? "warn" : "ok";
}
const STRIPE: Record<"crit" | "warn" | "ok", string> = {
  crit: "border-l-rose-500",
  warn: "border-l-amber-500",
  ok: "border-l-emerald-500",
};

function statusPill(level: QuestionStatusRow["level"]) {
  if (level === "crit") return <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[11px] font-semibold text-rose-700">Revisar</span>;
  if (level === "warn") return <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-700">Atención</span>;
  return <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">Completa</span>;
}

function QuestionTable({ questions }: { questions: QuestionStatusRow[] }) {
  if (questions.length === 0) return <p className="px-4 py-6 text-center text-xs text-gray-400">Sin preguntas en este conjunto.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px] text-xs">
        <thead>
          <tr className="border-b border-gray-100 bg-gray-50 text-left uppercase tracking-wide text-gray-400">
            <th className="px-3 py-2">Pregunta</th>
            <th className="px-2 py-2">Tipo</th>
            <th className="px-2 py-2">Resp.</th>
            <th className="px-2 py-2">Enunciado</th>
            <th className="px-2 py-2">Estímulo</th>
            <th className="px-2 py-2">Opciones</th>
            <th className="px-2 py-2">Expl.</th>
            <th className="px-2 py-2">Estado</th>
            <th className="px-3 py-2">Observaciones</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {questions.map((q) => (
            <tr key={q.candidateId} className={q.level === "crit" ? "bg-rose-50/50" : q.level === "warn" ? "bg-amber-50/40" : ""}>
              <td className="whitespace-nowrap px-3 py-1.5 font-mono font-semibold text-gray-800">
                #{q.questionNumber ?? "?"} <span className="font-normal text-gray-400">M{q.moduleLabel ?? "?"}</span>
                {q.promoted && <span className="ml-1 text-emerald-500" title="Promovida a oficial">●</span>}
              </td>
              <td className="px-2 py-1.5"><span className={`rounded px-1.5 py-0.5 font-mono ${q.type === "NUMERIC" ? "bg-sky-100 text-sky-700" : "bg-gray-100 text-gray-600"}`}>{q.type === "NUMERIC" ? "NUM" : "MC"}</span></td>
              <td className={`px-2 py-1.5 font-mono ${q.answer ? "text-gray-800" : "text-rose-600"}`}>{q.answer || "—"}</td>
              <td className="px-2 py-1.5"><FieldDot state={q.fields.enunciado} label="" /></td>
              <td className="px-2 py-1.5"><FieldDot state={q.fields.estimulo} label="" /></td>
              <td className="px-2 py-1.5"><FieldDot state={q.fields.opciones} label="" /></td>
              <td className="px-2 py-1.5"><FieldDot state={q.fields.explicacion} label="" /></td>
              <td className="px-2 py-1.5">{statusPill(q.level)}</td>
              <td className="px-3 py-1.5 text-gray-500">{q.notes.join(" · ")}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function SetsIndexClient({ rows, batchId, batches }: SetsIndexClientProps) {
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<SetTypeFilter>("ALL");
  const [sectionFilter, setSectionFilter] = useState<SetSectionFilter>("ALL");
  const [onlyPending, setOnlyPending] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const filtered = useMemo(
    () => filterConjuntos(rows, { query, type: typeFilter, section: sectionFilter, onlyPending }),
    [rows, query, typeFilter, sectionFilter, onlyPending],
  );

  const totals = useMemo(
    () =>
      filtered.reduce(
        (acc, row) => {
          acc.total += row.total;
          acc.revisar += row.revisar;
          acc.atencion += row.atencion;
          acc.complete += row.complete;
          return acc;
        },
        { total: 0, revisar: 0, atencion: 0, complete: 0 },
      ),
    [filtered],
  );

  function toggle(key: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <Link href={`/admin/import/ai?batch=${batchId}`} className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline">
            <ArrowLeft className="h-3.5 w-3.5" /> Volver al lote
          </Link>
          <h1 className="mt-2 text-2xl font-semibold text-gray-900">Conjuntos por revisar</h1>
          <p className="mt-1 text-sm text-gray-500">
            Un conjunto agrupa los archivos que forman un set — preguntas + respuestas y/o explicaciones. Expande uno para ver
            el estado de cada pregunta (enunciado, estímulo, opciones, respuesta, explicación) y usa <strong>Revisar / recortar</strong>
            para abrir el archivo de preguntas.
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
          <p className="text-xs uppercase text-gray-400">Preguntas</p>
          <p className="mt-1 text-2xl font-semibold text-gray-900">{totals.total}</p>
        </Card>
        <Card padding="md">
          <p className="text-xs uppercase text-gray-400">A revisar</p>
          <p className="mt-1 text-2xl font-semibold text-rose-600">{totals.revisar}</p>
        </Card>
        <Card padding="md">
          <p className="text-xs uppercase text-gray-400">Atención</p>
          <p className="mt-1 text-2xl font-semibold text-amber-600">{totals.atencion}</p>
        </Card>
      </div>

      <div className="flex flex-wrap items-center gap-1 border-b border-gray-200">
        {SECTION_TABS.map((tab) => (
          <button
            key={tab.value}
            type="button"
            onClick={() => setSectionFilter(tab.value)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
              sectionFilter === tab.value ? "border-blue-600 text-blue-700" : "border-transparent text-gray-500 hover:text-gray-700"
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
            placeholder="Buscar conjunto, archivo, sección o test…"
            className="pl-9"
          />
        </div>
        <select
          value={typeFilter}
          onChange={(event) => setTypeFilter(event.target.value as SetTypeFilter)}
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

      <div className="space-y-3">
        {filtered.map((row) => {
          const open = expanded.has(row.key);
          const pending = row.revisar + row.atencion;
          return (
            <Card key={row.key} padding="none" className={`overflow-hidden border-l-4 ${STRIPE[worstLevel(row)]}`}>
              <div className="flex flex-wrap items-center gap-4 px-4 py-3">
                <button type="button" onClick={() => toggle(row.key)} className="flex min-w-0 flex-1 items-start gap-2 text-left" aria-expanded={open}>
                  {open ? <ChevronDown className="mt-1 h-4 w-4 shrink-0 text-gray-400" /> : <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-gray-400" />}
                  <span className="min-w-0">
                    <span className="block truncate font-semibold text-gray-900" title={row.title}>{row.title}</span>
                    <span className="mt-1 flex flex-wrap items-center gap-1">
                      <Badge variant="default">{contentLabel(row.contentType)}</Badge>
                      {row.difficulty && <Badge variant="default">{row.difficulty}</Badge>}
                      {row.testNumber && <Badge variant="info">Test {row.testNumber}</Badge>}
                      {row.section && <Badge variant="default">{sectionLabel(row.section)}</Badge>}
                      <Badge variant="default">{row.total} preguntas</Badge>
                      {row.promoted > 0 && <Badge variant="success">{row.promoted} oficiales</Badge>}
                    </span>
                    <span className="mt-1 flex flex-wrap gap-1.5 text-[11px] text-gray-400">
                      {row.files.map((f) => (
                        <span key={f.id} title={`${ROLE_LABEL[f.role]} · ${f.nQ} preguntas · ${f.nA} respuestas`} className="inline-flex items-center gap-1 rounded border border-gray-200 px-1.5 py-0.5">
                          <span className={`h-1.5 w-1.5 rounded-full ${f.role === "QUESTION" ? "bg-blue-500" : f.role === "ANSWER" ? "bg-emerald-500" : f.role === "EXPLANATION" ? "bg-violet-500" : "bg-gray-300"}`} />
                          {f.name}
                        </span>
                      ))}
                    </span>
                  </span>
                </button>
                <div className="flex w-40 shrink-0 flex-col gap-1">
                  <CompletenessBar row={row} />
                  <span className="text-[11px] text-gray-500">
                    <span className="text-emerald-600">{row.complete} ok</span> · <span className="text-amber-600">{row.atencion} at.</span> · <span className="text-rose-600">{row.revisar} rev.</span>
                  </span>
                </div>
                <div className="shrink-0">
                  {pending > 0 ? <Badge variant="warning">{pending} pend.</Badge> : <Badge variant="success">Completo</Badge>}
                </div>
                <Link
                  href={`/admin/import/ai/${row.batchId}/files/${row.primaryFileId}`}
                  className="inline-flex shrink-0 items-center gap-1 rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                >
                  <ScissorsSquare className="h-3.5 w-3.5" /> Revisar / recortar
                </Link>
              </div>
              {open && <div className="border-t border-gray-100 bg-gray-50/50"><QuestionTable questions={row.questions} /></div>}
            </Card>
          );
        })}
        {filtered.length === 0 && (
          <Card padding="lg"><p className="text-center text-sm text-gray-400">No hay conjuntos que coincidan con el filtro.</p></Card>
        )}
      </div>
    </div>
  );
}
