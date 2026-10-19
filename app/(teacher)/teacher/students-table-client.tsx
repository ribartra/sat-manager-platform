"use client";

import { useMemo } from "react";
import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/sat/data-table";
import { StudentCell } from "@/components/sat/teacher-ui";
import { Button } from "@/components/ui/button";

export type TeacherStudentRow = {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  groupsLabel: string | null;
  /** Latest practice in this area: date, "Set · %" and a link to the attempt. */
  lastPracticeAt: string | null;
  lastPracticeLabel?: string;
  lastPracticeHref?: string;
  /** Distinct practice sets finished in this area. */
  setsCompleted: number;
  pendingCount: number;
  avgScoreLabel: string;
  avgScoreTone: "high" | "mid" | "low" | "none";
  avgScoreFiltered: boolean;
  /** Lowest-scoring skill in this area ("Boundaries (Hard) · 40%"). */
  weakestLabel?: string;
  /** Assign practice in this area. */
  assignHref?: string;
};

const SCORE_CLASS = {
  high: "text-green-600",
  mid: "text-yellow-600",
  low: "text-red-500",
  none: "text-muted-foreground",
} as const;

/**
 * Teacher Home practice tabs (mockup `mejorada/teacher/index.html` area table): Name · Last {Area}
 * practice · Sets completed · Average correct · Pending · Weakest skill · Assign practice / Open.
 * Practice only (% correct); Tests are in their own tab.
 */
export function TeacherStudentsTable({
  rows,
  showGroups,
  areaLabel,
  filterQuery = "",
}: {
  rows: TeacherStudentRow[];
  showGroups: boolean;
  areaLabel: string;
  filterQuery?: string;
}) {
  const columns = useMemo<ColumnDef<TeacherStudentRow>[]>(() => {
    const cols: ColumnDef<TeacherStudentRow>[] = [
      {
        id: "name",
        header: "Name",
        meta: { priority: "high" },
        cell: ({ row }) => <StudentCell name={row.original.name} email={row.original.email} avatarUrl={row.original.avatarUrl} />,
      },
    ];

    if (showGroups) {
      cols.push({
        id: "group",
        header: "Group",
        meta: { priority: "medium" },
        cell: ({ row }) => <span className="text-muted-foreground">{row.original.groupsLabel || "—"}</span>,
      });
    }

    cols.push(
      {
        id: "lastPractice",
        header: `Last ${areaLabel} practice`,
        meta: { priority: "medium" },
        cell: ({ row }) =>
          row.original.lastPracticeAt ? (
            <Link href={row.original.lastPracticeHref ?? "#"} className="block min-w-[200px] hover:underline">
              <b className="text-sm font-medium text-gray-800">{row.original.lastPracticeAt}</b>
              <span className="block text-xs text-muted-foreground">{row.original.lastPracticeLabel}</span>
            </Link>
          ) : (
            <span className="text-xs text-muted-foreground">No practice yet</span>
          ),
      },
      {
        id: "setsCompleted",
        header: "Sets completed",
        meta: { priority: "low", align: "right" },
        cell: ({ row }) => <span className="tabular-nums">{row.original.setsCompleted}</span>,
      },
      {
        id: "avg",
        header: "Average correct",
        meta: { priority: "medium", align: "right" },
        cell: ({ row }) => (
          <span className={`font-medium ${SCORE_CLASS[row.original.avgScoreTone]}`}>
            {row.original.avgScoreLabel}
            {row.original.avgScoreFiltered ? <span className="ml-1 text-xs font-normal text-muted-foreground">filtered</span> : null}
          </span>
        ),
      },
      {
        id: "pending",
        header: "Pending",
        meta: { priority: "low", align: "right" },
        cell: ({ row }) =>
          row.original.pendingCount > 0 ? <Badge variant="warning">{row.original.pendingCount}</Badge> : <span className="text-muted-foreground">—</span>,
      },
      {
        id: "weakest",
        header: "Weakest skill",
        meta: { priority: "low" },
        cell: ({ row }) => <span className="block min-w-[190px] text-xs text-muted-foreground">{row.original.weakestLabel ?? "—"}</span>,
      },
      {
        id: "actions",
        header: "",
        meta: { priority: "high", align: "right" },
        cell: ({ row }) => (
          <div className="flex flex-nowrap justify-end gap-2 whitespace-nowrap">
            {row.original.assignHref ? (
              <Button asChild size="sm" variant="ghost">
                <Link href={row.original.assignHref}>Assign practice</Link>
              </Button>
            ) : null}
            <Button asChild size="sm" variant="secondary">
              <Link href={`/teacher/students/${row.original.id}${filterQuery ? `?${filterQuery}` : ""}`}>Open</Link>
            </Button>
          </div>
        ),
      },
    );

    return cols;
  }, [areaLabel, filterQuery, showGroups]);

  return (
    <DataTable
      columns={columns}
      data={rows}
      getRowId={(row) => row.id}
      responsiveStrategy="priority"
      emptyTitle="No students yet"
      emptyDescription="Invite your first student to get started."
    />
  );
}
