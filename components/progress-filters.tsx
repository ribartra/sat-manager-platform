import { difficultyOptions } from "@/lib/domain-meta";
import type { ProgressFilterValues } from "@/lib/progress-filters";
import { buildProgressHref } from "@/lib/progress-filters";
import { FilterActions, FilterBar, FilterField } from "@/components/sat/filter-bar";
import { Select } from "@/components/ui/select";
import { PeriodFilter } from "@/components/sat/period-filter";
import type { PeriodValue } from "@/lib/period-filter";

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
  period,
  preserve,
}: {
  action: string;
  filters: ProgressFilterValues;
  topics: ProgressFilterTopic[];
  /** Date filter as a period (All time, Last week… Custom); omitted = no date filter. */
  period?: PeriodValue;
  /** Extra query params kept when applying or clearing filters (e.g. the active page tab). */
  preserve?: Record<string, string | undefined>;
}) {
  const isMocks = filters.area === "tests";
  const preserved = Object.entries(preserve ?? {}).filter((entry): entry is [string, string] => Boolean(entry[1]));
  const clearHref = buildProgressHref(action, { area: filters.area, studentId: filters.studentId });
  const clearQuery = new URLSearchParams(preserved).toString();
  const active = [filters.topic, filters.difficulty, period && period.period !== "all" ? period.period : undefined].filter(Boolean).length;

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
      {period ? <PeriodFilter value={period} /> : null}
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
