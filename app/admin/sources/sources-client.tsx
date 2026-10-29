"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowDown, ArrowUp } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { apiFetch } from "@/lib/api-client";
import { notify } from "@/lib/notify-ui";

type SourceRow = { id: string; name: string; active: boolean; forPracticeSets: boolean; forTests: boolean; practiceSets: number; tests: number };

export function SourcesClient({ sources }: { sources: SourceRow[] }) {
  const router = useRouter();
  const [newName, setNewName] = useState("");
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function run(action: () => Promise<unknown>, success: string) {
    setBusy(true);
    try {
      await action();
      notify.success(success);
      router.refresh();
      return true;
    } catch (error) {
      notify.error(error);
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const name = newName.trim();
    if (await run(() => apiFetch("/api/admin/sources", { method: "POST", json: { name } }), `Source "${name}" added.`)) setNewName("");
  }

  async function rename(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    const { id, name } = editing;
    if (await run(() => apiFetch(`/api/admin/sources/${id}`, { method: "PATCH", json: { name: name.trim() } }), "Source renamed.")) setEditing(null);
  }

  // Swap with the neighbour: rewrite every source's sortOrder as its new position (1..n).
  async function move(index: number, delta: -1 | 1) {
    const order = sources.map((s) => s.id);
    [order[index], order[index + delta]] = [order[index + delta], order[index]];
    await run(
      () => Promise.all(order.map((id, i) => apiFetch(`/api/admin/sources/${id}`, { method: "PATCH", json: { sortOrder: i + 1 } }))),
      "Order saved.",
    );
  }

  return (
    <div className="space-y-4">
      <form onSubmit={add} className="flex flex-wrap items-center gap-2 rounded-[var(--sat-radius)] border border-[var(--sat-border)] bg-white p-3">
        <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="New source name (e.g. Cook)" aria-label="New source name" maxLength={80} className="max-w-xs text-sm" />
        <Button type="submit" disabled={busy || !newName.trim()} disabledReason={!newName.trim() ? "Write a name first" : undefined}>
          Add source
        </Button>
      </form>
      <div className="overflow-x-auto rounded-[var(--sat-radius)] border border-[var(--sat-border)] bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Source</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Used for</TableHead>
              <TableHead className="text-right">Practice sets</TableHead>
              <TableHead className="text-right">Tests</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {sources.map((source, index) => (
              <TableRow key={source.id}>
                <TableCell>
                  {editing?.id === source.id ? (
                    <form onSubmit={rename} className="flex items-center gap-2">
                      <Input value={editing.name} onChange={(e) => setEditing({ id: source.id, name: e.target.value })} aria-label="Source name" maxLength={80} className="max-w-xs text-sm" autoFocus />
                      <Button type="submit" size="sm" disabled={busy || !editing.name.trim()}>Save</Button>
                      <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
                    </form>
                  ) : (
                    <Link href={`/admin/sources/${source.id}`} className="font-medium text-blue-700 hover:underline">{source.name}</Link>
                  )}
                </TableCell>
                <TableCell>
                  <Badge variant={source.active ? "success" : "default"}>{source.active ? "Active" : "Inactive"}</Badge>
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-3">
                    {([["forPracticeSets", "Practice Sets"], ["forTests", "Tests"]] as const).map(([key, label]) => (
                      <label key={key} className="inline-flex items-center gap-1.5 text-sm">
                        <Checkbox
                          checked={source[key]}
                          disabled={busy}
                          onChange={(e) =>
                            run(
                              () => apiFetch(`/api/admin/sources/${source.id}`, { method: "PATCH", json: { [key]: e.target.checked } }),
                              `"${source.name}" ${e.target.checked ? "is now" : "is no longer"} used for ${label}.`,
                            )
                          }
                        />
                        {label}
                      </label>
                    ))}
                  </div>
                </TableCell>
                <TableCell className="text-right">{source.practiceSets}</TableCell>
                <TableCell className="text-right">{source.tests}</TableCell>
                <TableCell className="whitespace-nowrap text-right">
                  {editing?.id !== source.id ? (
                    <div className="flex justify-end gap-2">
                      {/* Order of the source rows in Practice › By skill and of the Tests groups. */}
                      <Button size="sm" variant="ghost" aria-label={`Move ${source.name} up`} disabled={busy || index === 0} onClick={() => move(index, -1)}>
                        <ArrowUp size={14} />
                      </Button>
                      <Button size="sm" variant="ghost" aria-label={`Move ${source.name} down`} disabled={busy || index === sources.length - 1} onClick={() => move(index, 1)}>
                        <ArrowDown size={14} />
                      </Button>
                      <Button size="sm" variant="secondary" disabled={busy} onClick={() => setEditing({ id: source.id, name: source.name })}>Rename</Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={busy}
                        onClick={() =>
                          run(
                            () => apiFetch(`/api/admin/sources/${source.id}`, { method: "PATCH", json: { active: !source.active } }),
                            source.active ? `"${source.name}" deactivated.` : `"${source.name}" activated.`,
                          )
                        }
                      >
                        {source.active ? "Deactivate" : "Activate"}
                      </Button>
                    </div>
                  ) : null}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
