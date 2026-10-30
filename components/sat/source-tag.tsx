/** The content source of a practice set or Test (College Board, Innovator…) as a small grey tag. */
export function SourceTag({ name }: { name: string | null | undefined }) {
  if (!name) return null;
  return <span className="whitespace-nowrap rounded bg-[var(--sat-surface-2)] px-1.5 py-0.5 text-[11px] text-gray-600">{name}</span>;
}
