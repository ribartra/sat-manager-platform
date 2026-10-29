import Link from "next/link";
import { RetakeTestButton } from "@/components/sat/retake-test-button";
import { TestModuleTiles } from "@/components/sat/test-module-tiles";
import { WorkStatusBadges } from "@/components/sat/work-status";
import { TestNumberAccordion } from "@/components/sat/test-number-accordion";
import { Button } from "@/components/ui/button";
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
  /** Retake on a completed Test (only the student retakes, on their own). */
  canRetake: boolean;
}

/**
 * Test card, the same component in every view, in the style of the teacher's Tests list
 * (`/teacher/tests`, mockup `mejorada/teacher/tests.html`): grey Tests bar with the name, date, status
 * and actions; the 4 module boxes (here with this student's result: correct / questions); total and
 * section scores. `layout="row"` is full width (modules in one row); `layout="compact"` fits the area
 * card width (home pages: Reading & Writing and Math one under the other).
 * Attempt level: the open attempt, else the LAST finished one — never the best.
 */
export function TestCard({ item, links, layout = "row" }: { item: StudentTestItem; links: TestCardLinks; layout?: "row" | "compact" }) {
  const open = item.openAttempt;
  const last = item.lastSubmitted;
  const done = item.state === "done" && !open && last;
  const shownView = open?.view ?? item.lastSubmittedView;
  const shownId = open?.id ?? last?.id ?? null;
  const modules: ModuleView[] = shownView?.modules ?? item.modules;
  const next = open?.view?.nextModule ?? null;
  const counted = item.attempts.filter((a) => a.status === "SUBMITTED").length;
  const compact = layout === "compact";

  const moduleHref = (m: ModuleView) =>
    m.state === "done" && shownId
      ? `${links.attempt(shownId)}#mod-${m.key}`
      : links.module && !done
        ? links.module(item.assignmentId, m.key)
        : null;
  const moduleResult = (m: ModuleView) =>
    m.state === "done" ? (
      <span className="tabular-nums">{m.right}/{m.questionCount} correct</span>
    ) : m.state === "progress" ? (
      <span className="text-amber-700">In progress</span>
    ) : (
      <span className="font-normal text-[var(--sat-muted)]">{links.module && !done ? "Start" : "Not taken"}</span>
    );

  const mainHref = done && last
    ? links.attempt(last.id)
    : open && !links.module
      ? links.attempt(open.id)
      : links.module
        ? links.module(item.assignmentId, next?.key ?? "rw1")
        : links.test?.(item.testId) ?? null;
  const mainLabel = done ? "Review results" : open ? (links.module ? "Continue" : "View progress") : links.module ? "Start test" : "Open test";
  const dateText = done && last?.submittedAt ? `completed ${formatDate(last.submittedAt)}` : item.dueDate ? `due ${formatDate(item.dueDate)}` : "no due date";

  const score = (code: "RW" | "MATH") => (done && last ? (code === "RW" ? last.rwScore : last.mathScore) : shownView?.sections[code].score ?? null);
  const scoreText = (value: number | null | undefined) => (value != null ? value : "—");
  const actions = (
    <div className="flex shrink-0 gap-2">
      {done && links.canRetake ? <RetakeTestButton assignmentId={item.assignmentId} testName={item.name} /> : null}
      {mainHref ? (
        <Button asChild size="sm">
          <Link href={mainHref}>{mainLabel} →</Link>
        </Button>
      ) : null}
    </div>
  );
  const scores = (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-600">
      <span>Total <b className="text-base tabular-nums text-[var(--sat-text)]">{done && last?.totalScore != null ? last.totalScore : "—"}</b> <span className="text-xs text-[var(--sat-muted)]">/ 1600</span></span>
      <span><span className="text-[var(--sat-area-reading)]">R&amp;W</span> <b className="tabular-nums text-[var(--sat-text)]">{scoreText(score("RW"))}</b></span>
      <span><span className="text-[var(--sat-area-math)]">Math</span> <b className="tabular-nums text-[var(--sat-text)]">{scoreText(score("MATH"))}</b></span>
      {counted > 1 ? <span className="text-xs text-[var(--sat-muted)]">{counted} attempts</span> : null}
    </div>
  );
  const sectionBlock = (code: "RW" | "MATH", label: string) => (
    <div>
      <div className="mb-1.5 flex items-center justify-between text-sm">
        <b style={{ color: code === "RW" ? "var(--sat-area-reading)" : "var(--sat-area-math)" }}>{label}</b>
        <b className="tabular-nums text-[var(--sat-text)]">{scoreText(score(code))}</b>
      </div>
      <TestModuleTiles modules={modules.filter((m) => m.section === code)} hrefFor={moduleHref} resultFor={moduleResult} columns={2} />
    </div>
  );

  return (
    <div id={`test-${item.assignmentId}`} className="flex min-w-0 scroll-mt-6 flex-col overflow-hidden rounded-[10px] border border-gray-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 bg-[var(--sat-area-tests)] px-4 py-2.5 text-[var(--sat-tests-ink)]">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <b className="text-base">{mainHref ? <Link href={mainHref} className="hover:underline">{item.name}</Link> : item.name}</b>
          <span className="text-sm">· {dateText}</span>
          <WorkStatusBadges state={item.state} overdue={item.overdue} />
        </div>
        {compact ? null : actions}
      </div>
      {compact ? (
        <div className="flex flex-1 flex-col gap-3 px-4 py-3">
          <div className="flex items-baseline justify-between">
            <span className="text-xs font-semibold uppercase tracking-wide text-[var(--sat-muted)]">Total score</span>
            <span><b className="text-2xl tabular-nums text-[var(--sat-text)]">{done && last?.totalScore != null ? last.totalScore : "—"}</b> <span className="text-xs text-[var(--sat-muted)]">/ 1600</span></span>
          </div>
          {sectionBlock("RW", "Reading & Writing")}
          {sectionBlock("MATH", "Math")}
          <div className={cn("mt-auto flex items-center justify-between gap-2 border-t border-[var(--sat-border)] pt-2.5")}>
            <span className="text-xs text-[var(--sat-muted)]">{counted > 1 ? `${counted} attempts` : counted === 1 ? "1 attempt" : "No attempts yet"}</span>
            {actions}
          </div>
        </div>
      ) : (
        <div className="grid gap-2.5 px-4 py-3">
          <TestModuleTiles modules={modules} hrefFor={moduleHref} resultFor={moduleResult} />
          {scores}
        </div>
      )}
    </div>
  );
}

/**
 * Test cards grouped in "TEST N" accordions (TestNumberAccordion): each source's version of a test
 * keeps its TestCard. A version not done yet (to do / in progress / overdue) opens its accordion when
 * `openPending` (student views).
 */
export function TestCardsByNumber({
  items,
  links,
  layout = "row",
  openPending = false,
  emptyText,
}: {
  items: StudentTestItem[];
  links: TestCardLinks;
  layout?: "row" | "compact";
  openPending?: boolean;
  emptyText?: string;
}) {
  return (
    <TestNumberAccordion
      compact={layout === "compact"}
      emptyText={emptyText}
      items={items.map((item) => ({
        key: item.assignmentId,
        number: item.number,
        sourceName: item.sourceName,
        sourceOrder: item.sourceOrder,
        open: openPending && item.state !== "done",
        node: <TestCard item={item} links={links} layout={layout} />,
      }))}
    />
  );
}
