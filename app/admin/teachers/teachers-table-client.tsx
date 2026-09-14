"use client";

import { useMemo } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/sat/data-table";
import { TeacherToggle } from "./teacher-toggle-client";

export type AdminTeacherRow = {
  id: string;
  name: string;
  email: string;
  programsLabel: string;
  active: boolean;
};

export function AdminTeachersTable({ rows }: { rows: AdminTeacherRow[] }) {
  const columns = useMemo<ColumnDef<AdminTeacherRow>[]>(
    () => [
      {
        id: "teacher",
        header: "Teacher",
        meta: { priority: "high" },
        cell: ({ row }) => (
          <div>
            <p className="font-medium text-foreground">{row.original.name}</p>
            <p className="text-xs text-muted-foreground">{row.original.email}</p>
          </div>
        ),
      },
      {
        id: "programs",
        header: "Programs",
        meta: { priority: "medium" },
        cell: ({ row }) => <span className="text-muted-foreground">{row.original.programsLabel}</span>,
      },
      {
        id: "status",
        header: "Status",
        meta: { priority: "high" },
        cell: ({ row }) => (
          <Badge variant={row.original.active ? "success" : "danger"}>
            {row.original.active ? "Enabled" : "Disabled"}
          </Badge>
        ),
      },
      {
        id: "actions",
        header: "Action",
        meta: { priority: "high", align: "right" },
        cell: ({ row }) => <TeacherToggle teacherId={row.original.id} active={row.original.active} />,
      },
    ],
    [],
  );

  return (
    <DataTable
      columns={columns}
      data={rows}
      getRowId={(row) => row.id}
      responsiveStrategy="priority"
      emptyTitle="No teachers found"
      emptyDescription="Try a different search query."
    />
  );
}
