import { cn } from "@/lib/utils";

/**
 * The content source of a practice set or Test (College Board, Innovator…) as a small tag. `prominent`:
 * a bordered, bold tag (Tests: which source a TEST N comes from must be easy to see).
 * Nothing when there is no name, or when `unlessIn` already says it (e.g. the title "Innovator Test 1").
 */
export function SourceTag({ name, prominent = false, unlessIn }: { name: string | null | undefined; prominent?: boolean; unlessIn?: string | null }) {
  if (!name || (unlessIn && unlessIn.includes(name))) return null;
  return (
    <span
      className={cn(
        "whitespace-nowrap rounded",
        prominent
          ? "border border-[var(--sat-border-strong)] bg-white px-2 py-0.5 text-xs font-semibold text-[var(--sat-text)]"
          : "bg-[var(--sat-surface-2)] px-1.5 py-0.5 text-[11px] text-gray-600",
      )}
    >
      {name}
    </span>
  );
}
