import { Badge } from "@/components/ui/badge";
import { formatDate, relativeDay } from "@/lib/utils";
import { scoreBandTextClass } from "@/lib/score-band";

import type { WorkState } from "@/lib/test-view";
export type { WorkState };

/** Not started / In progress / Completed, plus "Overdue" when the due date passed and it is not completed. */
export function WorkStatusBadges({ state, overdue }: { state: WorkState; overdue?: boolean }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      {state === "done" ? (
        <Badge variant="success">Completed</Badge>
      ) : state === "progress" ? (
        <Badge variant="warning">In progress</Badge>
      ) : (
        <Badge variant="info">Not started</Badge>
      )}
      {overdue && state !== "done" ? <Badge variant="danger">Overdue</Badge> : null}
    </span>
  );
}

/** "Assigned Oct 1, 2026 · Due Oct 20, 2026 (in 3 days)" or "… · Completed Oct 12, 2026 (2 days ago)". */
export function DueLine({
  assignedAt,
  dueDate,
  completedAt,
  className = "",
}: {
  assignedAt?: Date | string | null;
  dueDate?: Date | string | null;
  completedAt?: Date | string | null;
  className?: string;
}) {
  const parts: React.ReactNode[] = [];
  if (assignedAt) parts.push(<span key="a">Assigned <b className="font-medium text-gray-700">{formatDate(assignedAt)}</b></span>);
  if (completedAt) {
    parts.push(
      <span key="c">
        Completed <b className="font-medium text-gray-700">{formatDate(completedAt)}</b> ({relativeDay(completedAt)})
      </span>,
    );
  } else if (dueDate) {
    const late = new Date(dueDate).getTime() < startOfToday();
    parts.push(
      <span key="d">
        Due <b className="font-medium text-gray-700">{formatDate(dueDate)}</b>{" "}
        <span className={late ? "font-medium text-red-600" : ""}>({relativeDay(dueDate)})</span>
      </span>,
    );
  }
  if (parts.length === 0) return null;
  return (
    <p className={`text-xs text-gray-500 ${className}`}>
      {parts.map((p, i) => (
        <span key={i}>{i > 0 ? " · " : ""}{p}</span>
      ))}
    </p>
  );
}

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** Percentage coloured with the shared accuracy bands (practice and per-area results only, never SAT scores). */
export function Pct({ value, className = "" }: { value: number | null | undefined; className?: string }) {
  if (value === null || value === undefined) return <span className={`text-gray-400 ${className}`}>—</span>;
  return <span className={`${scoreBandTextClass(value)} ${className}`}>{value}%</span>;
}
