"use client";

import { useMemo } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/sat/data-table";
import { PracticeSetActions } from "./practice-set-actions-client";
import {
  difficultyBadgeVariant,
  difficultyLabel,
  practiceSetStatusBadgeVariant,
  practiceSetStatusLabel,
} from "@/lib/domain-meta";

export type PracticeSetRow = {
  id: string;
  name: string;
  skillSection: string;
  skillDomain: string;
  skillName: string;
  difficulty: string;
  questionCount: number;
  assignmentCount: number;
  status: string;
};

export function PracticeSetsTable({ rows }: { rows: PracticeSetRow[] }) {
  const columns = useMemo<ColumnDef<PracticeSetRow>[]>(
    () => [
      {
        accessorKey: "name",
        header: "Practice Set",
        meta: { priority: "high" },
        cell: ({ row }) => <span className="font-medium text-foreground">{row.original.name}</span>,
      },
      {
        id: "skill",
        header: "Skill",
        meta: { priority: "medium" },
        cell: ({ row }) => (
          <div>
            <p className="text-xs text-muted-foreground">
              {row.original.skillSection} / {row.original.skillDomain}
            </p>
            <p className="text-sm text-foreground">{row.original.skillName}</p>
          </div>
        ),
      },
      {
        id: "difficulty",
        header: "Difficulty",
        meta: { priority: "high" },
        cell: ({ row }) => (
          <Badge variant={difficultyBadgeVariant(row.original.difficulty)}>
            {difficultyLabel(row.original.difficulty)}
          </Badge>
        ),
      },
      {
        id: "questions",
        header: "Questions",
        meta: { priority: "low", align: "right" },
        cell: ({ row }) => <span className="text-muted-foreground">{row.original.questionCount}</span>,
      },
      {
        id: "assignments",
        header: "Assignments",
        meta: { priority: "low", align: "right" },
        cell: ({ row }) => <span className="text-muted-foreground">{row.original.assignmentCount}</span>,
      },
      {
        id: "status",
        header: "Status",
        meta: { priority: "medium" },
        cell: ({ row }) => (
          <Badge variant={practiceSetStatusBadgeVariant(row.original.status)}>
            {practiceSetStatusLabel(row.original.status)}
          </Badge>
        ),
      },
      {
        id: "actions",
        header: "Actions",
        meta: { priority: "high", align: "right" },
        cell: ({ row }) => (
          <PracticeSetActions
            practiceSetId={row.original.id}
            assignmentCount={row.original.assignmentCount}
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
      emptyTitle="No Practice Sets yet"
      emptyDescription="Create a practice set to assign skill practice."
    />
  );
}
