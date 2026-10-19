import Link from "next/link";
import { cn } from "@/lib/utils";
import type { ModuleView, SectionView, TestAttemptView } from "@/lib/test-view";

/** Section colour (mockup: R&W orange, Math blue) for text. */
export const SECTION_TEXT: Record<ModuleView["section"], string> = {
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
              {detail ? m.name : m.short} <span className="font-normal text-[var(--sat-muted)]">· {m.tier}</span>
            </span>
            <span className="mt-0.5 block text-xs text-[var(--sat-muted)]">
              {statusFor ? (
                statusFor(m)
              ) : m.state === "done" ? (
                <span className="font-semibold text-[var(--sat-ok)]">✓ Done · {m.right} of {m.questionCount} correct</span>
              ) : m.state === "progress" ? (
                <span className="font-semibold text-[var(--sat-warn)]">In progress · continue</span>
              ) : (
                <>{m.questionCount} questions · {m.minutes} min</>
              )}
            </span>
          </>
        );
        const classes = cn(
          "block rounded-[var(--sat-radius)] border-[1.5px] px-3 py-2.5 text-left transition-colors",
          m.state === "done"
            ? "border-[var(--sat-ok-border)] bg-[var(--sat-ok-soft)]"
            : m.state === "progress"
              ? "border-[var(--sat-warn-border)] bg-[var(--sat-warn-soft)]"
              : "border-[var(--sat-border)] bg-white",
          selectedKey === m.key && "border-[var(--sat-primary)] bg-[var(--sat-primary-soft)]",
          href && "hover:border-[var(--sat-primary)] hover:bg-[var(--sat-primary-soft)]",
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

/** Column header / label in the section colour: "Reading & Writing" (or "R&W") and "Math". */
export function SectionHead({ section, short = false }: { section: ModuleView["section"]; short?: boolean }) {
  return <span className={SECTION_TEXT[section]}>{section === "MATH" ? "Math" : short ? "R&W" : "Reading & Writing"}</span>;
}

/** "R&W 650" / "2 of 2 modules" / "Not taken" for tables. */
export function SectionCell({ section }: { section: SectionView }) {
  if (section.complete && section.score !== null) return <span className={cn("font-semibold tabular-nums", SECTION_TEXT[section.section])}>{section.score}</span>;
  if (section.modulesDone > 0) return <span className="text-xs text-gray-500">{section.modulesDone} of {section.modulesTotal} modules</span>;
  return <span className="text-xs text-gray-400">Not taken</span>;
}

/** Reading & Writing | Math | Total blocks (mockup `.scores`). Scores appear only for complete sections (never estimated). */
export function ScoreBlocks({ view, actionFor }: { view: TestAttemptView; actionFor?: (section: SectionView) => React.ReactNode }) {
  const block = (s: SectionView) => (
    <div className={cn("rounded-[var(--sat-radius)] border border-[var(--sat-border)] border-t-4 bg-white p-4", s.section === "MATH" ? "border-t-[var(--sat-area-math)]" : "border-t-[var(--sat-area-reading)]")}>
      <p className="text-xs font-semibold">{s.label}</p>
      {s.complete && s.score !== null ? (
        <>
          <p className={cn("mt-1 text-[34px] font-extrabold leading-[1.1] tabular-nums", SECTION_TEXT[s.section])}>{s.score}</p>
          <p className="text-xs text-[var(--sat-muted)]">{s.right} of {s.counted} correct · scale 200–800</p>
        </>
      ) : (
        <>
          <p className="mt-1 text-[22px] font-extrabold leading-[1.1] text-[var(--sat-blank)]">{s.modulesDone > 0 ? "Incomplete" : "Not taken"}</p>
          <p className="text-xs text-[var(--sat-muted)]">{s.modulesDone > 0 ? `${s.modulesDone} of ${s.modulesTotal} modules done` : "No module of this section yet"}</p>
          {actionFor ? <div className="mt-2">{actionFor(s)}</div> : null}
        </>
      )}
    </div>
  );
  return (
    <div className="grid gap-3.5 sm:grid-cols-2 md:grid-cols-[1fr_1fr_1.2fr]">
      {block(view.sections.RW)}
      {block(view.sections.MATH)}
      <div className="rounded-[var(--sat-radius)] border border-[var(--sat-area-tests)] bg-[var(--sat-area-tests)] p-4 text-[var(--sat-tests-ink)] sm:col-span-2 md:col-span-1">
        <p className="text-xs font-semibold">Total score</p>
        <p className={cn("mt-1 font-extrabold leading-[1.1] tabular-nums", view.total !== null ? "text-[40px]" : "text-[22px] text-gray-600")}>
          {view.total ?? "—"}
        </p>
        <p className="text-xs text-gray-700">{view.total !== null ? "out of 1600" : "Available when all 4 modules are done"}</p>
      </div>
    </div>
  );
}

/** Legend for ModuleResultRows (mockup test-result.html). */
export function ModuleResultLegend() {
  return (
    <p className="mt-1 flex flex-wrap items-center gap-3.5 text-xs text-[var(--sat-muted)]">
      <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-sm bg-[var(--sat-area-reading)]" /> R&amp;W correct</span>
      <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-sm bg-[var(--sat-area-math)]" /> Math correct</span>
      <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-sm bg-[var(--sat-bad)]" /> Incorrect</span>
      <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-sm bg-[var(--sat-blank)]" /> Blank</span>
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
    <div className="divide-y divide-[var(--sat-border)]">
      {modules.map((m) => (
        <div key={m.key} className="grid items-center gap-2 py-3 sm:grid-cols-[9rem_1fr_11rem]">
          <a href={`#${anchorPrefix}${m.key}`} className="text-sm hover:underline">
            <span className={cn("font-semibold", SECTION_TEXT[m.section])}>{m.short}</span>
            <span className="text-gray-500"> · {m.tier}</span>
          </a>
          {m.state === "done" ? (
            <div className="flex h-3 overflow-hidden rounded-md bg-[var(--sat-surface-2)]" aria-label={`${m.right} correct, ${m.wrong} incorrect, ${m.blank} blank`}>
              <span className={SECTION_BAR[m.section]} style={{ width: `${pct(m.right, m.questionCount)}%` }} />
              <span className="bg-[var(--sat-bad)]" style={{ width: `${pct(m.wrong, m.questionCount)}%` }} />
              <span className="bg-[var(--sat-blank)]" style={{ width: `${pct(m.blank, m.questionCount)}%` }} />
            </div>
          ) : (
            <div className="h-3 rounded-md bg-[repeating-linear-gradient(45deg,#f1f5f9_0_6px,#e2e8f0_6px_12px)]" />
          )}
          <div className="text-right text-xs text-[var(--sat-muted)]">
            {m.state === "done" ? (
              <>
                <span className="font-semibold text-[var(--sat-text)]">{m.right} of {m.questionCount}</span> correct ({m.pct}%)
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
          // Mockup `.qcell`: 38px, radius 8, 1.5px border in the result colour; blank dashed; hover lift.
          "grid h-[38px] w-[38px] place-items-center rounded-lg border-[1.5px] text-[13px] font-bold tabular-nums transition-[transform,box-shadow]",
          item.state !== "na" && "hover:-translate-y-px hover:shadow-[0_3px_8px_rgba(0,0,0,.1)]",
          item.state === "ok" && "border-[var(--sat-ok)] bg-[var(--sat-ok-soft)] text-[var(--sat-ok)]",
          item.state === "bad" && "border-[var(--sat-bad)] bg-[var(--sat-bad-soft)] text-[var(--sat-bad)]",
          item.state === "blank" && "border-dashed border-[var(--sat-blank)] bg-[var(--sat-surface-2)] text-[var(--sat-muted)]",
          item.state === "na" && "border-[var(--sat-border)] bg-[var(--sat-surface-2)] text-[var(--sat-blank)]",
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
    <p className="mt-2 flex flex-wrap items-center gap-3.5 text-xs text-[var(--sat-muted)]">
      <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded-[3px] border-[1.5px] border-[var(--sat-ok)] bg-[var(--sat-ok-soft)]" /> Correct</span>
      <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded-[3px] border-[1.5px] border-[var(--sat-bad)] bg-[var(--sat-bad-soft)]" /> Incorrect</span>
      <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded-[3px] border-[1.5px] border-dashed border-[var(--sat-blank)] bg-[var(--sat-surface-2)]" /> Blank</span>
      {withNotTaken ? <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded-[3px] border-[1.5px] border-[var(--sat-border)] bg-[var(--sat-surface-2)]" /> Not taken</span> : null}
      <span>· Click a number to see that question</span>
    </p>
  );
}
