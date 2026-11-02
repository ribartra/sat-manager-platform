/**
 * The content source of a practice set or Test (College Board, Innovator…) as a small grey tag.
 * Nothing when there is no name, or when `unlessIn` already says it (e.g. the title "Innovator Test 1").
 */
export function SourceTag({ name, unlessIn }: { name: string | null | undefined; unlessIn?: string | null }) {
  if (!name || (unlessIn && unlessIn.includes(name))) return null;
  return <span className="whitespace-nowrap rounded bg-[var(--sat-surface-2)] px-1.5 py-0.5 text-[11px] text-gray-600">{name}</span>;
}
