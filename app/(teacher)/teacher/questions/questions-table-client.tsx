"use client";

import { useMemo } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/sat/data-table";
import { QuestionListItem } from "@/components/question-list-item";
import { QuestionActions } from "./question-actions-client";
import {
  difficultyBadgeVariant,
  difficultyLabel,
  questionStatusBadgeVariant,
  questionStatusLabel,
  questionTypeLabel,
} from "@/lib/domain-meta";

export type QuestionBankRow = {
  id: string;
  stem: string;
  imageUrl: string | null;
  stimulus: string | null;
  optionImageUrls: string[];
  skillSection: string;
  skillDomain: string;
  skillName: string;
  difficulty: string;
  type: string;
  status: string;
  uses: number;
  usedCount: number;
};

/** Filters fixed to one value: their column (or part of it) is not shown, it would repeat. */
export type QuestionsTableFixed = { domain: boolean; skill: boolean; difficulty: boolean; status: boolean };

export function QuestionsTable({
  rows,
  fixed,
  labels = { both: "Domain / Skill", inner: "Skill" },
  editQuery = "",
}: {
  rows: QuestionBankRow[];
  fixed: QuestionsTableFixed;
  /** Header of the second column (Tests tab: "Test / Module"), whole or with its first part fixed. */
  labels?: { both: string; inner: string };
  /** Query added to the Edit links (Tests tab: `?area=tests`, so the editor keeps the Tests context). */
  editQuery?: string;
}) {
  const columns = useMemo<ColumnDef<QuestionBankRow>[]>(
    () => [
      {
        id: "question",
        header: "Question",
        meta: { priority: "high", cellClassName: "max-w-md" },
        cell: ({ row }) => (
          <QuestionListItem
            href={`/teacher/questions/${row.original.id}/edit${editQuery}`}
            question={{
              stem: row.original.stem,
              imageUrl: row.original.imageUrl,
              stimulus: row.original.stimulus,
              optionImageUrls: row.original.optionImageUrls,
            }}
            stemClassName="group-hover:text-foreground"
          />
        ),
      },
      {
        // "Domain / Skill"; with a Domain chosen only the skill (the domain would repeat).
        id: "skill",
        header: fixed.domain ? labels.inner : labels.both,
        meta: { priority: "medium" },
        cell: ({ row }) => (
          <div>
            {fixed.domain ? null : <p className="text-xs text-muted-foreground">{row.original.skillDomain}</p>}
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
        id: "type",
        header: "Type",
        meta: { priority: "low" },
        cell: ({ row }) => <Badge variant="default">{questionTypeLabel(row.original.type, true)}</Badge>,
      },
      {
        id: "status",
        header: "Status",
        meta: { priority: "medium" },
        cell: ({ row }) => (
          <Badge variant={questionStatusBadgeVariant(row.original.status)}>
            {questionStatusLabel(row.original.status)}
          </Badge>
        ),
      },
      {
        id: "uses",
        header: "Used in",
        meta: { priority: "low", align: "right" },
        cell: ({ row }) => <span className="text-muted-foreground">{row.original.uses} uses</span>,
      },
      {
        id: "actions",
        header: "Actions",
        meta: { priority: "high", align: "right" },
        cell: ({ row }) => (
          <QuestionActions
            questionId={row.original.id}
            usedCount={row.original.usedCount}
            editHref={`/teacher/questions/${row.original.id}/edit${editQuery}`}
          />
        ),
      },
    ],
    [fixed.domain, labels.both, labels.inner, editQuery],
  );

  return (
    <DataTable
      columns={columns}
      data={rows}
      getRowId={(row) => row.id}
      responsiveStrategy="priority"
      hiddenColumns={[fixed.skill ? "skill" : "", fixed.difficulty ? "difficulty" : "", fixed.status ? "status" : ""].filter(Boolean)}
      emptyTitle="No questions found"
      emptyDescription="Create your first question to build the bank."
    />
  );
}
