"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { useConfirm } from "@/components/sat/confirm-dialog";
import { PageHeader } from "@/components/sat";
import { apiFetch } from "@/lib/api-client";
import { notify } from "@/lib/notify-ui";
import { difficultyLabel, fullTestStatusLabel, practiceSetStatusLabel } from "@/lib/domain-meta";
import { practiceAreaLabel, type PracticeAreaCode } from "@/lib/practice-area";

export type ContentRow = {
  id: string;
  name: string;
  detail: string;
  /** Section of a Practice Set; "" for Tests. */
  area: PracticeAreaCode | "";
  difficulty: string | null;
  status: string;
  sourceId: string;
  sourceName: string;
};

type SourceInfo = { id: string; name: string; active: boolean; forPracticeSets: boolean; forTests: boolean };

/**
 * Source master detail: edit the source and associate Practice Sets / Tests with it. "This source"
 * lists what it has (and can move it elsewhere); "Add" lists the rest of the content to bring here.
 */
export function SourceDetailClient({
  source,
  sources,
  practiceSets,
  tests,
}: {
  source: SourceInfo;
  sources: SourceInfo[];
  practiceSets: ContentRow[];
  tests: ContentRow[];
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const [name, setName] = useState(source.name);
  const [busy, setBusy] = useState(false);

  async function save(json: Record<string, unknown>, success: string) {
    setBusy(true);
    try {
      await apiFetch(`/api/admin/sources/${source.id}`, { method: "PATCH", json });
      notify.success(success);
      router.refresh();
    } catch (error) {
      notify.error(error);
    } finally {
      setBusy(false);
    }
  }

  /** Associate the ids with `targetId` (this source, or another one when moving out). */
  async function assign(targetId: string, kind: "practiceSetIds" | "testIds", ids: string[]) {
    const target = sources.find((s) => s.id === targetId);
    if (!target || ids.length === 0) return false;
    const ok = await confirm({
      title: `Move ${ids.length} ${kind === "testIds" ? "test" : "practice set"}${ids.length === 1 ? "" : "s"} to ${target.name}?`,
      description: "Only the source changes: questions, assignments and attempts stay as they are.",
      confirmLabel: "Move",
    });
    if (!ok) return false;
    setBusy(true);
    try {
      await apiFetch(`/api/admin/sources/${targetId}/content`, { method: "POST", json: { [kind]: ids } });
      notify.success(`Moved to ${target.name}.`);
      router.refresh();
      return true;
    } catch (error) {
      notify.error(error);
      return false;
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title={source.name} />
      <Card padding="md" className="flex flex-wrap items-center gap-4">
        <form
          className="flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (name.trim() && name.trim() !== source.name) void save({ name: name.trim() }, "Source renamed.");
          }}
        >
          <Input value={name} onChange={(e) => setName(e.target.value)} aria-label="Source name" maxLength={80} className="max-w-xs text-sm" />
          <Button type="submit" size="sm" disabled={busy || !name.trim() || name.trim() === source.name}>Rename</Button>
        </form>
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <span className="text-gray-500">Used for</span>
          {([["forPracticeSets", "Practice Sets"], ["forTests", "Tests"]] as const).map(([key, label]) => (
            <label key={key} className="inline-flex items-center gap-1.5">
              <Checkbox checked={source[key]} disabled={busy} onChange={(e) => save({ [key]: e.target.checked }, `${label}: ${e.target.checked ? "yes" : "no"}.`)} />
              {label}
            </label>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Badge variant={source.active ? "success" : "default"}>{source.active ? "Active" : "Inactive"}</Badge>
          <Button size="sm" variant="secondary" disabled={busy} onClick={() => save({ active: !source.active }, source.active ? "Deactivated." : "Activated.")}>
            {source.active ? "Deactivate" : "Activate"}
          </Button>
        </div>
      </Card>

      {source.forPracticeSets || practiceSets.some((row) => row.sourceId === source.id) ? (
        <ContentSection
          title="Practice Sets"
          kind="practiceSetIds"
          source={source}
          targets={sources.filter((s) => s.forPracticeSets)}
          rows={practiceSets}
          canAdd={source.forPracticeSets}
          busy={busy}
          onAssign={assign}
        />
      ) : null}
      {source.forTests || tests.some((row) => row.sourceId === source.id) ? (
        <ContentSection
          title="Tests"
          kind="testIds"
          source={source}
          targets={sources.filter((s) => s.forTests)}
          rows={tests}
          canAdd={source.forTests}
          busy={busy}
          onAssign={assign}
        />
      ) : null}
      {!source.forPracticeSets && !source.forTests ? (
        <p className="text-sm text-gray-500">Mark what this source is used for to associate Practice Sets or Tests with it.</p>
      ) : null}
    </div>
  );
}

function ContentSection({
  title,
  kind,
  source,
  targets,
  rows,
  canAdd,
  busy,
  onAssign,
}: {
  title: string;
  kind: "practiceSetIds" | "testIds";
  source: SourceInfo;
  targets: SourceInfo[];
  rows: ContentRow[];
  canAdd: boolean;
  busy: boolean;
  onAssign: (targetId: string, kind: "practiceSetIds" | "testIds", ids: string[]) => Promise<boolean>;
}) {
  const own = rows.filter((row) => row.sourceId === source.id);
  const others = rows.filter((row) => row.sourceId !== source.id);
  const [selectedOwn, setSelectedOwn] = useState<Set<string>>(new Set());
  const [selectedOther, setSelectedOther] = useState<Set<string>>(new Set());
  const [moveTo, setMoveTo] = useState("");
  const [search, setSearch] = useState("");
  const [area, setArea] = useState("");
  const areas = [...new Set(others.map((row) => row.area))].filter((a): a is PracticeAreaCode => a !== "");
  const needle = search.trim().toLowerCase();
  const shownOthers = others.filter((row) => (!area || row.area === area) && (!needle || `${row.name} ${row.detail} ${row.sourceName}`.toLowerCase().includes(needle)));
  const toggle = (set: Set<string>, update: (next: Set<string>) => void, id: string) => {
    const next = new Set(set);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    update(next);
  };
  const moveTargets = targets.filter((t) => t.id !== source.id);

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold text-gray-900">
        {title} <span className="text-sm font-normal text-gray-500">· {own.length} in {source.name}</span>
      </h2>
      <Card padding="none">
        <RowList rows={own} selected={selectedOwn} onToggle={(id) => toggle(selectedOwn, setSelectedOwn, id)} empty={`No ${title.toLowerCase()} in ${source.name} yet.`} />
        {own.length > 0 && moveTargets.length > 0 ? (
          <div className="flex flex-wrap items-center gap-2 border-t border-gray-100 px-3 py-2 text-sm">
            <span className="text-gray-500">{selectedOwn.size} selected · Move to</span>
            <Select value={moveTo} onChange={(e) => setMoveTo(e.target.value)} aria-label="Move to source" className="h-8 w-auto text-sm">
              <option value="">Choose a source</option>
              {moveTargets.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </Select>
            <Button
              size="sm"
              variant="secondary"
              disabled={busy}
              disabledReason={!selectedOwn.size ? "Select at least one item." : !moveTo ? "Choose the source to move them to." : null}
              onClick={async () => {
                if (await onAssign(moveTo, kind, [...selectedOwn])) setSelectedOwn(new Set());
              }}
            >
              Move
            </Button>
          </div>
        ) : null}
      </Card>

      {canAdd ? (
        <details className="group rounded-[var(--sat-radius)] border border-[var(--sat-border)] bg-white">
          <summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold text-gray-800 [&::-webkit-details-marker]:hidden">
            + Add {title.toLowerCase()} from other sources <span className="font-normal text-gray-500">({others.length})</span>
          </summary>
          <div className="space-y-2 border-t border-gray-100 p-3">
            <div className="flex flex-wrap gap-2">
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Name, skill or source" aria-label={`Search ${title}`} className="max-w-xs text-sm" />
              {areas.length > 1 ? (
                <Select value={area} onChange={(e) => setArea(e.target.value)} aria-label="Section" className="w-auto text-sm">
                  <option value="">All sections</option>
                  {areas.map((a) => (
                    <option key={a} value={a}>{practiceAreaLabel(a)}</option>
                  ))}
                </Select>
              ) : null}
            </div>
            <div className="max-h-96 overflow-y-auto rounded-md border border-gray-100">
              <RowList rows={shownOthers} selected={selectedOther} onToggle={(id) => toggle(selectedOther, setSelectedOther, id)} showSource empty="Nothing to add." />
            </div>
            <Button
              size="sm"
              disabled={busy}
              disabledReason={!selectedOther.size ? "Select at least one item." : null}
              onClick={async () => {
                if (await onAssign(source.id, kind, [...selectedOther])) setSelectedOther(new Set());
              }}
            >
              Add {selectedOther.size || ""} to {source.name}
            </Button>
          </div>
        </details>
      ) : null}
    </section>
  );
}

function RowList({
  rows,
  selected,
  onToggle,
  showSource = false,
  empty,
}: {
  rows: ContentRow[];
  selected: Set<string>;
  onToggle: (id: string) => void;
  showSource?: boolean;
  empty: string;
}) {
  if (rows.length === 0) return <p className="px-4 py-3 text-sm text-gray-500">{empty}</p>;
  return (
    <ul className="divide-y divide-gray-100">
      {rows.map((row) => (
        <li key={row.id}>
          <label className="flex cursor-pointer items-center gap-3 px-3 py-2 hover:bg-gray-50">
            <Checkbox checked={selected.has(row.id)} onChange={() => onToggle(row.id)} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-gray-900" title={row.name}>{row.name}</span>
              <span className="block text-xs text-gray-500">
                {row.area ? `${practiceAreaLabel(row.area)} · ` : ""}
                {row.detail}
                {row.difficulty ? ` · ${difficultyLabel(row.difficulty)}` : ""}
                {showSource ? ` · now in ${row.sourceName}` : ""}
              </span>
            </span>
            <span className="shrink-0 text-xs text-gray-500">{row.difficulty ? practiceSetStatusLabel(row.status) : fullTestStatusLabel(row.status)}</span>
          </label>
        </li>
      ))}
    </ul>
  );
}
