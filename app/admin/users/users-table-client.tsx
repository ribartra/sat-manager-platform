"use client";

import { useMemo } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/sat/data-table";
import { UserValidationActions } from "./user-validation-actions-client";

export type AdminUserRow = {
  id: string;
  name: string;
  email: string;
  role: string;
  active: boolean;
  validationStatus: string;
  reviewedLabel: string;
  isSelf: boolean;
};

function validationBadge(status: string) {
  if (status === "APPROVED") return <Badge variant="success">Approved</Badge>;
  if (status === "REJECTED") return <Badge variant="danger">Rejected</Badge>;
  return <Badge variant="warning">Pending</Badge>;
}

export function AdminUsersTable({ rows }: { rows: AdminUserRow[] }) {
  const columns = useMemo<ColumnDef<AdminUserRow>[]>(
    () => [
      {
        id: "user",
        header: "User",
        meta: { priority: "high" },
        cell: ({ row }) => (
          <div>
            <p className="font-medium text-foreground">{row.original.name}</p>
            <p className="text-xs text-muted-foreground">{row.original.email}</p>
          </div>
        ),
      },
      {
        accessorKey: "role",
        header: "Role",
        meta: { priority: "medium" },
        cell: ({ row }) => <span className="text-muted-foreground">{row.original.role}</span>,
      },
      {
        id: "access",
        header: "Access",
        meta: { priority: "medium" },
        cell: ({ row }) => (
          <Badge variant={row.original.active ? "success" : "danger"}>
            {row.original.active ? "Active" : "Inactive"}
          </Badge>
        ),
      },
      {
        id: "validation",
        header: "Validation",
        meta: { priority: "high" },
        cell: ({ row }) => validationBadge(row.original.validationStatus),
      },
      {
        id: "reviewed",
        header: "Reviewed",
        meta: { priority: "low" },
        cell: ({ row }) => <span className="text-muted-foreground">{row.original.reviewedLabel}</span>,
      },
      {
        id: "actions",
        header: "Action",
        meta: { priority: "high", align: "right" },
        cell: ({ row }) => (
          <UserValidationActions
            userId={row.original.id}
            currentStatus={row.original.validationStatus}
            active={row.original.active}
            isSelf={row.original.isSelf}
            email={row.original.email}
          />
        ),
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
      emptyTitle="No accounts found"
      emptyDescription="Try a different search, or wait for new sign-ups to review."
    />
  );
}
