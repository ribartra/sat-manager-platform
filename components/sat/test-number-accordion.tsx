import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

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
      versions: group.versions.sort((a, b) => a.sourceOrder - b.sourceOrder || a.sourceName.localeCompare(b.sourceName)),
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
        const sources = group.versions.map((version) => version.sourceName);
        return (
          <details key={group.number ?? "other"} open={open} className="group overflow-hidden rounded-[var(--sat-radius)] border border-[var(--sat-border)] bg-white">
            <summary
              className={cn(
                "flex cursor-pointer list-none flex-wrap items-center gap-x-3 gap-y-1 hover:bg-[var(--sat-primary-soft)] [&::-webkit-details-marker]:hidden",
                compact ? "px-3 py-2" : "px-4 py-3",
              )}
            >
              <ChevronRight aria-hidden size={16} className="shrink-0 text-[var(--sat-blank)] transition-transform group-open:rotate-90" />
              <span className="font-bold text-[var(--sat-tests-ink)]">{group.number === null ? "Other tests" : `TEST ${group.number}`}</span>
              <span className="text-xs text-gray-500">
                {group.versions.length} version{group.versions.length === 1 ? "" : "s"} · {sources.join(" · ")}
              </span>
            </summary>
            <div className={cn("space-y-4 border-t border-[var(--sat-border)] bg-[var(--sat-surface-2)]", compact ? "p-2.5" : "p-3")}>
              {group.versions.map((version) => (
                <section key={version.key} className="space-y-1.5">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">{version.sourceName}</h3>
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
