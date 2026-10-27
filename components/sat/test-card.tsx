import Link from "next/link";
import { List } from "lucide-react";
import { RetakeTestButton } from "@/components/sat/retake-test-button";
import type { ModuleView } from "@/lib/test-view";
import type { StudentTestItem } from "@/lib/test-assignments";
import { cn, formatDate, relativeDay } from "@/lib/utils";

/** Where a Test card's buttons go; one card for every role, only the links change. */
export interface TestCardLinks {
  /** An attempt's results (teacher: attempt detail). */
  attempt: (attemptId: string) => string;
  /** Start / continue a module (student). Null: modules not taken are not links (teacher, Student view). */
  module: ((assignmentId: string, moduleKey: string) => string) | null;
  /** The Test itself, for a Test nobody can start from here (teacher: the Test page). */
  test?: (testId: string) => string;
  /** Retake on a completed Test (only the student retakes, on their own). */
  canRetake: boolean;
  /** "YOUR TOTAL SCORE" (student) or "TOTAL SCORE" (teacher). */
  scoreLabel?: string;
}

/**
 * Test card: the mockup's Bluebook-style card (mejorada/tests.html `testCard`, after the CookSAT
 * reference) with the mockup's styles (`.bb-card`): grey Tests header with the status tag, due /
 * completed strip, total score, each section with Mod 1 / Mod 2 buttons, the main action and the
 * list of attempts. The same component in every view; the module buttons show the open attempt,
 * else the LAST finished one (never the best).
 */
export function TestCard({ item, links }: { item: StudentTestItem; links: TestCardLinks }) {
  const open = item.openAttempt;
  const last = item.lastSubmitted;
  const done = item.state === "done" && !open && last;
  const shownView = open?.view ?? item.lastSubmittedView;
  const shownId = open?.id ?? last?.id ?? null;
  const modules: ModuleView[] = shownView?.modules ?? item.modules;
  const next = open?.view?.nextModule ?? null;
  const late = item.overdue && item.state !== "done";
  const tag = item.state === "progress" ? "IN PROGRESS" : item.state === "done" ? "COMPLETED" : item.overdue ? "OVERDUE" : "NOT STARTED";
  const counted = item.attempts.filter((a) => a.status === "SUBMITTED").length;

  // .bb-mod / .bb-mod.done / .bb-mod.prog
  const modButton = (m: ModuleView) => {
    const href =
      m.state === "done" && shownId
        ? `${links.attempt(shownId)}#mod-${m.key}`
        : done && last
          ? `${links.attempt(last.id)}#mod-${m.key}`
          : links.module
            ? links.module(item.assignmentId, m.key)
            : null;
    const classes = cn(
      "flex items-center justify-between rounded-lg border-b-[3px] px-2.5 py-[7px] text-[13px] font-bold",
      m.state === "done"
        ? "border-b-[var(--sat-primary-dark)] bg-[var(--sat-primary)] text-white"
        : m.state === "progress"
          ? "border-b-[#f59e0b] bg-[#fde68a] text-[#78350f]"
          : "border-b-[#bfdbfe] bg-[var(--sat-primary-soft)] text-[var(--sat-primary-dark)]",
      href && "hover:brightness-[.97]",
    );
    const label = (
      <>
        <span>Mod {m.short.slice(-1)}</span>
        <span className="text-xs">{m.state === "done" ? `${m.right}/${m.questionCount}` : m.state === "progress" ? "Continue" : done || !links.module ? "" : "Start"}</span>
      </>
    );
    return href ? (
      <Link key={m.key} href={href} title={m.name} className={classes}>{label}</Link>
    ) : (
      <span key={m.key} title={m.name} className={classes}>{label}</span>
    );
  };

  // .bb-sec
  const section = (code: "RW" | "MATH", label: string) => {
    const score = done && last ? (code === "RW" ? last.rwScore : last.mathScore) : null;
    return (
      <div className="border-t border-[var(--sat-border)] px-3.5 py-2.5">
        <div className="flex items-center justify-between">
          <b className="text-sm text-[var(--sat-text)]">{label}</b>
          {score !== null ? (
            <b className="text-sm" style={{ color: code === "RW" ? "var(--sat-area-reading)" : "var(--sat-area-math)" }}>{score}</b>
          ) : (
            <span className="text-sm text-[var(--sat-muted)]">200–800</span>
          )}
        </div>
        <div className="mt-1.5 grid grid-cols-2 gap-1.5">{modules.filter((m) => m.section === code).map(modButton)}</div>
      </div>
    );
  };

  const mainHref = done && last
    ? links.attempt(last.id)
    : open && !links.module
      ? links.attempt(open.id)
      : links.module
        ? links.module(item.assignmentId, next?.key ?? "rw1")
        : links.test?.(item.testId) ?? null;
  const mainLabel = done ? "REVIEW RESULTS" : open ? (links.module ? "CONTINUE" : "VIEW PROGRESS") : links.module ? "START TEST" : "VIEW TEST";
  const mainClass = "flex-1 whitespace-nowrap rounded-lg bg-[var(--sat-primary)] px-3 py-2 text-center text-sm font-semibold text-white hover:bg-[var(--sat-primary-dark)]";

  return (
    // .bb-card (.late)
    <div id={`test-${item.assignmentId}`} className="min-w-0 scroll-mt-5 overflow-hidden rounded-xl border border-[var(--sat-border)] bg-white shadow-[var(--sat-shadow)]">
      <div className={cn("flex items-center justify-between gap-2 px-4 py-3", late ? "bg-[var(--sat-bad)] text-white" : "bg-[var(--sat-area-tests)] text-[var(--sat-tests-ink)]")}>
        <h2 className="truncate text-2xl font-black">
          {mainHref ? <Link href={mainHref} className="hover:underline">{item.name}</Link> : item.name}
        </h2>
        <span className="shrink-0 rounded-[5px] bg-white/25 px-2 py-[3px] text-[10px] font-extrabold tracking-[.3px]">{tag}</span>
      </div>
      <div className="bg-[#8f8f8f] px-4 py-1 text-[10px] font-extrabold tracking-[.4px] text-white">
        {done && last?.submittedAt
          ? `COMPLETED ${formatDate(last.submittedAt).toUpperCase()}`
          : item.dueDate
            ? `DUE ${formatDate(item.dueDate).toUpperCase()} · ${relativeDay(item.dueDate).toUpperCase()}`
            : "NO DUE DATE"}
      </div>
      <div className={cn("p-3 text-center", late ? "bg-[var(--sat-bad-soft)]" : "bg-[var(--sat-primary-soft)]")}>
        <p className="text-xs font-extrabold tracking-[.4px]">{links.scoreLabel ?? "YOUR TOTAL SCORE"}</p>
        <p className="text-[34px] font-black leading-[1.1] tabular-nums">{done && last?.totalScore != null ? last.totalScore : "–"}</p>
        <p className="text-xs text-[var(--sat-muted)]">400–1600{counted > 1 ? ` · ${counted} attempts` : ""}</p>
      </div>
      {section("RW", "Reading and Writing")}
      {section("MATH", "Math")}
      <div className="flex gap-2 border-t border-[var(--sat-border)] px-3.5 py-2.5">
        {mainHref ? <Link href={mainHref} className={mainClass}>{mainLabel}</Link> : <span className={cn(mainClass, "bg-[var(--sat-surface-2)] text-[var(--sat-muted)] hover:bg-[var(--sat-surface-2)]")}>{mainLabel}</span>}
        {done && links.canRetake ? <RetakeTestButton assignmentId={item.assignmentId} testName={item.name} iconOnly /> : null}
        {open && links.module ? (
          <Link href={links.attempt(open.id)} title="View progress" aria-label="View progress" className="grid place-items-center rounded-lg border border-[var(--sat-border-strong)] bg-white px-3 text-[var(--sat-text)] hover:bg-[var(--sat-surface-2)]">
            <List size={14} />
          </Link>
        ) : null}
      </div>
      {item.attempts.length > 0 ? (
        // .bb-att
        <details className="px-3.5 pb-2.5 text-xs">
          <summary className="cursor-pointer py-1 font-semibold text-[var(--sat-primary)]">
            {item.attempts.length} attempt{item.attempts.length === 1 ? "" : "s"}
          </summary>
          {item.attempts.map((a) => (
            <Link key={a.id} href={links.attempt(a.id)} className="flex justify-between border-t border-[var(--sat-surface-2)] py-[5px] text-sm hover:underline">
              <span>Try {a.tryNumber} · {formatDate(a.submittedAt ?? a.startedAt)}</span>
              <b>{a.status === "IN_PROGRESS" ? "In progress" : a.status === "INVALIDATED" ? "Not counted" : a.totalScore ?? "—"}</b>
            </Link>
          ))}
        </details>
      ) : null}
    </div>
  );
}
