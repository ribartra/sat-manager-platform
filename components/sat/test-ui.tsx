import Link from "next/link";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { ModuleView, SectionView, TestAttemptView } from "@/lib/test-view";

const SECTION_TEXT: Record<ModuleView["section"], string> = {
  RW: "text-[var(--sat-area-reading)]",
  MATH: "text-[var(--sat-area-math)]",
};
const SECTION_BAR: Record<ModuleView["section"], string> = {
  RW: "bg-[var(--sat-area-reading)]",
  MATH: "bg-[var(--sat-area-math)]",
};

/**
 * 2×2 module picker (R&W 1, R&W 2, Math 1, Math 2). Each tile links to `hrefFor(module)`:
 * a submitted module opens its results, the others start/continue it.
 */
export function ModuleTiles({
  modules,
  hrefFor,
  selectedKey,
  detail = false,
  statusFor,
  className,
}: {
  modules: ModuleView[];
  hrefFor: (module: ModuleView) => string | null;
  selectedKey?: string | null;
  /** Full module name ("Reading and Writing · Module 1") instead of the short one. */
  detail?: boolean;
  /** Replaces the default status line (e.g. "Selected" on the module intro). */
  statusFor?: (module: ModuleView) => React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("grid gap-2 sm:grid-cols-2", className)}>
      {modules.map((m) => {
        const href = hrefFor(m);
        const body = (
          <>
            <span className={cn("block text-sm font-semibold", SECTION_TEXT[m.section])}>
              {detail ? m.name : m.short} <span className="font-normal text-gray-500">· {m.tier}</span>
            </span>
            <span className="mt-0.5 block text-xs text-gray-500">
              {statusFor ? (
                statusFor(m)
              ) : m.state === "done" ? (
                <span className="text-green-700">✓ Done · {m.right} of {m.questionCount} correct</span>
              ) : m.state === "progress" ? (
                <span className="text-amber-700">In progress · continue</span>
              ) : (
                <>{m.questionCount} questions · {m.minutes} min</>
              )}
            </span>
          </>
        );
        const classes = cn(
          "block rounded-lg border px-3 py-2.5 text-left transition-colors",
          m.state === "done" ? "border-green-200 bg-green-50/50" : m.state === "progress" ? "border-amber-200 bg-amber-50/50" : "border-gray-200 bg-white",
          selectedKey === m.key && "ring-2 ring-blue-500 ring-offset-1",
          href && "hover:border-gray-400",
        );
        return href ? (
          <Link key={m.key} href={href} className={classes}>
            {body}
          </Link>
        ) : (
          <div key={m.key} className={classes}>
            {body}
          </div>
        );
      })}
    </div>
  );
}

/** "R&W 650" / "2 of 2 modules" / "Not taken" for tables. */
export function SectionCell({ section }: { section: SectionView }) {
  if (section.complete && section.score !== null) return <span className="font-semibold tabular-nums text-gray-900">{section.score}</span>;
  if (section.modulesDone > 0) return <span className="text-xs text-gray-500">{section.modulesDone} of {section.modulesTotal} modules</span>;
  return <span className="text-xs text-gray-400">Not taken</span>;
}

/** Reading & Writing | Math | Total blocks. Scores appear only for complete sections (never estimated). */
export function ScoreBlocks({ view, actionFor }: { view: TestAttemptView; actionFor?: (section: SectionView) => React.ReactNode }) {
  const block = (s: SectionView) => (
    <Card padding="md" className={cn("border-t-4", s.section === "MATH" ? "border-t-[var(--sat-area-math)]" : "border-t-[var(--sat-area-reading)]")}>
      <p className="text-xs font-medium text-gray-500">{s.label}</p>
      {s.complete && s.score !== null ? (
        <>
          <p className="mt-1 text-3xl font-bold tabular-nums text-gray-900">{s.score}</p>
          <p className="text-xs text-gray-500">{s.right} of {s.counted} correct · scale 200–800</p>
        </>
      ) : (
        <>
          <p className="mt-1 text-xl font-semibold text-gray-400">{s.modulesDone > 0 ? "Incomplete" : "Not taken"}</p>
          <p className="text-xs text-gray-500">{s.modulesDone > 0 ? `${s.modulesDone} of ${s.modulesTotal} modules done` : "No module of this section yet"}</p>
          {actionFor ? <div className="mt-2">{actionFor(s)}</div> : null}
        </>
      )}
    </Card>
  );
  return (
    <div className="grid gap-3 sm:grid-cols-[1fr_1fr_1.2fr]">
      {block(view.sections.RW)}
      {block(view.sections.MATH)}
      <Card padding="md" className="border-[var(--sat-area-tests)] bg-[var(--sat-area-tests)] text-[var(--sat-tests-ink)]">
        <p className="text-xs font-medium text-gray-700">Total score</p>
        <p className={cn("mt-1 font-bold tabular-nums", view.total !== null ? "text-3xl" : "text-xl text-gray-600")}>
          {view.total ?? "—"}
        </p>
        <p className="text-xs text-gray-700">{view.total !== null ? "out of 1600" : "Available when all 4 modules are done"}</p>
      </Card>
    </div>
  );
}

/** Legend for ModuleResultRows (mockup test-result.html). */
export function ModuleResultLegend() {
  return (
    <p className="mt-1 flex flex-wrap items-center gap-3 text-xs text-gray-500">
      <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-sm bg-[var(--sat-area-reading)]" /> R&amp;W correct</span>
      <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-sm bg-[var(--sat-area-math)]" /> Math correct</span>
      <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-sm bg-red-400" /> Incorrect</span>
      <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-sm bg-gray-300" /> Blank</span>
    </p>
  );
}

/** One row per module: stacked bar of correct / incorrect / blank, or "Not taken". `timeFor` adds the time spent. */
export function ModuleResultRows({
  modules,
  anchorPrefix = "mod-",
  actionFor,
  timeFor,
}: {
  modules: ModuleView[];
  anchorPrefix?: string;
  actionFor?: (m: ModuleView) => React.ReactNode;
  timeFor?: (m: ModuleView) => string | null;
}) {
  return (
    <div className="divide-y divide-gray-100">
      {modules.map((m) => (
        <div key={m.key} className="grid items-center gap-2 py-3 sm:grid-cols-[9rem_1fr_11rem]">
          <a href={`#${anchorPrefix}${m.key}`} className="text-sm hover:underline">
            <span className={cn("font-semibold", SECTION_TEXT[m.section])}>{m.short}</span>
            <span className="text-gray-500"> · {m.tier}</span>
          </a>
          {m.state === "done" ? (
            <div className="flex h-3 overflow-hidden rounded-full bg-gray-100" aria-label={`${m.right} correct, ${m.wrong} incorrect, ${m.blank} blank`}>
              <span className={SECTION_BAR[m.section]} style={{ width: `${pct(m.right, m.questionCount)}%` }} />
              <span className="bg-red-400" style={{ width: `${pct(m.wrong, m.questionCount)}%` }} />
              <span className="bg-gray-300" style={{ width: `${pct(m.blank, m.questionCount)}%` }} />
            </div>
          ) : (
            <div className="h-3 rounded-full bg-[repeating-linear-gradient(45deg,#f3f4f6,#f3f4f6_6px,#e5e7eb_6px,#e5e7eb_12px)]" />
          )}
          <div className="text-right text-xs text-gray-500">
            {m.state === "done" ? (
              <>
                <span className="font-semibold text-gray-900">{m.right} of {m.questionCount}</span> correct ({m.pct}%)
                <span className="block">{m.wrong} wrong · {m.blank} blank{timeFor?.(m) ? <> · <b className="font-medium text-gray-700">{timeFor(m)}</b></> : null}</span>
              </>
            ) : (
              <span className="flex items-center justify-end gap-2">
                <span>{m.state === "progress" ? "In progress" : "Not taken"}</span>
                {actionFor?.(m)}
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function pct(value: number, total: number) {
  return total ? (value / total) * 100 : 0;
}

/** Clickable answer squares: each links to `#{prefix}{n}` (the question card). */
export function AnswerGrid({
  items,
  idPrefix,
}: {
  items: { state: "ok" | "bad" | "blank" | "na"; label?: string }[];
  idPrefix: string;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((item, i) => {
        const n = i + 1;
        const cls = cn(
          "flex h-8 w-8 items-center justify-center rounded border text-xs font-medium tabular-nums",
          item.state === "ok" && "border-green-300 bg-green-50 text-green-700 hover:bg-green-100",
          item.state === "bad" && "border-red-300 bg-red-50 text-red-700 hover:bg-red-100",
          item.state === "blank" && "border-dashed border-gray-300 bg-white text-gray-500 hover:bg-gray-50",
          item.state === "na" && "border-gray-100 bg-gray-50 text-gray-300",
        );
        const title = `Question ${n}: ${item.state === "ok" ? "correct" : item.state === "bad" ? "incorrect" : item.state === "blank" ? "blank" : "not taken"}`;
        return item.state === "na" ? (
          <span key={n} className={cls} title={title}>{n}</span>
        ) : (
          <a key={n} href={`#${idPrefix}${n}`} className={cls} title={title} aria-label={title}>
            {n}
          </a>
        );
      })}
    </div>
  );
}

export function AnswerGridLegend({ withNotTaken = false }: { withNotTaken?: boolean }) {
  return (
    <p className="mt-2 flex flex-wrap items-center gap-3 text-xs text-gray-500">
      <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded border border-green-300 bg-green-50" /> Correct</span>
      <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded border border-red-300 bg-red-50" /> Incorrect</span>
      <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded border border-dashed border-gray-300" /> Blank</span>
      {withNotTaken ? <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded border border-gray-100 bg-gray-50" /> Not taken</span> : null}
      <span>· Click a number to see that question</span>
    </p>
  );
}
