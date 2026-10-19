import Link from "next/link";
import { List } from "lucide-react";
import { RetakeTestButton } from "@/components/sat/retake-test-button";
import type { ModuleView } from "@/lib/test-view";
import type { StudentTestItem } from "@/lib/test-assignments";
import { cn, formatDate, relativeDay } from "@/lib/utils";

/**
 * Bluebook-style Test card (mockup `mejorada/tests.html` testCard): grey header with the status
 * tag, due/completed strip, total score, the two sections with Mod 1 / Mod 2 buttons, and the
 * main action. Module buttons show the open attempt, else the latest finished one.
 */
export function BluebookCard({ item }: { item: StudentTestItem }) {
  const base = `/student/tests/${item.assignmentId}`;
  const open = item.openAttempt;
  const last = item.lastSubmitted;
  const doneNoOpen = item.state === "done" && !open;
  const shownView = open?.view ?? item.lastSubmittedView;
  const shownId = open?.id ?? last?.id ?? null;
  const modules: ModuleView[] = shownView?.modules ?? item.modules;
  const next = open?.view?.nextModule ?? null;
  const late = item.overdue && item.state !== "done";
  const tag = item.state === "progress" ? "IN PROGRESS" : item.state === "done" ? "COMPLETED" : item.overdue ? "OVERDUE" : "NOT STARTED";
  const counted = item.attempts.filter((a) => a.status === "SUBMITTED").length;

  const modButton = (m: ModuleView) => {
    const taken = m.state === "done" && shownId;
    const href = taken
      ? `/student/tests/results/${shownId}#mod-${m.key}`
      : doneNoOpen && last
        ? `/student/tests/results/${last.id}#mod-${m.key}`
        : `${base}?module=${m.key}`;
    return (
      <Link
        key={m.key}
        href={href}
        title={m.name}
        className={cn(
          "flex items-center justify-between rounded-lg border-b-[3px] px-2.5 py-[7px] text-[13px] font-bold hover:brightness-[.97]",
          m.state === "done"
            ? "border-b-blue-800 bg-blue-600 text-white"
            : m.state === "progress"
              ? "border-b-amber-500 bg-amber-200 text-amber-900"
              : "border-b-blue-200 bg-blue-50 text-blue-800",
        )}
      >
        <span>Mod {m.short.slice(-1)}</span>
        <span className="text-xs">{m.state === "done" ? `${m.right}/${m.questionCount}` : m.state === "progress" ? "Continue" : doneNoOpen ? "" : "Start"}</span>
      </Link>
    );
  };

  const section = (code: "RW" | "MATH", label: string) => {
    const score = doneNoOpen && last ? (code === "RW" ? last.rwScore : last.mathScore) : null;
    return (
      <div className="border-t border-gray-200 px-3.5 py-2.5">
        <div className="flex items-center justify-between">
          <b className="text-sm text-gray-900">{label}</b>
          {score !== null ? (
            <b className={code === "RW" ? "text-sm text-[var(--sat-area-reading)]" : "text-sm text-[var(--sat-area-math)]"}>{score}</b>
          ) : (
            <span className="text-sm text-gray-400">200–800</span>
          )}
        </div>
        <div className="mt-1.5 grid grid-cols-2 gap-1.5">{modules.filter((m) => m.section === code).map(modButton)}</div>
      </div>
    );
  };

  return (
    <div id={`test-${item.assignmentId}`} className="scroll-mt-6 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className={cn("flex items-center justify-between px-4 py-3", late ? "bg-red-600 text-white" : "bg-[var(--sat-area-tests)] text-[var(--sat-tests-ink)]")}>
        <h2 className="text-2xl font-black">{item.name}</h2>
        <span className="rounded-[5px] bg-white/25 px-2 py-[3px] text-[10px] font-extrabold tracking-wide">{tag}</span>
      </div>
      <div className="bg-[#8f8f8f] px-4 py-1 text-[10px] font-extrabold tracking-wide text-white">
        {doneNoOpen && last?.submittedAt
          ? `COMPLETED ${formatDate(last.submittedAt).toUpperCase()}`
          : item.dueDate
            ? `DUE ${formatDate(item.dueDate).toUpperCase()} · ${relativeDay(item.dueDate).toUpperCase()}`
            : "NO DUE DATE"}
      </div>
      <div className={cn("p-3 text-center", late ? "bg-red-50" : "bg-blue-50")}>
        <p className="text-xs font-extrabold tracking-wide text-gray-800">YOUR TOTAL SCORE</p>
        <p className="text-[34px] font-black leading-tight tabular-nums text-gray-900">{doneNoOpen && last?.totalScore != null ? last.totalScore : "–"}</p>
        <p className="text-xs text-gray-500">400–1600{counted > 1 ? ` · ${counted} attempts` : ""}</p>
      </div>
      {section("RW", "Reading and Writing")}
      {section("MATH", "Math")}
      <div className="flex gap-2 border-t border-gray-200 px-3.5 py-2.5">
        {doneNoOpen && last ? (
          <>
            <Link href={`/student/tests/results/${last.id}`} className="flex-1 shrink-0 whitespace-nowrap rounded-lg bg-[var(--sat-primary)] px-3 py-2 text-center text-sm font-semibold text-white hover:bg-[var(--sat-primary-dark)]">
              REVIEW RESULTS
            </Link>
            <RetakeTestButton assignmentId={item.assignmentId} testName={item.name} iconOnly />
          </>
        ) : (
          <>
            <Link href={`${base}?module=${next?.key ?? "rw1"}`} className="flex-1 shrink-0 whitespace-nowrap rounded-lg bg-[var(--sat-primary)] px-3 py-2 text-center text-sm font-semibold text-white hover:bg-[var(--sat-primary-dark)]">
              {open ? "CONTINUE" : "START TEST"}
            </Link>
            {open ? (
              <Link href={`/student/tests/results/${open.id}`} title="View progress" aria-label="View progress" className="grid place-items-center rounded-md border border-gray-300 px-3 text-gray-700 hover:bg-gray-50">
                <List size={14} />
              </Link>
            ) : null}
          </>
        )}
      </div>
      {item.attempts.length > 0 ? (
        <details className="px-3.5 pb-2.5 text-xs">
          <summary className="cursor-pointer py-1 font-semibold text-blue-600">
            {item.attempts.length} attempt{item.attempts.length === 1 ? "" : "s"}
          </summary>
          {item.attempts.map((a) => (
            <Link key={a.id} href={`/student/tests/results/${a.id}`} className="flex justify-between border-t border-slate-100 py-1.5 text-sm hover:underline">
              <span>Try {a.tryNumber} · {formatDate(a.submittedAt ?? a.startedAt)}</span>
              <b>{a.status === "IN_PROGRESS" ? "In progress" : a.status === "INVALIDATED" ? "Not counted" : a.totalScore ?? "—"}</b>
            </Link>
          ))}
        </details>
      ) : null}
    </div>
  );
}
