"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { SectionHeader, SimpleTable } from "@/components/sat";
import { useConfirm } from "@/components/sat/confirm-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiFetch } from "@/lib/api-client";
import { notify } from "@/lib/notify-ui";

// Domain cells span their skills: align every cell to the top so they read as one block.
const TD = "px-3 py-[11px] align-top";

export interface CorrespondenceAlias {
  id: string;
  alias: string;
  source: string;
}

export interface CorrespondenceRow {
  section: string;
  domainId: string;
  domain: string;
  domainAliases: CorrespondenceAlias[];
  /** First skill of its domain (the domain cell spans the rows). */
  firstOfDomain: boolean;
  domainSkillCount: number;
  topicId: string;
  skill: string;
  skillAliases: CorrespondenceAlias[];
}

const SOURCE_LABEL: Record<string, string> = { PDF: "PDF", FILE: "Source folder", LEGACY: "Former name", MANUAL: "Added" };

/**
 * Domain ↔ Skill correspondence (reference: Taxonomia-SAT.md for the names shown, the PDFs for the
 * correspondence). Aliases are other names the PDFs or older files use; they match ingest files to
 * the right skill and are never shown to students.
 */
export function TaxonomyAliasesClient({ rows }: { rows: CorrespondenceRow[] }) {
  const router = useRouter();
  const confirm = useConfirm();
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  async function add(key: string, domainId: string, topicId: string | null) {
    const alias = (draft[key] ?? "").trim();
    if (!alias) return;
    setBusy(key);
    try {
      await apiFetch("/api/admin/taxonomy/aliases", { method: "POST", json: { alias, domainId, topicId } });
      setDraft((d) => ({ ...d, [key]: "" }));
      notify.success("Alias added", alias);
      router.refresh();
    } catch (error) {
      notify.error(error);
    } finally {
      setBusy(null);
    }
  }

  async function remove(a: CorrespondenceAlias, owner: string) {
    const ok = await confirm({
      title: `Remove the alias "${a.alias}"?`,
      description: `Files that use this name will no longer match ${owner} automatically.`,
      confirmLabel: "Remove",
      tone: "danger",
    });
    if (!ok) return;
    setBusy(a.id);
    try {
      await apiFetch(`/api/admin/taxonomy/aliases/${a.id}`, { method: "DELETE" });
      router.refresh();
    } catch (error) {
      notify.error(error);
    } finally {
      setBusy(null);
    }
  }

  const aliasChips = (aliases: CorrespondenceAlias[], owner: string) =>
    aliases.map((a) => (
      <span key={a.id} className="inline-flex items-center gap-1 rounded-full border border-[var(--sat-border)] bg-[var(--sat-surface-2)] py-0.5 pl-2 pr-1 text-xs">
        {a.alias}
        <span className="text-[10px] text-[var(--sat-muted)]">· {SOURCE_LABEL[a.source] ?? a.source}</span>
        <button
          type="button"
          aria-label={`Remove alias ${a.alias}`}
          title="Remove alias"
          disabled={busy === a.id}
          onClick={() => void remove(a, owner)}
          className="grid h-4 w-4 place-items-center rounded-full text-[var(--sat-muted)] hover:bg-white hover:text-[var(--sat-bad)]"
        >
          <X size={10} />
        </button>
      </span>
    ));

  const addField = (key: string, domainId: string, topicId: string | null, label: string) => (
    <form
      className="mt-1.5 flex items-center gap-1.5"
      onSubmit={(e) => {
        e.preventDefault();
        void add(key, domainId, topicId);
      }}
    >
      <Input
        aria-label={`New alias for ${label}`}
        placeholder="Add alias…"
        value={draft[key] ?? ""}
        onChange={(e) => setDraft((d) => ({ ...d, [key]: e.target.value }))}
        className="h-7 max-w-[180px] px-2 py-1 text-xs"
      />
      <Button type="submit" size="sm" variant="secondary" disabled={!(draft[key] ?? "").trim() || busy === key}>
        Add
      </Button>
    </form>
  );

  return (
    <section className="mb-8">
      <SectionHeader
        title="Domain ↔ Skill correspondence"
        description="Names shown in the platform follow Taxonomia-SAT.md; the correspondence follows the reference PDFs. Aliases are other names for the same domain or skill (e.g. Grammar = Form, Structure & Sense), used to match imported files."
      />
      <SimpleTable head={["Section", "Domain", "Domain aliases", "Skill", "Skill aliases"]}>
        {rows.map((r) => (
          <tr key={r.topicId} className="align-top">
            {r.firstOfDomain ? (
              <>
                <td className={TD} rowSpan={r.domainSkillCount}>
                  <Badge>{r.section}</Badge>
                </td>
                <td className={`${TD} font-semibold`} rowSpan={r.domainSkillCount}>{r.domain}</td>
                <td className={TD} rowSpan={r.domainSkillCount}>
                  <div className="flex flex-wrap gap-1">{aliasChips(r.domainAliases, r.domain)}</div>
                  {addField(`d-${r.domainId}`, r.domainId, null, r.domain)}
                </td>
              </>
            ) : null}
            <td className={`${TD} font-medium`}>{r.skill}</td>
            <td className={TD}>
              <div className="flex flex-wrap gap-1">{aliasChips(r.skillAliases, r.skill)}</div>
              {addField(`s-${r.topicId}`, r.domainId, r.topicId, r.skill)}
            </td>
          </tr>
        ))}
      </SimpleTable>
    </section>
  );
}
