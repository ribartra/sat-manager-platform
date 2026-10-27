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
  /** Lowest-scoring skill in this area ("Boundaries (Hard) · 40%"). */
  weakestLabel?: string;
  /** The student's area tab filtered to that skill and level. */
  weakestHref?: string;
  /** Assign practice in this area. */
  assignHref?: string;
};

/**
 * Teacher Home practice tabs (mockup `mejorada/teacher/index.html` area table): Name · Last {Area}
 * practice · Sets completed · Pending · Weakest skill · Assign practice / Open.
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
    // The student's page on this area tab (keeps the Home filters).
    const studentHref = (id: string) => `/teacher/students/${id}${filterQuery ? `?${filterQuery}` : ""}`;
    const cols: ColumnDef<TeacherStudentRow>[] = [
      {
        id: "name",
        header: "Name",
        meta: { priority: "high" },
        cell: ({ row }) => (
          <StudentCell name={row.original.name} email={row.original.email} avatarUrl={row.original.avatarUrl}>
            <Link href={studentHref(row.original.id)} className="block truncate font-medium text-gray-900 hover:underline">{row.original.name}</Link>
          </StudentCell>
        ),
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
        id: "pending",
        header: "Pending",
        meta: { priority: "low", align: "right" },
        cell: ({ row }) =>
          row.original.pendingCount > 0 ? (
            <Link href={`${studentHref(row.original.id)}#active-sets`} title="See the pending sets">
              <Badge variant="warning">{row.original.pendingCount}</Badge>
            </Link>
          ) : (
            <span className="text-muted-foreground">—</span>
          ),
      },
      {
        id: "weakest",
        header: "Weakest skill",
        meta: { priority: "low" },
        cell: ({ row }) =>
          row.original.weakestLabel && row.original.weakestHref ? (
            <Link href={row.original.weakestHref} className="block min-w-[190px] text-xs text-muted-foreground hover:text-[var(--sat-primary)] hover:underline">
              {row.original.weakestLabel}
            </Link>
          ) : (
            <span className="block min-w-[190px] text-xs text-muted-foreground">{row.original.weakestLabel ?? "—"}</span>
          ),
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
              <Link href={studentHref(row.original.id)}>Open</Link>
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
