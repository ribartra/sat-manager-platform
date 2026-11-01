"use client";

import { useRouter } from "next/navigation";

/**
 * "Page [n] of N" drop-down of the Pagination bar: picking a number opens that page. `hrefs[i]` is the
 * URL of page i + 1 (built on the server with every filter kept).
 */
export function PageSelect({ page, hrefs }: { page: number; hrefs: string[] }) {
  const router = useRouter();
  return (
    <label className="flex items-center gap-1.5 whitespace-nowrap">
      Page
      <select
        aria-label="Go to page"
        value={page}
        onChange={(e) => router.push(hrefs[Number(e.target.value) - 1])}
        className="h-8 rounded-lg border border-[var(--sat-border-strong)] bg-white px-2 text-sm font-semibold text-[var(--sat-text)] focus:border-[var(--sat-primary)] focus:outline-none"
      >
        {hrefs.map((_, index) => (
          <option key={index} value={index + 1}>{index + 1}</option>
        ))}
      </select>
      of {hrefs.length}
    </label>
  );
}
