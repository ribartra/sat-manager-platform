"use client";

import Link from "next/link";
import { useMemo } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/sat/data-table";
import { UserValidationActions } from "./user-validation-actions-client";
import { enrollmentStatusLabel } from "@/lib/domain-meta";
import { RoleBadge } from "@/components/sat/role-badge";

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
  if (status === "APPROVED") return <Badge variant="success">{enrollmentStatusLabel(status)}</Badge>;
  if (status === "REJECTED") return <Badge variant="danger">{enrollmentStatusLabel(status)}</Badge>;
  return <Badge variant="warning">{enrollmentStatusLabel("PENDING")}</Badge>;
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
            {/* Active, approved students open their page (the only students an admin can view). */}
            {row.original.role === "STUDENT" && row.original.active && row.original.validationStatus === "APPROVED" ? (
              <Link href={`/teacher/students/${row.original.id}`} className="font-medium text-foreground hover:text-[var(--sat-primary)] hover:underline">
                {row.original.name}
              </Link>
            ) : (
              <p className="font-medium text-foreground">{row.original.name}</p>
            )}
            <p className="text-xs text-muted-foreground">{row.original.email}</p>
            {/* Not filterable: a tag under the user instead of its own column. */}
            {row.original.reviewedLabel ? (
              <span className="mt-1 inline-block rounded bg-[var(--sat-surface-2)] px-1.5 py-0.5 text-[11px] text-gray-600">Reviewed {row.original.reviewedLabel}</span>
            ) : null}
          </div>
        ),
      },
      {
        accessorKey: "role",
        header: "Role",
        meta: { priority: "medium" },
        cell: ({ row }) => <RoleBadge role={row.original.role} />,
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
