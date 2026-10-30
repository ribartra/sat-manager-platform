"use client";

import Link from "next/link";
import { ChevronDown, Copy, Edit, Play, Send, Trash2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { practiceSetStatusLabel, practiceSetStatusOptions } from "@/lib/domain-meta";
import { usePracticeSetMutations } from "./use-practice-set-mutations";

/**
 * The options of a practice set on its page (same drop-down as a Test's): Preview, Assign (published
 * only), Edit, Status, Duplicate, Delete (only without assignments or attempts).
 */
export function PracticeSetOptionsMenu({
  set,
  assignHref,
  canDelete,
  afterDeleteHref,
}: {
  set: { id: string; name: string; status: string };
  assignHref: string;
  canDelete: boolean;
  afterDeleteHref: string;
}) {
  const { busy, changeStatus, remove, duplicate } = usePracticeSetMutations();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-md border border-gray-300 bg-white px-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 data-[state=open]:bg-gray-50">
        Options <ChevronDown size={14} aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuItem asChild>
          <Link href={`/teacher/practice-sets/${set.id}/preview`} className="gap-2"><Play size={14} aria-hidden /> Preview</Link>
        </DropdownMenuItem>
        {set.status === "PUBLISHED" ? (
          <DropdownMenuItem asChild>
            <Link href={assignHref} className="gap-2"><Send size={14} aria-hidden /> Assign</Link>
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem disabled className="gap-2" title="Publish the set before assigning it.">
            <Send size={14} aria-hidden /> Assign <span className="ml-auto text-[11px] text-gray-400">publish it first</span>
          </DropdownMenuItem>
        )}
        <DropdownMenuItem asChild>
          <Link href={`/teacher/practice-sets/${set.id}?edit`} className="gap-2"><Edit size={14} aria-hidden /> Edit</Link>
        </DropdownMenuItem>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger disabled={busy}>Status: {practiceSetStatusLabel(set.status)}</DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <DropdownMenuRadioGroup value={set.status} onValueChange={(next) => changeStatus(set, next)}>
              {practiceSetStatusOptions().map((option) => (
                <DropdownMenuRadioItem key={option.value} value={option.value}>{option.label}</DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuItem disabled={busy} onSelect={() => duplicate(set)} className="gap-2">
          <Copy size={14} aria-hidden /> Duplicate
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          disabled={busy || !canDelete}
          onSelect={() => canDelete && remove(set, afterDeleteHref)}
          title={canDelete ? undefined : "Students already have this set. Archive it instead."}
          className="gap-2 text-red-600 focus:text-red-700"
        >
          <Trash2 size={14} aria-hidden /> Delete
          {canDelete ? null : <span className="ml-auto text-[11px] text-gray-400">assigned · archive it</span>}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
