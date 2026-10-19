import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

/** Reads a 1-based page number from a search param; anything invalid is page 1. */
export function pageFromParam(value: string | string[] | undefined) {
  const raw = Array.isArray(value) ? value[0] : value;
  const page = Number.parseInt(raw ?? "", 10);
  return Number.isFinite(page) && page > 0 ? page : 1;
}

/** The slice of `items` for `page`, with the page clamped to the available range. */
export function paginate<T>(items: T[], page: number, pageSize: number) {
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize));
  const current = Math.min(Math.max(page, 1), pageCount);
  return { items: items.slice((current - 1) * pageSize, current * pageSize), page: current, pageCount, total: items.length };
}

/**
 * Prev / "Page X of Y" / Next links for server-rendered lists. Keeps every other search param
 * (filters, the other list's page) and only changes `param`. Renders nothing for a single page.
 */
export function Pagination({
  basePath,
  params,
  param = "page",
  page,
  pageCount,
  total,
  pageSize,
  anchor,
  className,
}: {
  basePath: string;
  params: Record<string, string | undefined>;
  param?: string;
  page: number;
  pageCount: number;
  total: number;
  pageSize: number;
  /** Element id to scroll back to after navigating (e.g. the list section). */
  anchor?: string;
  className?: string;
}) {
  if (pageCount <= 1) return null;
  const hrefFor = (target: number) => {
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) if (value && key !== param) search.set(key, value);
    if (target > 1) search.set(param, String(target));
    const query = search.toString();
    return `${basePath}${query ? `?${query}` : ""}${anchor ? `#${anchor}` : ""}`;
  };
  const first = (page - 1) * pageSize + 1;
  const last = Math.min(page * pageSize, total);
  // Mockup `.pager`: "Showing x–y of n" + 32px page buttons (current filled blue), windowed around the current page.
  const pages = Array.from(new Set([1, page - 1, page, page + 1, pageCount]))
    .filter((p) => p >= 1 && p <= pageCount)
    .sort((x, y) => x - y);
  const btn = "inline-flex h-8 min-w-8 items-center justify-center rounded-lg border px-2 text-sm font-semibold";
  const idle = `${btn} border-[var(--sat-border-strong)] bg-white text-[var(--sat-text)] hover:bg-[var(--sat-surface-2)]`;
  const off = `${btn} cursor-default border-[var(--sat-border)] bg-white text-[var(--sat-blank)]`;
  return (
    <nav aria-label="Pagination" className={cn("mt-2.5 flex flex-wrap items-center justify-between gap-2.5 text-xs text-[var(--sat-muted)]", className)}>
      <span>
        Showing {first}–{last} of {total}
      </span>
      <div className="flex items-center gap-1.5">
        {page > 1 ? (
          <Link href={hrefFor(page - 1)} rel="prev" aria-label="Previous page" className={idle}><ChevronLeft size={14} /></Link>
        ) : (
          <span aria-disabled className={off}><ChevronLeft size={14} /></span>
        )}
        {pages.map((p, i) => (
          <span key={p} className="flex items-center gap-1.5">
            {i > 0 && p - pages[i - 1] > 1 ? <span aria-hidden>…</span> : null}
            {p === page ? (
              <span aria-current="page" className={`${btn} border-[var(--sat-primary)] bg-[var(--sat-primary)] text-white`}>{p}</span>
            ) : (
              <Link href={hrefFor(p)} aria-label={`Page ${p}`} className={idle}>{p}</Link>
            )}
          </span>
        ))}
        {page < pageCount ? (
          <Link href={hrefFor(page + 1)} rel="next" aria-label="Next page" className={idle}><ChevronRight size={14} /></Link>
        ) : (
          <span aria-disabled className={off}><ChevronRight size={14} /></span>
        )}
      </div>
    </nav>
  );
}
