import Link from "next/link";
import { Fragment } from "react";
import { AttemptStatusBadge, VoidableValue, invalidatedRowClass } from "@/components/sat/attempt-status";
import { ChevronCell, LinkTr, RowAction, RowLink, SimpleTable, TD } from "@/components/sat/link-table";
import { AreaTag } from "@/components/sat/practice-set-row";
import { SourceTag } from "@/components/sat/source-tag";
import { Delta } from "@/components/sat/stat-tile";
import { StudentCell } from "@/components/sat/teacher-ui";
import { Pct } from "@/components/sat/work-status";
import { Badge } from "@/components/ui/badge";
import type { HistoryRow } from "@/lib/attempt-history";
import { difficultyBadgeVariant, difficultyLabel } from "@/lib/domain-meta";
import type { HistoryParams } from "@/lib/history-params";
import { formatDuration, relativeDay } from "@/lib/utils";

/** Which columns a History table shows: a column whose filter is fixed is hidden (it would repeat). */
export interface HistoryColumns {
  student: boolean;
  type: boolean;
  /** Test / Practice badge (hidden once the type is fixed). */
  typeBadge: boolean;
  area: boolean;
  title: boolean;
  difficulty: boolean;
}

export function historyColumns(filter: HistoryParams, showStudent: boolean): HistoryColumns {
  return {
    student: showStudent,
    type: !filter.type || (filter.type === "practice" && !filter.area),
    typeBadge: !filter.type,
    area: !filter.area,
    title: !filter.set && !filter.test,
    difficulty: !filter.difficulty,
  };
}

const dayLabel = (date: Date) => date.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric", year: "numeric" });

/**
 * History table (teacher and student): one row per try, newest first, with a day heading before the
 * first try of each day (no Date column). Practice shows % correct, Tests the SAT section scores; the
 * arrow opens the try (`hrefFor`). `studentHref` (teacher) adds the Student column, linking to that
 * student's History.
 */
export function HistoryTable({
  rows,
  show,
  type,
  hrefFor,
  studentHref,
}: {
  rows: HistoryRow[];
  show: HistoryColumns;
  type?: "tests" | "practice";
  hrefFor: (row: HistoryRow) => string;
  studentHref?: (row: HistoryRow) => string;
}) {
  const head = [
    ...(show.student ? ["Student"] : []),
    ...(show.type ? [show.typeBadge ? "Type" : "Area"] : []),
    ...(show.title ? [type === "tests" ? "Test" : type === "practice" ? "Practice set" : "Test / practice set"] : []),
    "Attempt",
    "Score",
    "Change",
    "",
  ];
  return (
    <SimpleTable head={head}>
      {rows.map((r, index) => {
        const day = dayLabel(r.at);
        const newDay = index === 0 || dayLabel(rows[index - 1].at) !== day;
        return (
          <Fragment key={r.id}>
            {newDay ? (
              <tr className="bg-[var(--sat-surface-2)]">
                <td colSpan={head.length} className="px-3 py-1.5 text-xs font-semibold text-gray-600">
                  {day} <span className="font-normal text-gray-400">· {relativeDay(r.at)}</span>
                </td>
              </tr>
            ) : null}
            <HistoryTableRow row={r} show={show} href={hrefFor(r)} studentHref={show.student && studentHref ? studentHref(r) : null} />
          </Fragment>
        );
      })}
    </SimpleTable>
  );
}

function HistoryTableRow({ row: r, show, href, studentHref }: { row: HistoryRow; show: HistoryColumns; href: string; studentHref: string | null }) {
  const isTest = r.kind === "test";
  return (
    <LinkTr className={invalidatedRowClass(r.status)}>
      {show.student ? (
        <td className={TD}>
          <RowAction>
            {/* This student's History (same filters). */}
            <Link href={studentHref ?? href} className="hover:underline">
              <StudentCell name={r.studentName} avatarUrl={r.avatarUrl} />
            </Link>
          </RowAction>
        </td>
      ) : null}
      {show.type ? (
        <td className={TD}>
          <span className="flex flex-wrap items-center gap-1.5">
            {show.typeBadge ? isTest ? <Badge variant="test">Test</Badge> : <Badge>Practice</Badge> : null}
            {r.area && show.area ? <AreaTag area={r.area} /> : null}
          </span>
        </td>
      ) : null}
      {show.title ? (
        <td className={TD}>
          <span className="flex flex-wrap items-center gap-2">
            <RowLink href={href}>{r.title}</RowLink>
            {r.difficulty && show.difficulty ? <Badge variant={difficultyBadgeVariant(r.difficulty)}>{difficultyLabel(r.difficulty)}</Badge> : null}
            <SourceTag name={r.sourceName} />
            {r.status === "INVALIDATED" ? <AttemptStatusBadge status={r.status} /> : null}
          </span>
        </td>
      ) : null}
      <td className={`${TD} whitespace-nowrap`}>
        {show.title ? `Try ${r.tryNumber} of ${r.tryCount}` : <RowLink href={href}>Try {r.tryNumber} of {r.tryCount}</RowLink>}
        {!show.title && r.status === "INVALIDATED" ? <AttemptStatusBadge status={r.status} /> : null}
        {r.status === "IN_PROGRESS" ? (
          <span className="block text-xs text-amber-700">{isTest ? `${r.modulesDone ?? 0} of 4 modules` : "In progress"}</span>
        ) : null}
      </td>
      <td className={TD}>
        {isTest ? (
          r.status === "IN_PROGRESS" ? (
            <span className="text-xs text-gray-400">—</span>
          ) : (
            <VoidableValue status={r.status}>
              <span className="whitespace-nowrap"><span className="text-[var(--sat-area-reading)]">R&amp;W</span> <b className="tabular-nums">{r.rw ?? "—"}</b> · <span className="text-[var(--sat-area-math)]">Math</span> <b className="tabular-nums">{r.math ?? "—"}</b></span>
            </VoidableValue>
          )
        ) : r.pct !== null ? (
          <VoidableValue status={r.status}>
            <Pct value={r.pct} className="font-semibold" /> <span className="text-xs text-gray-500">{r.correct} of {r.total}</span>
            {r.time ? <span className="block text-xs text-gray-400">{formatDuration(r.time)}</span> : null}
          </VoidableValue>
        ) : (
          <span className="text-xs text-gray-400">—</span>
        )}
      </td>
      <td className={TD}>
        {isTest ? (
          <span className="flex flex-col text-xs">
            {r.changeRw !== null ? <span>R&amp;W <Delta value={r.changeRw} unit="" /></span> : null}
            {r.changeMath !== null ? <span>Math <Delta value={r.changeMath} unit="" /></span> : null}
          </span>
        ) : (
          <Delta value={r.change} unit="%" />
        )}
      </td>
      {/* Standard row: the arrow opens the try (Invalidate lives on the teacher's attempt page). */}
      <ChevronCell />
    </LinkTr>
  );
}
