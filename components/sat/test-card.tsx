import Link from "next/link";
import { RetakeTestButton } from "@/components/sat/retake-test-button";
import type { ModuleView } from "@/lib/test-view";
import type { StudentTestItem } from "@/lib/test-assignments";
import { cn, formatDate } from "@/lib/utils";

/** Where a Test card's buttons go; one card for every role, only the links change. */
export interface TestCardLinks {
  /** An attempt's results (teacher: attempt detail). */
  attempt: (attemptId: string) => string;
  /** Start / continue a module (student). Null: modules not taken are not links (teacher, Student view). */
  module: ((assignmentId: string, moduleKey: string) => string) | null;
  /** The Test itself, for a Test nobody can start from here (teacher: the Test page). */
  test?: (testId: string) => string;
  /** Retake icon on a completed Test (only the student retakes, on their own). */
  canRetake: boolean;
  /** "YOUR TOTAL SCORE" (student) or "TOTAL SCORE" (teacher). */
  scoreLabel?: string;
}

/**
 * Test card (CookSAT reference, reportes/cooksat-reference.webp), the same component in every view:
 * name, "SAT MOCK EXAM" + date, total score (400–1600), each section with its score and Mod 1 / Mod 2
 * (correct / questions), and REVIEW TEST (+ retake). Attempt level: the open attempt, else the LAST
 * finished one — never the best. Every try is listed in the view's attempts accordion.
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

  const modButton = (m: ModuleView) => {
    const label = (
      <>
        <span>Mod {m.short.slice(-1)}</span>
        <span>{m.state === "done" ? `${m.right}/${m.questionCount}` : m.state === "progress" ? "Continue" : done || !links.module ? "—" : "Start"}</span>
      </>
    );
    const href =
      m.state === "done" && shownId
        ? `${links.attempt(shownId)}#mod-${m.key}`
        : done && last
          ? `${links.attempt(last.id)}#mod-${m.key}`
          : links.module
            ? links.module(item.assignmentId, m.key)
            : null;
    const classes = cn(
      "flex items-center justify-between rounded-lg border-b-[3px] px-3 py-2 text-sm font-bold",
      m.state === "done"
        ? "border-b-sky-700 bg-sky-500 text-white"
        : m.state === "progress"
          ? "border-b-amber-500 bg-amber-200 text-amber-900"
          : "border-b-sky-200 bg-sky-50 text-sky-800",
      href && "hover:brightness-[.97]",
    );
    return href ? (
      <Link key={m.key} href={href} title={m.name} className={classes}>{label}</Link>
    ) : (
      <span key={m.key} title={m.name} className={classes}>{label}</span>
    );
  };

  const section = (code: "RW" | "MATH", label: string) => {
    const score = done && last ? (code === "RW" ? last.rwScore : last.mathScore) : shownView?.sections[code].score ?? null;
    return (
      <div className="border-t border-gray-200 px-4 py-3">
        <div className="flex items-center justify-between">
          <b className="text-[15px] text-gray-900">{label}</b>
          {score !== null ? <b className="text-lg tabular-nums text-gray-900">{score}</b> : <span className="text-sm text-gray-400">200–800</span>}
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2">{modules.filter((m) => m.section === code).map(modButton)}</div>
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
  const mainLabel = done ? "REVIEW TEST" : open ? (links.module ? "CONTINUE" : "VIEW PROGRESS") : links.module ? "START TEST" : "VIEW TEST";
  const dateLine = done && last?.submittedAt
    ? formatDate(last.submittedAt)
    : item.dueDate
      ? `Due ${formatDate(item.dueDate)}`
      : item.state === "progress"
        ? "In progress"
        : "Not started";

  return (
    <div id={`test-${item.assignmentId}`} className="flex min-w-0 scroll-mt-6 flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className={cn("px-4 py-3", late ? "bg-red-600" : "bg-[#3b74ff]")}>
        <h2 className="truncate text-2xl font-black text-white">
          {mainHref ? <Link href={mainHref} className="hover:underline">{item.name}</Link> : item.name}
        </h2>
      </div>
      <div className="flex items-center justify-between gap-2 bg-slate-700 px-4 py-1.5 text-[11px] font-bold text-white">
        <span className="tracking-wide">SAT MOCK EXAM</span>
        <span className="font-medium">{dateLine}</span>
      </div>
      <div className={cn("px-4 py-3 text-center", late ? "bg-red-50" : "bg-blue-50")}>
        <p className="text-xs font-extrabold tracking-wide text-gray-800">{links.scoreLabel ?? "YOUR TOTAL SCORE"}</p>
        <p className="text-[40px] font-black leading-tight tabular-nums text-gray-900">{done && last?.totalScore != null ? last.totalScore : "–"}</p>
        <p className="text-xs text-gray-600 underline underline-offset-2">400–1600</p>
      </div>
      {section("RW", "Reading and Writing")}
      {section("MATH", "Math")}
      <div className="mt-auto flex gap-2 border-t border-gray-200 px-4 py-3">
        {mainHref ? (
          <Link
            href={mainHref}
            className="flex-1 whitespace-nowrap rounded-lg border-b-[3px] border-b-blue-800 bg-[#3b74ff] px-3 py-2.5 text-center text-base font-extrabold text-white hover:brightness-105"
          >
            {mainLabel}
          </Link>
        ) : (
          <span className="flex-1 rounded-lg bg-gray-100 px-3 py-2.5 text-center text-sm font-semibold text-gray-500">{mainLabel}</span>
        )}
        {done && links.canRetake ? <RetakeTestButton assignmentId={item.assignmentId} testName={item.name} iconOnly size="md" /> : null}
      </div>
    </div>
  );
}
