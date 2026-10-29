import { difficultyOptions } from "@/lib/domain-meta";
import type { ProgressFilterValues } from "@/lib/progress-filters";
import { buildProgressHref } from "@/lib/progress-filters";
import { FilterActions, FilterBar, FilterField } from "@/components/sat/filter-bar";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

export interface ProgressFilterTopic {
  id: string;
  name: string;
  /** Domain name; when present the Skill select groups options by domain (Domain → Skill). */
  group?: string;
}

// Note: the `topic` query param / Topic table is the SKILL level of the taxonomy
// (Section → Domain → Skill); the UI therefore labels it "Skill".
export function SkillOptions({ topics }: { topics: ProgressFilterTopic[] }) {
  if (!topics.some((topic) => topic.group)) {
    return <>{topics.map((topic) => <option key={topic.id} value={topic.id}>{topic.name}</option>)}</>;
  }
  const groups = new Map<string, ProgressFilterTopic[]>();
  for (const topic of topics) {
    const key = topic.group ?? "Other";
    groups.set(key, [...(groups.get(key) ?? []), topic]);
  }
  return (
    <>
      {/* Groups keep the order of `topics` (callers pass the official Domain → Skill order). */}
      {[...groups.entries()].map(([group, items]) => (
        <optgroup key={group} label={group}>
          {items.map((topic) => <option key={topic.id} value={topic.id}>{topic.name}</option>)}
        </optgroup>
      ))}
    </>
  );
}

export function ProgressFilters({
  action,
  filters,
  topics,
  includeDates = true,
  showEndDate = false,
  preserve,
}: {
  action: string;
  filters: ProgressFilterValues;
  topics: ProgressFilterTopic[];
  includeDates?: boolean;
  /** Show the "To" date (Admin → Settings → TIME_FILTER_END_DATE). Off: open-ended range. */
  showEndDate?: boolean;
  /** Extra query params kept when applying or clearing filters (e.g. the active page tab). */
  preserve?: Record<string, string | undefined>;
}) {
  const isMocks = filters.area === "tests";
  const preserved = Object.entries(preserve ?? {}).filter((entry): entry is [string, string] => Boolean(entry[1]));
  const clearHref = buildProgressHref(action, { area: filters.area, studentId: filters.studentId });
  const clearQuery = new URLSearchParams(preserved).toString();
  const active = [filters.topic, filters.difficulty, filters.from, showEndDate ? filters.to : undefined].filter(Boolean).length;

  const clearTarget = clearQuery ? `${clearHref}${clearHref.includes("?") ? "&" : "?"}${clearQuery}` : clearHref;

  return (
    <FilterBar action={action}>
      <input type="hidden" name="area" value={filters.area} />
      {filters.studentId ? <input type="hidden" name="studentId" value={filters.studentId} /> : null}
      {preserved.map(([name, value]) => <input key={name} type="hidden" name={name} value={value} />)}
      {!isMocks && (
        <FilterField label="Skill" htmlFor="pf-topic" className="@md:flex-[2]">
          <Select id="pf-topic" name="topic" defaultValue={filters.topic ?? ""}>
            <option value="">All skills</option>
            <SkillOptions topics={topics} />
          </Select>
        </FilterField>
      )}
      {!isMocks && (
        <FilterField label="Difficulty" htmlFor="pf-difficulty">
          <Select id="pf-difficulty" name="difficulty" defaultValue={filters.difficulty ?? ""}>
            <option value="">All levels</option>
            {difficultyOptions().map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </Select>
        </FilterField>
      )}
      {includeDates && (
        <>
          <FilterField label="From" htmlFor="pf-from" className="@md:max-w-[11rem]">
            <Input id="pf-from" name="from" type="date" defaultValue={filters.from ?? ""} title={showEndDate ? undefined : "Everything from this date until today."} />
          </FilterField>
          {showEndDate && (
            <FilterField label="To" htmlFor="pf-to" className="@md:max-w-[11rem]">
              <Input id="pf-to" name="to" type="date" defaultValue={filters.to ?? ""} />
            </FilterField>
          )}
        </>
      )}
      <FilterActions clearHref={active > 0 ? clearTarget : null} clearLabel={`Clear (${active})`} title="Blank answers count as wrong." />
    </FilterBar>
  );
}

export function progressFilterState(filters: ProgressFilterValues): Pick<ProgressFilterValues, "area" | "topic" | "difficulty" | "from" | "to"> {
  return {
    area: filters.area,
    topic: filters.topic,
    difficulty: filters.difficulty,
    from: filters.from,
    to: filters.to,
  };
}
