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
  const linkClass = "inline-flex h-7 items-center gap-1 rounded-md border border-gray-300 bg-white px-2 text-xs font-medium text-gray-700 hover:bg-gray-50";
  const disabledClass = "inline-flex h-7 items-center gap-1 rounded-md border border-gray-200 px-2 text-xs font-medium text-gray-300";
  return (
    <nav aria-label="Pagination" className={cn("flex items-center justify-between gap-2 px-3 py-2 text-xs text-gray-500", className)}>
      <span>
        {first}–{last} of {total}
      </span>
      <div className="flex items-center gap-2">
        {page > 1 ? (
          <Link href={hrefFor(page - 1)} className={linkClass} rel="prev">
            <ChevronLeft size={12} /> Prev
          </Link>
        ) : (
          <span className={disabledClass} aria-disabled="true"><ChevronLeft size={12} /> Prev</span>
        )}
        <span className="tabular-nums">
          Page {page} of {pageCount}
        </span>
        {page < pageCount ? (
          <Link href={hrefFor(page + 1)} className={linkClass} rel="next">
            Next <ChevronRight size={12} />
          </Link>
        ) : (
          <span className={disabledClass} aria-disabled="true">Next <ChevronRight size={12} /></span>
        )}
      </div>
    </nav>
  );
}
