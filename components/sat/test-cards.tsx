import { Card } from "@/components/ui/card";
import { SECTION_TEXT, SectionCell } from "@/components/sat/test-ui";
import { VoidableValue } from "@/components/sat/attempt-status";
import type { TestAttemptView } from "@/lib/test-view";
import type { TestAttemptRow } from "@/lib/test-assignments";
import { cn } from "@/lib/utils";

/**
 * Test (4-module SAT) building blocks shared by the student and teacher views. Section scores
 * (200–800) only when both modules of a section are done; the total (400–1600) only with all 4.
 */

/** The one-line summary above the score blocks. `who` is "You" for the student, else a first name. */
export function TestResultSentence({ view, status, who }: { view: TestAttemptView; status: string; who: "You" | string }) {
  const done = view.modules.filter((m) => m.state === "done");
  const pending = view.modules.filter((m) => m.state !== "done");
  const you = who === "You";
  return (
    <Card padding="md" className="mb-4 text-sm text-gray-700">
      {view.total !== null ? (
        <>
          {who} completed all 4 modules. Reading &amp; Writing <b>{view.sections.RW.score}</b> · Math <b>{view.sections.MATH.score}</b> ·{" "}
          {you ? "Your total score is" : "Total"} <b><VoidableValue status={status}>{view.total}</VoidableValue></b> out of 1600.
        </>
      ) : (
        <>
          {who} completed <b>{done.length} of 4 modules</b>
          {done.length ? ` (${done.map((m) => m.short).join(", ")})` : ""}.{" "}
          {pending.map((m) => m.short).join(", ")} {pending.length === 1 ? "has" : "have"} not been taken yet, so the total score will appear
          when every module is done. Each section score appears when both of its modules are done.
        </>
      )}
    </Card>
  );
}

/** Result cell for one Test attempt in a list: total + R&W · Math, or "k of 4 modules done". */
export function TestAttemptResultCell({ attempt }: { attempt: Pick<TestAttemptRow, "status" | "view" | "rwScore" | "mathScore" | "totalScore"> }) {
  if (attempt.view) return <span className="text-xs text-gray-500">{attempt.view.modulesDone} of 4 modules done</span>;
  return (
    <VoidableValue status={attempt.status}>
      <b className="tabular-nums">{attempt.totalScore ?? "—"}</b>{" "}
      <span className="text-xs text-gray-500">R&amp;W {attempt.rwScore ?? "—"} · Math {attempt.mathScore ?? "—"}</span>
    </VoidableValue>
  );
}

/** Total score badge (dark, as in the mockup) or the reason it is not there yet. */
export function TestTotalCell({ attempt }: { attempt: Pick<TestAttemptRow, "status" | "view" | "totalScore"> }) {
  if (attempt.view) return <span className="text-xs text-gray-400">Not available until all modules are done</span>;
  if (attempt.totalScore === null) return <span className="text-gray-400">—</span>;
  return (
    <VoidableValue status={attempt.status}>
      <span className="inline-flex rounded-md bg-[var(--sat-area-tests)] px-2 py-0.5 text-sm font-semibold tabular-nums text-[var(--sat-tests-ink)]">{attempt.totalScore}</span>
    </VoidableValue>
  );
}

/** R&W / Math cell: the section score, or "k of 2 modules" / "Not taken" for an open attempt. */
export function TestSectionScore({ attempt, section }: { attempt: Pick<TestAttemptRow, "status" | "view" | "rwScore" | "mathScore">; section: "RW" | "MATH" }) {
  if (attempt.view) return <SectionCell section={attempt.view.sections[section]} />;
  const value = section === "RW" ? attempt.rwScore : attempt.mathScore;
  return <VoidableValue status={attempt.status}><span className={cn("font-semibold tabular-nums", SECTION_TEXT[section])}>{value ?? "—"}</span></VoidableValue>;
}

