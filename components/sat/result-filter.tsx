"use client";

import { createContext, useContext, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Practice result filter (mockup result.html): the stacked correct / incorrect / blank bar and the
 * segmented "All · Incorrect · Blank · Correct" control both pick which question cards are shown.
 * Cards are server-rendered; each sits in an element with `data-q-state="ok|bad|blank"` inside
 * <ResultFilterRoot>, which hides the others with CSS (no re-render of the cards).
 */

export type ResultFilterKey = "all" | "bad" | "blank" | "ok";
export type ResultCounts = { ok: number; bad: number; blank: number };

const Ctx = createContext<{ filter: ResultFilterKey; setFilter: (f: ResultFilterKey) => void } | null>(null);

function useFilter() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("ResultFilter parts must be inside <ResultFilterRoot>");
  return ctx;
}

export function ResultFilterRoot({ children, className }: { children: React.ReactNode; className?: string }) {
  const [filter, setFilter] = useState<ResultFilterKey>("all");
  return (
    <Ctx.Provider value={{ filter, setFilter }}>
      <div
        data-filter={filter}
        className={cn(
          "[&[data-filter=bad]_[data-q-state]:not([data-q-state=bad])]:hidden",
          "[&[data-filter=blank]_[data-q-state]:not([data-q-state=blank])]:hidden",
          "[&[data-filter=ok]_[data-q-state]:not([data-q-state=ok])]:hidden",
          className,
        )}
      >
        {children}
      </div>
    </Ctx.Provider>
  );
}

const SEGMENTS: { key: ResultFilterKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "bad", label: "Incorrect" },
  { key: "blank", label: "Blank" },
  { key: "ok", label: "Correct" },
];

/**
 * Stacked bar; each coloured part is a button that filters to that group (click again for all).
 * `interactive={false}` (solutions hidden) draws the same bar without buttons.
 */
export function ResultFilterBar({ counts, interactive = true }: { counts: ResultCounts; interactive?: boolean }) {
  const { filter, setFilter } = useFilter();
  const total = counts.ok + counts.bad + counts.blank;
  const part = (key: Exclude<ResultFilterKey, "all">, label: string, color: string) => {
    const n = counts[key];
    if (!n) return null;
    if (!interactive) return <span key={key} className={cn("h-full", color)} style={{ width: `${total ? (n / total) * 100 : 0}%` }} />;
    return (
      <button
        type="button"
        onClick={() => setFilter(filter === key ? "all" : key)}
        aria-pressed={filter === key}
        title={`${n} ${label} · show only these`}
        className={cn("h-full transition-opacity", color, filter !== "all" && filter !== key && "opacity-40")}
        style={{ width: `${total ? (n / total) * 100 : 0}%` }}
      >
        <span className="sr-only">Show {n} {label}</span>
      </button>
    );
  };
  return (
    <div className="flex h-3 overflow-hidden rounded-full bg-gray-100" role="group" aria-label={`${counts.ok} correct, ${counts.bad} incorrect, ${counts.blank} blank`}>
      {part("ok", "correct", "bg-green-500")}
      {part("bad", "incorrect", "bg-red-400")}
      {part("blank", "blank", "bg-gray-300")}
    </div>
  );
}

/** Segmented control "All (n) · Incorrect (n) · Blank (n) · Correct (n)". */
/** `hideCounts`: Classroom work (never scored) shows the groups without how many are right or wrong. */
export function ResultFilterSegments({ counts, hideCounts = false }: { counts: ResultCounts; hideCounts?: boolean }) {
  const { filter, setFilter } = useFilter();
  const total = counts.ok + counts.bad + counts.blank;
  return (
    <div role="group" aria-label="Show questions" className="inline-flex flex-wrap overflow-hidden rounded-md border border-gray-200 text-xs">
      {SEGMENTS.map((s) => {
        const n = s.key === "all" ? total : counts[s.key];
        const on = filter === s.key;
        return (
          <button
            key={s.key}
            type="button"
            onClick={() => setFilter(s.key)}
            aria-pressed={on}
            className={cn("border-r border-gray-200 px-3 py-1.5 last:border-r-0", on ? "bg-gray-900 text-white" : "bg-white text-gray-600 hover:bg-gray-50")}
          >
            {hideCounts && s.key !== "all" ? s.label : `${s.label} (${n})`}
          </button>
        );
      })}
    </div>
  );
}

/** "No questions in this group." when the chosen group is empty. */
export function ResultFilterEmpty({ counts }: { counts: ResultCounts }) {
  const { filter } = useFilter();
  if (filter === "all" || counts[filter] > 0) return null;
  return <p className="rounded-lg border border-dashed border-gray-200 p-4 text-center text-sm text-gray-500">No questions in this group.</p>;
}
