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
