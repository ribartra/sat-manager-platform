import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { PageSelect } from "@/components/sat/page-select";

/** Reads a 1-based page number from a search param; anything invalid is page 1. */
export function pageFromParam(value: string | string[] | undefined) {
  const raw = Array.isArray(value) ? value[0] : value;
  const page = Number.parseInt(raw ?? "", 10);
  return Number.isFinite(page) && page > 0 ? page : 1;
}

/** Rows per page of every paginated list. */
export const PAGE_SIZE = 25;

/** Rows per page offered in admin lists only (Logs, Reports): never more than 100. */
export const PAGE_SIZES = [25, 50, 100] as const;

/** Reads `per` (rows per page) from a search param: one of PAGE_SIZES, else `fallback`. */
export function pageSizeFromParam(value: string | string[] | undefined, fallback: (typeof PAGE_SIZES)[number] = 25) {
  const raw = Number.parseInt((Array.isArray(value) ? value[0] : value) ?? "", 10);
  return (PAGE_SIZES as readonly number[]).includes(raw) ? raw : fallback;
}

/** The slice of `items` for `page`, with the page clamped to the available range. */
export function paginate<T>(items: T[], page: number, pageSize: number) {
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize));
  const current = Math.min(Math.max(page, 1), pageCount);
  return { items: items.slice((current - 1) * pageSize, current * pageSize), page: current, pageCount, total: items.length };
}

/**
 * The page navigation of every paginated list: a bar under the list that stays on screen at the bottom
 * while the list scrolls (the same white box and shadow as the sticky filter bar at the top), centered:
 * Previous · Page [n] of N · Next, with "Showing x–y of n". Keeps every other search param (filters,
 * the other list's page) and only changes `param`. Every list shows PAGE_SIZE (25) rows; admin lists
 * pass `pageSizeParam` to also offer 25 / 50 / 100 (back to page 1). Renders nothing when there is
 * only one page and nothing to choose.
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
  pageSizeParam,
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
  /** Param of the rows-per-page choice (e.g. "per"); omitted = fixed page size. */
  pageSizeParam?: string;
  className?: string;
}) {
  const sizes = pageSizeParam && total > PAGE_SIZES[0];
  if (pageCount <= 1 && !sizes) return null;
  const hrefFor = (target: number, size = pageSize) => {
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) if (value && key !== param && key !== pageSizeParam) search.set(key, value);
    if (pageSizeParam) search.set(pageSizeParam, String(size));
    if (target > 1) search.set(param, String(target));
    const query = search.toString();
    return `${basePath}${query ? `?${query}` : ""}${anchor ? `#${anchor}` : ""}`;
  };
  const first = (page - 1) * pageSize + 1;
  const last = Math.min(page * pageSize, total);
  const btn = "inline-flex h-8 items-center gap-1 rounded-lg border px-2.5 text-sm font-semibold";
  const idle = `${btn} border-[var(--sat-border-strong)] bg-white text-[var(--sat-text)] hover:bg-[var(--sat-surface-2)]`;
  const off = `${btn} cursor-default border-[var(--sat-border)] bg-white text-[var(--sat-blank)]`;
  return (
    <nav
      aria-label="Pagination"
      className={cn(
        // Sticks to the bottom of the screen while the list scrolls (desktop), like the filter bar at the top.
        "z-20 mt-3 flex justify-center md:sticky md:bottom-2",
        className,
      )}
    >
      <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 rounded-[var(--sat-radius)] border border-[var(--sat-border)] bg-white px-3 py-2 text-xs text-[var(--sat-muted)] shadow-[0_-6px_14px_-12px_rgba(15,23,42,0.35)]">
        <span className="whitespace-nowrap">Showing {first}–{last} of {total}</span>
        {pageCount > 1 ? (
          <div className="flex items-center gap-2 text-sm text-[var(--sat-text)]">
            {page > 1 ? (
              <Link href={hrefFor(page - 1)} rel="prev" className={idle}><ChevronLeft size={14} aria-hidden /> Previous</Link>
            ) : (
              <span aria-disabled className={off}><ChevronLeft size={14} aria-hidden /> Previous</span>
            )}
            <PageSelect page={page} hrefs={Array.from({ length: pageCount }, (_, index) => hrefFor(index + 1))} />
            {page < pageCount ? (
              <Link href={hrefFor(page + 1)} rel="next" className={idle}>Next <ChevronRight size={14} aria-hidden /></Link>
            ) : (
              <span aria-disabled className={off}>Next <ChevronRight size={14} aria-hidden /></span>
            )}
          </div>
        ) : null}
        {sizes ? (
          <span className="flex items-center gap-1 whitespace-nowrap" aria-label="Rows per page">
            Rows per page
            {PAGE_SIZES.map((size) =>
              size === pageSize ? (
                <span key={size} aria-current="true" className="rounded-md bg-[var(--sat-primary-soft)] px-1.5 py-0.5 font-semibold text-[var(--sat-primary)]">{size}</span>
              ) : (
                <Link key={size} href={hrefFor(1, size)} className="rounded-md px-1.5 py-0.5 font-semibold text-[var(--sat-text)] hover:bg-[var(--sat-surface-2)]">{size}</Link>
              ),
            )}
          </span>
        ) : null}
      </div>
    </nav>
  );
}
