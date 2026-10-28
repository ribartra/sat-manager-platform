"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";

export interface TryLink {
  number: number;
  href: string;
  /** Shown in the "Go to try" list, e.g. "Sep 25, 2026 · 33%". */
  detail?: string | null;
  invalidated?: boolean;
}

/**
 * "Try M of N" with Previous / Next and a "Go to try" list — the same navigator on every attempt
 * page (Test and practice set, teacher and student). Tries are in order (try 1 first).
 */
export function TryNavigator({ current, tries }: { current: number; tries: TryLink[] }) {
  const router = useRouter();
  const index = tries.findIndex((t) => t.number === current);
  const prev = index > 0 ? tries[index - 1] : null;
  const next = index >= 0 && index < tries.length - 1 ? tries[index + 1] : null;
  const total = Math.max(tries.length, 1);

  return (
    <nav aria-label="Tries" className="flex flex-wrap items-center gap-2">
      <h3 className="text-sm font-semibold text-[var(--sat-text)]">
        Try {current} of {total}
      </h3>
      <Button asChild variant="secondary" size="sm" disabled={!prev}>
        <Link href={prev?.href ?? "#"} aria-label={prev ? `Previous: try ${prev.number}` : "No previous try"}>
          <ChevronLeft size={14} aria-hidden /> Previous
        </Link>
      </Button>
      <Button asChild variant="secondary" size="sm" disabled={!next}>
        <Link href={next?.href ?? "#"} aria-label={next ? `Next: try ${next.number}` : "No next try"}>
          Next <ChevronRight size={14} aria-hidden />
        </Link>
      </Button>
      {tries.length > 1 ? (
        <Select
          aria-label="Go to try"
          value={tries[index]?.href ?? ""}
          onChange={(event) => router.push(event.target.value)}
          className="w-auto py-[5px] text-xs"
        >
          {tries.map((t) => (
            <option key={t.href} value={t.href}>
              Try {t.number}
              {t.detail ? ` · ${t.detail}` : ""}
              {t.invalidated ? " (invalidated)" : ""}
            </option>
          ))}
        </Select>
      ) : null}
    </nav>
  );
}
