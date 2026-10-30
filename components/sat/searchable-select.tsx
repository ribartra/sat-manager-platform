"use client";

import { useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Search } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

const matches = (needle: string, ...fields: (string | undefined)[]) => {
  const n = needle.trim().toLowerCase();
  return !n || fields.some((field) => (field ?? "").toLowerCase().includes(n));
};

export interface SearchableOption {
  value: string;
  label: string;
  /** Optional heading the option is listed under (e.g. its domain). */
  group?: string;
}

/**
 * A filter drop-down with a search box inside (for long lists: students, skills…). Looks like the
 * Select primitive. In a GET form it posts `name` through a hidden input; or use `value` / `onChange`.
 */
export function SearchableSelect({
  id,
  name,
  options,
  allLabel,
  defaultValue = "",
  value,
  onChange,
  searchPlaceholder = "Search",
}: {
  id?: string;
  name?: string;
  options: SearchableOption[];
  /** First choice, value "" (e.g. "All students"). */
  allLabel: string;
  defaultValue?: string;
  value?: string;
  onChange?: (value: string) => void;
  searchPlaceholder?: string;
}) {
  const [own, setOwn] = useState(defaultValue);
  const current = value ?? own;
  const [search, setSearch] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const shown = useMemo(() => options.filter((o) => matches(search, o.label, o.group)), [options, search]);
  const label = options.find((o) => o.value === current)?.label ?? allLabel;

  function pick(next: string) {
    if (value === undefined) setOwn(next);
    onChange?.(next);
    // Let the bar's own change handlers (and requestSubmit users) see the new value.
    queueMicrotask(() => input.current?.dispatchEvent(new Event("change", { bubbles: true })));
  }

  return (
    <DropdownMenu onOpenChange={(open) => !open && setSearch("")}>
      {name ? <input ref={input} type="hidden" name={name} value={current} /> : null}
      <DropdownMenuTrigger
        id={id}
        className="flex h-[38px] w-full items-center justify-between gap-2 rounded-lg border border-[var(--sat-border-strong)] bg-white px-2.5 text-left text-sm text-[var(--sat-text)] focus:border-[var(--sat-primary)] focus:outline-none focus:ring-[3px] focus:ring-[#93c5fd]/60 data-[state=open]:border-[var(--sat-primary)]"
      >
        <span className="min-w-0 truncate">{label}</span>
        <ChevronDown size={14} aria-hidden className="shrink-0 text-[var(--sat-muted)]" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-[var(--radix-dropdown-menu-trigger-width)] min-w-56 max-w-[calc(100vw-2rem)] p-0">
        <div className="flex items-center gap-2 border-b border-gray-100 px-2.5 py-2">
          <Search size={14} aria-hidden className="text-gray-400" />
          <input
            autoFocus
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            // Keep typing in the box (the menu would use the keys for typeahead / navigation).
            onKeyDown={(e) => e.key !== "Escape" && e.key !== "ArrowDown" && e.stopPropagation()}
            placeholder={searchPlaceholder}
            aria-label={searchPlaceholder}
            className="w-full bg-transparent text-sm outline-none placeholder:text-gray-400"
          />
        </div>
        <div className="max-h-72 overflow-y-auto p-1">
          {search ? null : (
            <Item selected={current === ""} onSelect={() => pick("")}>
              {allLabel}
            </Item>
          )}
          {shown.length === 0 ? <p className="px-2 py-1.5 text-sm text-gray-500">No match.</p> : null}
          {shown.map((o, index) => {
            // A group heading before the first option of each group.
            const heading = o.group && o.group !== shown[index - 1]?.group ? o.group : null;
            return (
              <div key={o.value}>
                {heading ? <DropdownMenuLabel className="px-2 pb-0.5 pt-2 text-[11px] font-semibold text-gray-500">{heading}</DropdownMenuLabel> : null}
                <Item selected={current === o.value} onSelect={() => pick(o.value)}>
                  {o.label}
                </Item>
              </div>
            );
          })}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function Item({ selected, onSelect, children }: { selected: boolean; onSelect: () => void; children: React.ReactNode }) {
  return (
    <DropdownMenuItem onSelect={onSelect} className={cn("gap-2", selected && "font-semibold")}>
      <Check size={14} aria-hidden className={cn("shrink-0", selected ? "text-[var(--sat-primary)]" : "invisible")} />
      <span className="truncate">{children}</span>
    </DropdownMenuItem>
  );
}
