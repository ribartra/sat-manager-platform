"use client";

import { Breadcrumbs } from "@/components/sat/breadcrumbs";
import { Checkbox } from "@/components/ui/checkbox";
import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronRight, ScissorsSquare, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PageHeader, PageShell } from "@/components/sat";
import { HeaderActions } from "@/components/sat/header-actions";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { FilterBar, FilterField } from "@/components/sat/filter-bar";
import {
  filterExtractedTests,
  type ExtractedTestRow,
  type FieldState,
  type QuestionStatusRow,
  type SetSectionFilter,
  type SetTypeFilter,
} from "@/lib/ingest-sets";

export type { ExtractedTestRow };

interface SetsIndexClientProps {
  rows: ExtractedTestRow[];
  batchId: string;
  batches: { id: string; name: string }[];
}

const SECTION_TABS: { value: SetSectionFilter; label: string }[] = [
  { value: "ALL", label: "All" },
  { value: "RW", label: "R&W" },
  { value: "MATH", label: "Math" },
];

const ROLE_LABEL: Record<string, string> = { QUESTION: "Questions", ANSWER: "Answers", EXPLANATION: "Explanations", OTHER: "Other" };

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
  const title = `${label}: ${state === "na" ? "n/a" : state === "ok" ? "ok" : state === "info" ? "note" : state === "warn" ? "attention" : "missing"}`;
  return (
    <span className="inline-flex items-center gap-1 text-[11px] text-gray-500" title={title}>
      <span className={`h-2 w-2 rounded-full ${DOT[state]}`} />
      {label}
    </span>
  );
}

function CompletenessBar({ row }: { row: ExtractedTestRow }) {
  const total = row.total || 1;
  // A single flagged question must stay visible: clamp each present segment to a
  // minimum width so a mostly-green bar can't hide one "review" item and read as done.
  const seg = (n: number, cls: string) =>
    n > 0 ? <span className={cls} style={{ width: `${Math.max((n / total) * 100, 6)}%`, minWidth: 4 }} /> : null;
  return (
    <span className="flex h-2 w-full min-w-24 overflow-hidden rounded-full bg-gray-100">
      {seg(row.complete, "bg-emerald-500")}
      {seg(row.attention, "bg-amber-500")}
      {seg(row.needsReview, "bg-rose-500")}
    </span>
  );
}

// Worst-state accent so a whole Extracted Test row reads as its true status at a glance
// (rose if any needs review, amber if any attention, emerald only when fully complete).
function worstLevel(row: ExtractedTestRow): "crit" | "warn" | "ok" {
  return row.needsReview > 0 ? "crit" : row.attention > 0 ? "warn" : "ok";
}
const STRIPE: Record<"crit" | "warn" | "ok", string> = {
  crit: "border-l-rose-500",
  warn: "border-l-amber-500",
  ok: "border-l-emerald-500",
};

function statusPill(level: QuestionStatusRow["level"]) {
  if (level === "crit") return <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[11px] font-semibold text-rose-700">Review</span>;
  if (level === "warn") return <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-700">Attention</span>;
  return <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">Complete</span>;
}

function QuestionTable({
  questions,
  batchId,
  reviewFileId,
}: {
  questions: QuestionStatusRow[];
  batchId: string;
  reviewFileId: string;
}) {
  if (questions.length === 0) return <p className="px-4 py-6 text-center text-xs text-gray-400">No questions in this Extracted Test.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px] text-xs">
        <thead>
          <tr className="border-b border-gray-100 bg-gray-50 text-left uppercase tracking-wide text-gray-400">
            <th className="px-3 py-2">Question</th>
            <th className="px-2 py-2">Type</th>
            <th className="px-2 py-2">Ans.</th>
            <th className="px-2 py-2">Stem</th>
            <th className="px-2 py-2">Stimulus</th>
            <th className="px-2 py-2">Options</th>
            <th className="px-2 py-2">Expl.</th>
            <th className="px-2 py-2">Status</th>
            <th className="px-3 py-2">Notes</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {questions.map((q) => (
            <tr key={q.candidateId} className={q.level === "crit" ? "bg-rose-50/50" : q.level === "warn" ? "bg-amber-50/40" : ""}>
              <td className="whitespace-nowrap px-3 py-1.5 font-mono font-semibold text-gray-800">
                <Link
                  href={`/admin/import/ai/${batchId}/files/${reviewFileId}?candidate=${q.candidateId}`}
                  className="text-blue-700 hover:underline"
                >
                  #{q.questionNumber ?? "?"} <span className="font-normal text-gray-400">M{q.moduleLabel ?? "?"}</span>
                </Link>
                {q.promoted && <span className="ml-1 text-emerald-500" title="Promovida a oficial">●</span>}
              </td>
              <td className="px-2 py-1.5"><span className={`rounded px-1.5 py-0.5 font-mono ${q.type === "NUMERIC" ? "bg-sky-100 text-sky-700" : "bg-gray-100 text-gray-600"}`}>{q.type === "NUMERIC" ? "Numeric" : "Multiple Choice"}</span></td>
              <td className={`px-2 py-1.5 font-mono ${q.answer ? "text-gray-800" : "text-rose-600"}`}>{q.answer || "—"}</td>
              <td className="px-2 py-1.5"><FieldDot state={q.fields.stem} label="" /></td>
              <td className="px-2 py-1.5"><FieldDot state={q.fields.stimulus} label="" /></td>
              <td className="px-2 py-1.5"><FieldDot state={q.fields.options} label="" /></td>
              <td className="px-2 py-1.5"><FieldDot state={q.fields.explanation} label="" /></td>
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
    () => filterExtractedTests(rows, { query, type: typeFilter, section: sectionFilter, onlyPending }),
    [rows, query, typeFilter, sectionFilter, onlyPending],
  );

  const totals = useMemo(
    () =>
      filtered.reduce(
        (acc, row) => {
          acc.total += row.total;
          acc.needsReview += row.needsReview;
          acc.attention += row.attention;
          acc.complete += row.complete;
          return acc;
        },
        { total: 0, needsReview: 0, attention: 0, complete: 0 },
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
    <PageShell className="space-y-6">
      <Breadcrumbs items={[{ label: "Home", href: "/teacher" }, { label: "Admin" }, { label: "AI Import", href: `/admin/import/ai?batch=${batchId}` }, { label: "Extracted Tests" }]} />
      <PageHeader
        title="Extracted Tests to review"
        description={
          <>
            An Extracted Test groups the source files for one set — questions plus answers and/or explanations. Expand a row to see
            each question status (stem, stimulus, options, answer, explanation) and use <strong>Review / crop</strong>
            to open the question file.
          </>
        }
        actions={batches.length > 1 ? (
          <HeaderActions>
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
          </HeaderActions>
        ) : undefined}
      />

      <div className="grid gap-3 sm:grid-cols-4">
        <Card padding="md">
          <p className="text-xs uppercase text-gray-400">Extracted Tests</p>
          <p className="mt-1 text-2xl font-semibold text-gray-900">{filtered.length}</p>
        </Card>
        <Card padding="md">
          <p className="text-xs uppercase text-gray-400">Questions</p>
          <p className="mt-1 text-2xl font-semibold text-gray-900">{totals.total}</p>
        </Card>
        {/* Opens the list filtered to what still needs review (same as the "pending only" box). */}
        <Card
          as="button"
          padding="md"
          aria-pressed={onlyPending}
          title="Show only the Extracted Tests that need review"
          onClick={() => setOnlyPending(true)}
          className="text-left"
        >
          <p className="text-xs uppercase text-gray-400">Needs review</p>
          <p className="mt-1 text-2xl font-semibold text-rose-600">{totals.needsReview}</p>
        </Card>
        <Card padding="md">
          <p className="text-xs uppercase text-gray-400">Attention</p>
          <p className="mt-1 text-2xl font-semibold text-amber-600">{totals.attention}</p>
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

      <FilterBar className="mb-0">
        <FilterField label="Search" htmlFor="sets-q" className="@md:flex-[2]">
          <div className="relative">
            <Search size={14} aria-hidden className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <Input id="sets-q" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search Extracted Test, file, section, or test…" className="pl-8" />
          </div>
        </FilterField>
        <FilterField label="Type" htmlFor="sets-type">
          <Select id="sets-type" value={typeFilter} onChange={(event) => setTypeFilter(event.target.value as SetTypeFilter)}>
            <option value="ALL">All types</option>
            <option value="PRACTICE_SET">Practice sets</option>
            <option value="FULL_PRACTICE_TEST">Full practice tests</option>
          </Select>
        </FilterField>
        <label className="flex h-[38px] items-center gap-2 text-sm text-gray-700">
          <Checkbox checked={onlyPending} onChange={(event) => setOnlyPending(event.target.checked)} className="h-4 w-4 rounded border-gray-300" />
          Only with pending items
        </label>
      </FilterBar>

      <div className="space-y-3">
        {filtered.map((row) => {
          const open = expanded.has(row.key);
          const pending = row.needsReview + row.attention;
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
                      <Badge variant="default">{row.total} questions</Badge>
                      {row.promoted > 0 && <Badge variant="success">{row.promoted} oficiales</Badge>}
                    </span>
                    <span className="mt-1 flex flex-wrap gap-1.5 text-[11px] text-gray-400">
                      {row.files.map((f) => (
                        <span key={f.id} title={`${ROLE_LABEL[f.role]} · ${f.nQ} questions · ${f.nA} answers`} className="inline-flex items-center gap-1 rounded border border-gray-200 px-1.5 py-0.5">
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
                    <span className="text-emerald-600">{row.complete} ok</span> · <span className="text-amber-600">{row.attention} at.</span> · <span className="text-rose-600">{row.needsReview} rev.</span>
                  </span>
                </div>
                <div className="shrink-0">
                  {pending > 0 ? <Badge variant="warning">{pending} pend.</Badge> : <Badge variant="success">Completo</Badge>}
                </div>
                <Link
                  href={`/admin/import/ai/${row.batchId}/files/${row.primaryFileId}`}
                  className="inline-flex shrink-0 items-center gap-1 rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                >
                  <ScissorsSquare className="h-3.5 w-3.5" /> Review / crop
                </Link>
              </div>
              {open && (
                <div className="border-t border-gray-100 bg-gray-50/50">
                  <QuestionTable questions={row.questions} batchId={row.batchId} reviewFileId={row.primaryFileId} />
                </div>
              )}
            </Card>
          );
        })}
        {filtered.length === 0 && (
          <Card padding="lg"><p className="text-center text-sm text-gray-400">No Extracted Tests match this filter.</p></Card>
        )}
      </div>
    </PageShell>
  );
}
