import Link from "next/link";
import { Search } from "lucide-react";
import { FilterBar, FilterField } from "@/components/sat/filter-bar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

export interface ListFilterSelect {
  /** URL param name. */
  name: string;
  label: string;
  /** Current value ("" = all). */
  value?: string;
  /** First option, value "" (e.g. "All statuses"). */
  allLabel: string;
  options: { value: string; label: string }[];
}

/**
 * The search + filters bar of every list (teacher and admin): a GET form on FilterBar with a text
 * search (`q`) and the list's own filters. Results are filtered on the server from the URL, so a
 * filtered list can be linked and paginated (Pagination keeps the params). `hidden` keeps other params
 * (e.g. the current tab).
 */
export function ListFilters({
  action,
  q,
  placeholder = "Search",
  filters = [],
  hidden = {},
  qName = "q",
}: {
  action: string;
  q?: string;
  placeholder?: string;
  filters?: ListFilterSelect[];
  hidden?: Record<string, string | undefined>;
  /** Param name of the text search (default `q`). */
  qName?: string;
}) {
  const active = Boolean(q) || filters.some((f) => f.value);
  const keep = Object.entries(hidden).filter((entry): entry is [string, string] => Boolean(entry[1]));
  const clearHref = keep.length ? `${action}?${new URLSearchParams(keep).toString()}` : action;
  return (
    <FilterBar action={action} role="search">
      {keep.map(([name, value]) => <input key={name} type="hidden" name={name} value={value} />)}
      <FilterField label="Search" htmlFor={`lf-${qName}`} className="@md:flex-[2]">
        <div className="relative">
          <Search size={14} aria-hidden className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <Input id={`lf-${qName}`} name={qName} type="search" defaultValue={q ?? ""} placeholder={placeholder} className="pl-8" />
        </div>
      </FilterField>
      {filters.map((f) => (
        <FilterField key={f.name} label={f.label} htmlFor={`lf-${f.name}`}>
          <Select id={`lf-${f.name}`} name={f.name} defaultValue={f.value ?? ""}>
            <option value="">{f.allLabel}</option>
            {f.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </Select>
        </FilterField>
      ))}
      <div className="flex items-center gap-2">
        <Button type="submit" variant="secondary">Apply</Button>
        {active ? (
          <Button asChild variant="ghost">
            <Link href={clearHref}>Clear</Link>
          </Button>
        ) : null}
      </div>
    </FilterBar>
  );
}

/** Case-insensitive "contains" for in-memory lists filtered by `q`. */
export function matchesQuery(q: string | undefined, ...fields: (string | null | undefined)[]) {
  const needle = (q ?? "").trim().toLowerCase();
  if (!needle) return true;
  return fields.some((field) => (field ?? "").toLowerCase().includes(needle));
}
