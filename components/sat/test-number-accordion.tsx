import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { AssignedStamp } from "@/components/sat/assigned-stamp";

/** One version of a Test (one source) to show inside its "TEST N" accordion. */
export interface TestVersionItem {
  key: string;
  /** FullPracticeTest.number; null = not numbered (grouped under "Other tests"). */
  number: number | null;
  sourceName: string;
  sourceOrder: number;
  /** The existing test component for this version (card, attempts row, checkbox row…). */
  node: React.ReactNode;
  /** Opens its TEST N accordion (e.g. pending / in progress for the student). */
  open?: boolean;
  /** Assign view: the student already has this version. When every version (source) of the TEST N
   * is assigned, the TEST N is a fixed row with the "ALREADY ASSIGNED" stamp (it does not open). */
  assigned?: boolean;
  /** Tests catalogue: a source that has no version of this TEST N yet ("—", "+ Import TEST N"). Not
   * counted as a version; a TEST N with only these shows "—". */
  empty?: boolean;
}

/** Groups versions by test number (ascending, "Other tests" last), sources by their order. */
export function groupTestVersions(items: TestVersionItem[]) {
  const groups = new Map<string, { number: number | null; versions: TestVersionItem[] }>();
  for (const item of items) {
    const key = item.number === null ? "other" : String(item.number);
    const group = groups.get(key) ?? groups.set(key, { number: item.number, versions: [] }).get(key)!;
    group.versions.push(item);
  }
  return [...groups.values()]
    .sort((a, b) => (a.number ?? Number.MAX_SAFE_INTEGER) - (b.number ?? Number.MAX_SAFE_INTEGER))
    .map((group) => ({
      ...group,
      // Real versions first (by source order), then the sources that don't have it yet.
      versions: group.versions.sort(
        (a, b) => Number(Boolean(a.empty)) - Number(Boolean(b.empty)) || a.sourceOrder - b.sourceOrder || a.sourceName.localeCompare(b.sourceName),
      ),
    }));
}

/**
 * Tests in every view: one accordion per "TEST N" (native <details>, closed unless a version asks to
 * be open); inside, each source's version of that test — the source name, then its usual component.
 */
export function TestNumberAccordion({
  items,
  emptyText = "No tests yet.",
  compact = false,
}: {
  items: TestVersionItem[];
  emptyText?: string;
  /** Summary / home views: tighter spacing. */
  compact?: boolean;
}) {
  if (items.length === 0) return <p className="rounded-lg border border-dashed border-gray-200 p-4 text-center text-sm text-gray-500">{emptyText}</p>;
  return (
    <div className={compact ? "space-y-2" : "space-y-3"}>
      {groupTestVersions(items).map((group) => {
        const open = group.versions.some((version) => version.open);
        const real = group.versions.filter((version) => !version.empty);
        const sources = real.map((version) => version.sourceName);
        const allAssigned = real.length > 0 && real.every((version) => version.assigned);
        const title = group.number === null ? "Other tests" : `TEST ${group.number}`;
        // No source has this TEST N yet: "—" (opens to each source's "+ Import TEST N").
        const versionsText = real.length === 0 ? "—" : `${real.length} version${real.length === 1 ? "" : "s"} · ${sources.join(" · ")}`;
        if (allAssigned) {
          // Every source of this TEST N is assigned: a fixed row with the stamp (nothing to open or
          // pick). Same box and paddings as the accordion header; the chevron's place is kept.
          return (
            <div key={group.number ?? "other"} title="Already assigned" className="relative overflow-hidden rounded-[var(--sat-radius)] border border-[var(--sat-border)] bg-white">
              <div className={cn("flex flex-wrap items-center gap-x-3 gap-y-1", compact ? "px-3 py-2" : "px-4 py-3")}>
                <span aria-hidden className="w-4 shrink-0" />
                <span className="font-bold text-[var(--sat-tests-ink)]">{title}</span>
                <span className="text-xs text-gray-500">{versionsText}</span>
              </div>
              <AssignedStamp placement="end" />
            </div>
          );
        }
        return (
          // suppressHydrationWarning: a native <details> the user opens before hydration (a slow first
          // load) has `open` in the DOM; that is the user's choice, not a mismatch to report.
          <details key={group.number ?? "other"} open={open} suppressHydrationWarning className="group overflow-hidden rounded-[var(--sat-radius)] border border-[var(--sat-border)] bg-white">
            <summary
              className={cn(
                "flex cursor-pointer list-none flex-wrap items-center gap-x-3 gap-y-1 hover:bg-[var(--sat-primary-soft)] [&::-webkit-details-marker]:hidden",
                compact ? "px-3 py-2" : "px-4 py-3",
              )}
            >
              <ChevronRight aria-hidden size={16} className="shrink-0 text-[var(--sat-blank)] transition-transform group-open:rotate-90" />
              <span className="font-bold text-[var(--sat-tests-ink)]">{title}</span>
              <span className="text-xs text-gray-500">{versionsText}</span>
            </summary>
            <div className={cn("space-y-4 border-t border-[var(--sat-border)] bg-[var(--sat-surface-2)]", compact ? "p-2.5" : "p-3")}>
              {group.versions.map((version) => (
                <section key={version.key} className="space-y-1.5">
                  <h3 className="text-[13px] font-semibold text-gray-600">{version.sourceName}</h3>
                  {version.node}
                </section>
              ))}
            </div>
          </details>
        );
      })}
    </div>
  );
}
