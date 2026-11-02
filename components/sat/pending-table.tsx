import { ChevronCell, LinkTr, RowLink, SimpleTable, TD } from "@/components/sat/link-table";
import { ContextTag } from "@/components/sat/context-tag";
import { AreaTag } from "@/components/sat/practice-set-row";
import { SourceTag } from "@/components/sat/source-tag";
import { StudentCell } from "@/components/sat/teacher-ui";
import { Badge } from "@/components/ui/badge";
import { difficultyBadgeVariant, difficultyLabel } from "@/lib/domain-meta";
import type { HistoryParams } from "@/lib/history-params";
import type { PendingRow, PendingStatus } from "@/lib/pending";
import { formatDate, isAhead, relativeDay } from "@/lib/utils";

/** Which columns a Pending table shows: a column whose filter is fixed is hidden (it would repeat). */
export interface PendingColumns {
  student: boolean;
  type: boolean;
  typeBadge: boolean;
  area: boolean;
  status: boolean;
}

export function pendingColumns(filter: HistoryParams, status: PendingStatus | undefined, showStudent: boolean): PendingColumns {
  return { student: showStudent, type: !filter.type || (filter.type === "practice" && !filter.area), typeBadge: !filter.type, area: !filter.area, status: !status };
}

/**
 * Pending table (teacher and student): every assigned set / Test not finished, with its due, assigned
 * and open dates and the source tag. `hrefFor` decides where a row goes (teacher: its dates in Assign;
 * student: start or continue it).
 */
export function PendingTable({ rows, show, hrefFor }: { rows: PendingRow[]; show: PendingColumns; hrefFor: (row: PendingRow) => string }) {
  const head = ["Due", ...(show.student ? ["Student"] : []), ...(show.type ? [show.typeBadge ? "Type" : "Area"] : []), "Test / practice set", ...(show.status ? ["Status"] : []), "Assigned", "Opens", ""];
  return (
    <SimpleTable head={head}>
      {rows.map((r) => (
        <LinkTr key={`${r.kind}-${r.id}`}>
          <td className={`${TD} whitespace-nowrap`}>
            {r.dueDate ? (
              <>
                <span className={r.status === "OVERDUE" ? "font-medium text-[var(--sat-bad)]" : "text-gray-700"}>{formatDate(r.dueDate)}</span>
                <span className="block text-xs text-gray-400">{relativeDay(r.dueDate)}</span>
              </>
            ) : (
              <span className="text-xs text-gray-400">No due date</span>
            )}
          </td>
          {show.student ? (
            <td className={TD}>
              <StudentCell name={r.studentName} avatarUrl={null} />
            </td>
          ) : null}
          {show.type ? (
            <td className={TD}>
              <span className="flex flex-wrap items-center gap-1.5">
                {show.typeBadge ? r.kind === "test" ? <Badge variant="test">Test</Badge> : <Badge>Practice</Badge> : null}
                {r.area && show.area ? <AreaTag area={r.area} /> : null}
              </span>
            </td>
          ) : null}
          <td className={TD}>
            <span className="flex flex-wrap items-center gap-2">
              <RowLink href={hrefFor(r)}>{r.title}</RowLink>
              {r.difficulty ? <Badge variant={difficultyBadgeVariant(r.difficulty)}>{difficultyLabel(r.difficulty)}</Badge> : null}
              <SourceTag name={r.sourceName} unlessIn={r.title} />
              {r.context ? <ContextTag context={r.context} /> : null}
            </span>
          </td>
          {show.status ? (
            <td className={TD}>
              <Badge variant={r.status === "OVERDUE" ? "danger" : r.status === "IN_PROGRESS" ? "warning" : "info"}>
                {r.status === "OVERDUE" ? "Overdue" : r.status === "IN_PROGRESS" ? "In progress" : "Not started"}
              </Badge>
            </td>
          ) : null}
          <td className={`${TD} whitespace-nowrap text-gray-600`}>{formatDate(r.assignedAt)}</td>
          <td className={`${TD} whitespace-nowrap`}>
            {/* Open date: the assignment's, else the day it was assigned. */}
            <span className={isAhead(r.opensAt) ? "text-amber-700" : "text-gray-600"}>{formatDate(r.opensAt)}</span>
            {isAhead(r.opensAt) ? <span className="block text-xs text-amber-700">{relativeDay(r.opensAt)}</span> : r.locked ? <span className="block text-xs text-amber-700">Not open yet</span> : null}
          </td>
          <ChevronCell />
        </LinkTr>
      ))}
    </SimpleTable>
  );
}
