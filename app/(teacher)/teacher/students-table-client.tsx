"use client";

import { useMemo } from "react";
import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/sat/data-table";

export type TeacherStudentRow = {
  id: string;
  name: string;
  email: string;
  programsLabel: string;
  groupsLabel: string | null;
  lastActiveLabel: string;
  lastActiveTone: "ok" | "warn" | "never";
  pendingCount: number;
  avgScoreLabel: string;
  avgScoreTone: "high" | "mid" | "low" | "none";
  avgScoreFiltered: boolean;
  active: boolean;
};

const SCORE_CLASS = {
  high: "text-green-600",
  mid: "text-yellow-600",
  low: "text-red-500",
  none: "text-muted-foreground",
} as const;

export function TeacherStudentsTable({
  rows,
  showGroups,
  filterQuery = "",
}: {
  rows: TeacherStudentRow[];
  showGroups: boolean;
  filterQuery?: string;
}) {
  const columns = useMemo<ColumnDef<TeacherStudentRow>[]>(() => {
    const cols: ColumnDef<TeacherStudentRow>[] = [
      {
        id: "name",
        header: "Name",
        meta: { priority: "high" },
        cell: ({ row }) => (
          <div>
            <p className="font-medium text-foreground">{row.original.name}</p>
            <p className="text-xs text-muted-foreground">{row.original.email}</p>
            <p className="text-xs text-muted-foreground">Programs: {row.original.programsLabel}</p>
          </div>
        ),
      },
    ];

    if (showGroups) {
      cols.push({
        id: "group",
        header: "Group",
        meta: { priority: "medium" },
        cell: ({ row }) => (
          <span className="text-muted-foreground">{row.original.groupsLabel || "—"}</span>
        ),
      });
    }

    cols.push(
      {
        id: "lastActive",
        header: "Last Active",
        meta: { priority: "medium" },
        cell: ({ row }) => {
          if (row.original.lastActiveTone === "never") {
            return <span className="text-destructive">Never</span>;
          }
          return (
            <span className={row.original.lastActiveTone === "warn" ? "text-warning" : "text-muted-foreground"}>
              {row.original.lastActiveLabel}
            </span>
          );
        },
      },
      {
        id: "pending",
        header: "Pending",
        meta: { priority: "low", align: "right" },
        cell: ({ row }) =>
          row.original.pendingCount > 0 ? (
            <Badge variant="warning">{row.original.pendingCount}</Badge>
          ) : (
            <span className="text-muted-foreground">—</span>
          ),
      },
      {
        id: "avg",
        header: "Avg Score",
        meta: { priority: "medium", align: "right" },
        cell: ({ row }) => (
          <span className={`font-medium ${SCORE_CLASS[row.original.avgScoreTone]}`}>
            {row.original.avgScoreLabel}
            {row.original.avgScoreFiltered ? (
              <span className="ml-1 text-xs font-normal text-muted-foreground">filtered</span>
            ) : null}
          </span>
        ),
      },
      {
        id: "status",
        header: "Status",
        meta: { priority: "high" },
        cell: ({ row }) => (
          <Badge variant={row.original.active ? "success" : "danger"}>
            {row.original.active ? "Active" : "Inactive"}
          </Badge>
        ),
      },
      {
        id: "actions",
        header: "",
        meta: { priority: "high", align: "right" },
        cell: ({ row }) => (
          <div className="flex flex-wrap justify-end gap-x-3 gap-y-1">
            <Link href={`/teacher/students/${row.original.id}${filterQuery ? `?${filterQuery}` : ""}`} className="text-xs text-primary hover:underline">
              Open →
            </Link>
          </div>
        ),
      },
    );

    return cols;
  }, [filterQuery, showGroups]);

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
