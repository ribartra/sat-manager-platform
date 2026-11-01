"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronDown, Search } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { matchesQuery } from "@/components/sat/list-filters";
import { cn } from "@/lib/utils";

/**
 * The student's name (page title) is a drop-down of the teacher's students: picking one opens the
 * same page for that student (`path`, query kept). A search box narrows long lists. With no student
 * chosen yet (Assign from a Test / Practice Set) it reads "Choose a student" and can open by itself.
 */
export function StudentSwitcher({
  name,
  students,
  selectedStudentId,
  query,
  path = "/teacher/students/:id",
  className = "text-[26px] font-bold tracking-[-0.3px] text-gray-900",
  prefix,
  defaultOpen = false,
  emptyText = "No student matches.",
}: {
  /** Shown as the title; empty = "Choose a student". */
  name: string;
  students: { id: string; name: string }[];
  selectedStudentId: string | null;
  /** Query string (without "?") to carry over to the other student. */
  query: string;
  /** Page to open for the chosen student; `:id` is replaced by its id. */
  path?: string;
  className?: string;
  /** Text before the name in the same title (e.g. "Assign to"). */
  prefix?: React.ReactNode;
  /** Opens by itself (Assign with no student chosen yet). */
  defaultOpen?: boolean;
  /** Shown when there is no student to pick. */
  emptyText?: string;
}) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const shown = useMemo(() => students.filter((student) => matchesQuery(search, student.name)), [students, search]);

  return (
    <DropdownMenu defaultOpen={defaultOpen} onOpenChange={(open) => !open && setSearch("")}>
      <h1 className={className}>
        {prefix ? <span className="mr-1.5">{prefix}</span> : null}
        <DropdownMenuTrigger
          className="-mx-1 inline-flex max-w-full items-center gap-1.5 rounded-lg px-1 text-left hover:bg-[var(--sat-primary-soft)] data-[state=open]:bg-[var(--sat-primary-soft)]"
          title="Choose another student"
        >
          <span className={cn("min-w-0 truncate", !name && "text-[var(--sat-primary)]")}>{name || "Choose a student"}</span>
          <ChevronDown size={20} aria-hidden className="shrink-0 text-[var(--sat-muted)]" />
        </DropdownMenuTrigger>
      </h1>
      <DropdownMenuContent align="start" className="w-72 max-w-[calc(100vw-2rem)] p-0">
        {students.length > 8 ? (
          <div className="flex items-center gap-2 border-b border-gray-100 px-2.5 py-2">
            <Search size={14} aria-hidden className="text-gray-400" />
            <input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              // Keep typing in the box (the menu would use the keys for typeahead / navigation).
              onKeyDown={(e) => e.key !== "Escape" && e.key !== "ArrowDown" && e.stopPropagation()}
              placeholder="Search students"
              aria-label="Search students"
              className="w-full bg-transparent text-sm outline-none placeholder:text-gray-400"
            />
          </div>
        ) : null}
        <div className="max-h-80 overflow-y-auto p-1">
          {shown.length === 0 ? <p className="px-2 py-1.5 text-sm text-gray-500">{search ? "No student matches." : emptyText}</p> : null}
          {shown.map((student) => (
            <DropdownMenuItem
              key={student.id}
              onSelect={() => {
                if (student.id !== selectedStudentId) router.push(`${path.replace(":id", encodeURIComponent(student.id))}${query ? `?${query}` : ""}`);
              }}
              className={cn("gap-2", student.id === selectedStudentId && "font-semibold")}
            >
              <Check size={14} aria-hidden className={cn("shrink-0", student.id === selectedStudentId ? "text-[var(--sat-primary)]" : "invisible")} />
              <span className="truncate">{student.name}</span>
            </DropdownMenuItem>
          ))}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
