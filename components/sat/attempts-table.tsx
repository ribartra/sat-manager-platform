import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { SectionHead } from "@/components/sat/test-ui";
import { ChevronCell, LinkTr, RowLink, SimpleTable, TD } from "@/components/sat/link-table";
import { TestSectionScore, TestTotalCell } from "@/components/sat/test-cards";
import { Pct } from "@/components/sat/work-status";
import { AttemptStatusBadge, VoidableValue, invalidatedRowClass, isInvalidated } from "@/components/sat/attempt-status";
import type { TestAttemptRow } from "@/lib/test-assignments";
import { formatDate, formatDuration, relativeDay } from "@/lib/utils";

/**
 * "All attempts" tables (mockup result.html / test-result.html / practice.html): one row per try,
 * the whole row opens it, the try being viewed is marked (and not linked to itself), the best practice try gets a badge.
 */

/** Row of an attempts table: linked, except the try being viewed (plain highlighted row, no chevron). */
function AttemptTr({ viewing, className, children }: { viewing: boolean; className?: string; children: React.ReactNode }) {
  if (!viewing) return <LinkTr className={className}>{children}</LinkTr>;
  return (
    <tr className="bg-blue-50/60" aria-current="page">
      {children}
      <td className="w-8" />
    </tr>
  );
}

/** The row's main link, or plain bold text on the row being viewed. */
function AttemptLink({ viewing, href, children }: { viewing: boolean; href: string; children: React.ReactNode }) {
  return viewing ? <span className="font-semibold text-[var(--sat-text)]">{children}</span> : <RowLink href={href}>{children}</RowLink>;
}

export interface PracticeAttemptRow {
  id: string;
  tryNumber: number;
  submittedAt: Date | null;
  correct: number;
  total: number;
  pct: number | null;
  time: number | null;
  status?: string;
  /** Tries of this row's own set (lists that mix sets); defaults to the number of rows. */
  tryCount?: number;
  /** Set name + badges, for lists that mix sets. */
  title?: React.ReactNode;
}

export function PracticeAttemptsTable({
  rows,
  hrefFor,
  viewingId,
  showBest = true,
}: {
  rows: PracticeAttemptRow[];
  hrefFor: (id: string) => string;
  viewingId?: string;
  showBest?: boolean;
}) {
  const counted = rows.filter((r) => !isInvalidated(r.status) && r.pct !== null);
  const mixed = rows.some((r) => r.title);
  const bestId = showBest && !mixed && counted.length > 1 ? counted.reduce((b, r) => ((r.pct ?? -1) > (b.pct ?? -1) ? r : b)).id : null;
  return (
    <SimpleTable head={[...(mixed ? ["Practice set"] : []), "Attempt", "Completed", "Score", "Correct", "Time", ""]}>
      {rows.map((r) => (
        <AttemptTr key={r.id} viewing={r.id === viewingId} className={invalidatedRowClass(r.status)}>
          {mixed ? <td className={TD}><AttemptLink viewing={r.id === viewingId} href={hrefFor(r.id)}>{r.title}</AttemptLink></td> : null}
          <td className={TD}>
            {mixed ? <>Try {r.tryNumber}{r.tryCount ? ` of ${r.tryCount}` : ""}</> : <AttemptLink viewing={r.id === viewingId} href={hrefFor(r.id)}>Try {r.tryNumber} of {r.tryCount ?? rows.length}</AttemptLink>}
            {r.id === viewingId ? <Badge variant="info" className="ml-2">Viewing</Badge> : null}
            {r.id === bestId ? <Badge variant="success" className="ml-2">Best</Badge> : null}
            {r.status && r.status !== "SUBMITTED" ? <span className="ml-2"><AttemptStatusBadge status={r.status} /></span> : null}
          </td>
          <td className={`${TD} text-gray-600`}>
            {r.submittedAt ? <>{formatDate(r.submittedAt)}<span className="block text-xs text-gray-400">{relativeDay(r.submittedAt)}</span></> : "—"}
          </td>
          <td className={TD}><VoidableValue status={r.status}><Pct value={r.pct} className="font-semibold" /></VoidableValue></td>
          <td className={TD}>{r.correct} of {r.total}</td>
          <td className={`${TD} text-gray-600`}>{r.time ? formatDuration(r.time) : "—"}</td>
          {r.id === viewingId ? null : <ChevronCell />}
        </AttemptTr>
      ))}
    </SimpleTable>
  );
}

export function TestAttemptsTable({
  rows,
  hrefFor,
  viewingId,
}: {
  rows: Pick<TestAttemptRow, "id" | "status" | "startedAt" | "submittedAt" | "rwScore" | "mathScore" | "totalScore" | "view" | "tryNumber">[];
  hrefFor: (id: string) => string;
  viewingId?: string;
}) {
  return (
    <SimpleTable head={["Attempt", "Date", <SectionHead key="rw" section="RW" />, <SectionHead key="m" section="MATH" />, "Total", ""]}>
      {rows.map((r) => (
        <AttemptTr key={r.id} viewing={r.id === viewingId}>
          <td className={TD}>
            <AttemptLink viewing={r.id === viewingId} href={hrefFor(r.id)}>Try {r.tryNumber} of {rows.length}</AttemptLink>
            {r.id === viewingId ? <Badge variant="info" className="ml-2">Viewing</Badge> : null}
            {r.status !== "SUBMITTED" ? <span className="ml-2"><AttemptStatusBadge status={r.status} /></span> : null}
          </td>
          <td className={`${TD} text-gray-600`}>
            {formatDate(r.submittedAt ?? r.startedAt)}
            <span className="block text-xs text-gray-400">{r.submittedAt ? "Completed" : "Started"} {relativeDay(r.submittedAt ?? r.startedAt)}</span>
          </td>
          <td className={TD}><TestSectionScore attempt={r} section="RW" /></td>
          <td className={TD}><TestSectionScore attempt={r} section="MATH" /></td>
          <td className={TD}><TestTotalCell attempt={r} /></td>
          {r.id === viewingId ? null : <ChevronCell />}
        </AttemptTr>
      ))}
    </SimpleTable>
  );
}

export interface PracticeSetAttempts {
  /** Assignment id (one row per practice set). */
  key: string;
  /** Set name + badges. */
  title: React.ReactNode;
  /** Tries of the set (highest try number), invalidated ones included. */
  tryCount: number;
  /** The latest counted try, or the latest try when none counts. Its score, correct, time and date go together. */
  last: PracticeAttemptRow;
  /** Newest first, at most `recentLimit` (the rest is in History). */
  recent: PracticeAttemptRow[];
}

/**
 * Practice attempts grouped by set: one row per set showing its LAST attempt (not the best), which
 * opens to its most recent tries (native <details>, keyboard and screen-reader friendly, no JS).
 * Older tries are not deleted, only listed in History.
 */
export function PracticeSetAttemptsAccordion({
  sets,
  hrefFor,
  historyHref,
  recentLimit = 3,
}: {
  sets: PracticeSetAttempts[];
  hrefFor: (id: string) => string;
  historyHref: string;
  recentLimit?: number;
}) {
  const cols = "md:grid md:grid-cols-[minmax(0,1fr)_7rem_6rem_6rem_8rem_1.5rem] md:items-center md:gap-3";
  return (
    <div className="overflow-hidden rounded-[var(--sat-radius)] border border-[var(--sat-border)] bg-white text-sm">
      <div className={`hidden border-b border-[var(--sat-border)] bg-[var(--sat-surface-2)] px-3 py-2.5 text-xs font-semibold text-[var(--sat-muted)] ${cols}`}>
        <span>Practice set</span>
        <span>Last Attempt</span>
        <span>Correct</span>
        <span>Time</span>
        <span>Completed</span>
        <span />
      </div>
      <ul className="divide-y divide-[var(--sat-border)]">
        {sets.map((set) => (
          <li key={set.key}>
            <details className="group">
              <summary className={`flex cursor-pointer list-none flex-wrap items-center gap-x-4 gap-y-1 px-3 py-[11px] hover:bg-[var(--sat-primary-soft)] [&::-webkit-details-marker]:hidden ${cols}`}>
                <span className="w-full min-w-0 font-semibold text-[var(--sat-text)] md:w-auto">
                  {set.title}
                  <span className="ml-2 text-xs font-normal text-[var(--sat-muted)]">
                    {set.tryCount} {set.tryCount === 1 ? "try" : "tries"}
                  </span>
                </span>
                <span className={invalidatedRowClass(set.last.status)}>
                  <VoidableValue status={set.last.status}><Pct value={set.last.pct} className="font-semibold" /></VoidableValue>
                </span>
                <span>{set.last.correct} of {set.last.total}</span>
                <span className="text-gray-600">{set.last.time ? formatDuration(set.last.time) : "—"}</span>
                <span className="text-gray-600">{set.last.submittedAt ? formatDate(set.last.submittedAt) : "—"}</span>
                <ChevronRight aria-hidden size={16} className="ml-auto text-[var(--sat-blank)] transition-transform group-open:rotate-90" />
              </summary>
              <div className="border-t border-[var(--sat-border)] bg-[var(--sat-surface-2)] px-3 py-3">
                <p className="mb-2 text-xs text-[var(--sat-muted)]">
                  {set.recent.length === 1 ? "The only try so far" : `Last ${Math.min(recentLimit, set.recent.length)} tries, newest first`}
                </p>
                <PracticeAttemptsTable
                  showBest={false}
                  hrefFor={hrefFor}
                  rows={set.recent.slice(0, recentLimit).map((row) => ({ ...row, tryCount: set.tryCount }))}
                />
                {set.tryCount > Math.min(recentLimit, set.recent.length) ? (
                  <Link href={historyHref} className="mt-2 inline-block text-xs font-medium text-blue-600 hover:underline">
                    See all {set.tryCount} tries in History →
                  </Link>
                ) : null}
              </div>
            </details>
          </li>
        ))}
      </ul>
    </div>
  );
}
