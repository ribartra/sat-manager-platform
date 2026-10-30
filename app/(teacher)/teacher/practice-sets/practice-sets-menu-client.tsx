"use client";

import Link from "next/link";
import { ChevronDown, Edit, Eye, Play, Trash2, UserPlus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SKILL_CHIP_CLASS } from "@/components/sat/skills-map";
import { difficultyBadgeVariant, difficultyLabel, practiceSetStatusBadgeVariant, practiceSetStatusLabel, practiceSetStatusOptions } from "@/lib/domain-meta";
import { usePracticeSetMutations } from "./use-practice-set-mutations";
import { Hint } from "@/components/hint";
import { countsLabel, type AssignmentCounts } from "@/lib/assignment-counts";
import { cn } from "@/lib/utils";

export interface MenuPracticeSet {
  id: string;
  name: string;
  status: string;
  questions: number;
  /** Every assignment of the set (any teacher): Delete only when 0. */
  assignments: number;
  /** With the teacher's students: assigned, completed, in progress, overdue. */
  counts: AssignmentCounts;
  /** The Assign view with this set preselected (student chosen there); null while it isn't published. */
  assignHref: string | null;
}

/**
 * Level chip of Practice › By skill ("Easy · 2 sets"): opens a drop-down with the sets of that skill ×
 * level (× source) and, per set, Preview, Assign, Edit, Status and Delete (only when no student has it).
 */
export function PracticeSetsMenu({
  difficulty,
  sets,
  title,
  extra,
  counts,
}: {
  difficulty: string;
  sets: MenuPracticeSet[];
  title?: string;
  extra?: React.ReactNode;
  /** The level's totals, shown on hover (like a Test card's counts). */
  counts?: AssignmentCounts;
}) {
  const { busy, changeStatus, remove } = usePracticeSetMutations();

  return (
    <DropdownMenu>
      <Hint label={counts ? <span className="block"><b>{title}</b><br />{countsLabel(counts)}</span> : title ?? ""}>
      <DropdownMenuTrigger
        className={cn(SKILL_CHIP_CLASS, "bg-white text-[var(--sat-text)] hover:border-[var(--sat-primary)] hover:bg-[var(--sat-primary-soft)] data-[state=open]:border-[var(--sat-primary)] data-[state=open]:bg-[var(--sat-primary-soft)]")}
      >
        <Badge variant={difficultyBadgeVariant(difficulty)}>{difficultyLabel(difficulty)}</Badge>
        {extra}
        <ChevronDown size={12} aria-hidden className="text-[var(--sat-muted)]" />
      </DropdownMenuTrigger>
      </Hint>
      <DropdownMenuContent align="end" className="w-80 max-w-[calc(100vw-2rem)]">
        {sets.map((set, index) => (
          <div key={set.id}>
            {index > 0 ? <DropdownMenuSeparator /> : null}
            <DropdownMenuLabel className="font-normal">
              <span className="flex items-start justify-between gap-2">
                <span className="min-w-0 truncate text-sm font-semibold text-gray-900" title={set.name}>{set.name}</span>
                <Badge variant={practiceSetStatusBadgeVariant(set.status)}>{practiceSetStatusLabel(set.status)}</Badge>
              </span>
              <span className="block text-xs text-gray-500">
                {set.questions} question{set.questions === 1 ? "" : "s"}
              </span>
              <span className="mt-0.5 flex flex-wrap gap-x-2 text-[11px]">
                <span className="text-gray-600">Assigned <b>{set.counts.assigned}</b></span>
                <span className="text-green-700">Completed <b>{set.counts.completed}</b></span>
                <span className="text-amber-700">In progress <b>{set.counts.inProgress}</b></span>
                <span className="text-red-600">Overdue <b>{set.counts.overdue}</b></span>
              </span>
            </DropdownMenuLabel>
            <DropdownMenuItem asChild>
              <Link href={`/teacher/practice-sets/${set.id}`} className="gap-2"><Eye size={14} aria-hidden /> Open</Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href={`/teacher/practice-sets/${set.id}/preview`} className="gap-2"><Play size={14} aria-hidden /> Preview</Link>
            </DropdownMenuItem>
            {set.assignHref ? (
              <DropdownMenuItem asChild>
                <Link href={set.assignHref} className="gap-2"><UserPlus size={14} aria-hidden /> Assign</Link>
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem disabled className="gap-2" title="Publish the set before assigning it.">
                <UserPlus size={14} aria-hidden /> Assign <span className="ml-auto text-[11px] text-gray-400">publish it first</span>
              </DropdownMenuItem>
            )}
            <DropdownMenuItem asChild>
              <Link href={`/teacher/practice-sets/${set.id}?edit`} className="gap-2"><Edit size={14} aria-hidden /> Edit</Link>
            </DropdownMenuItem>
            <DropdownMenuSub>
              <DropdownMenuSubTrigger disabled={busy} className="gap-2">Status: {practiceSetStatusLabel(set.status)}</DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                <DropdownMenuRadioGroup value={set.status} onValueChange={(next) => changeStatus(set, next)}>
                  {practiceSetStatusOptions().map((option) => (
                    <DropdownMenuRadioItem key={option.value} value={option.value}>{option.label}</DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            <DropdownMenuItem
              disabled={busy || set.assignments > 0}
              onSelect={() => set.assignments === 0 && remove(set)}
              title={set.assignments > 0 ? "Students already have this set. Archive it instead." : undefined}
              className="gap-2 text-red-600 focus:text-red-700"
            >
              <Trash2 size={14} aria-hidden /> Delete
              {set.assignments > 0 ? <span className="ml-auto text-[11px] text-gray-400">assigned · archive it</span> : null}
            </DropdownMenuItem>
          </div>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
