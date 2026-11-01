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
import { fullTestStatusLabel, fullTestStatusOptions } from "@/lib/domain-meta";
import { assignHref } from "@/lib/assign-params";
import { cn } from "@/lib/utils";
import { useFullTestMutations } from "./use-full-test-mutations";

/**
 * The options of a Test (same pattern as a practice set's drop-down in Practice › By skill): Preview,
 * Assign (published only), Edit, Status, Duplicate, Delete (only without assignments or attempts).
 * Used on the Tests list cards and on the Test page, next to its main button.
 */
export function TestActionsMenu({
  test,
  canDelete,
  afterDeleteHref,
  className,
}: {
  test: { id: string; name: string; status: string };
  /** False when students have it or tried it (archive it instead). */
  canDelete: boolean;
  /** Where to go after deleting from the Test page (the list refreshes in place). */
  afterDeleteHref?: string;
  className?: string;
}) {
  const { busy, changeStatus, duplicate, remove } = useFullTestMutations();
  const published = test.status === "PUBLISHED";
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          "inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-md border border-gray-300 bg-white px-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 data-[state=open]:bg-gray-50",
          className,
        )}
      >
        Options <ChevronDown size={14} aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuItem asChild>
          <Link href={`/teacher/tests/${test.id}/preview`} className="gap-2"><Play size={14} aria-hidden /> Preview</Link>
        </DropdownMenuItem>
        {published ? (
          <DropdownMenuItem asChild>
            <Link href={assignHref({ test: test.id })} className="gap-2"><Send size={14} aria-hidden /> Assign</Link>
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem disabled className="gap-2" title="Publish the test before assigning it.">
            <Send size={14} aria-hidden /> Assign <span className="ml-auto text-[11px] text-gray-400">publish it first</span>
          </DropdownMenuItem>
        )}
        <DropdownMenuItem asChild>
          <Link href={`/teacher/tests/${test.id}?edit`} className="gap-2"><Edit size={14} aria-hidden /> Edit</Link>
        </DropdownMenuItem>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger disabled={busy}>Status: {fullTestStatusLabel(test.status)}</DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <DropdownMenuRadioGroup value={test.status} onValueChange={(next) => changeStatus(test, next)}>
              {fullTestStatusOptions().map((option) => (
                <DropdownMenuRadioItem key={option.value} value={option.value}>{option.label}</DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuItem disabled={busy} onSelect={() => duplicate(test)} className="gap-2">
          <Copy size={14} aria-hidden /> Duplicate
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          disabled={busy || !canDelete}
          onSelect={() => canDelete && remove(test, afterDeleteHref)}
          title={canDelete ? undefined : "Students already have this test. Archive it instead."}
          className="gap-2 text-red-600 focus:text-red-700"
        >
          <Trash2 size={14} aria-hidden /> Delete
          {canDelete ? null : <span className="ml-auto text-[11px] text-gray-400">assigned · archive it</span>}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
