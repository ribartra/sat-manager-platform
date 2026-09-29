import { difficultyOptions } from "@/lib/domain-meta";
import type { ProgressFilterValues } from "@/lib/progress-filters";
import { buildProgressHref } from "@/lib/progress-filters";
import Link from "next/link";

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
      {[...groups.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([group, items]) => (
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
  const isMocks = filters.area === "mocks";
  const preserved = Object.entries(preserve ?? {}).filter((entry): entry is [string, string] => Boolean(entry[1]));
  const clearHref = buildProgressHref(action, { area: filters.area, studentId: filters.studentId });
  const clearQuery = new URLSearchParams(preserved).toString();
  const fieldClass = "mt-1 w-full rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900";
  const active = [filters.topic, filters.difficulty, filters.from, showEndDate ? filters.to : undefined].filter(Boolean).length;

  return (
    <form action={action} method="get" className="rounded-lg border border-gray-200 bg-white px-3 py-2.5 shadow-sm">
      <input type="hidden" name="area" value={filters.area} />
      {filters.studentId ? <input type="hidden" name="studentId" value={filters.studentId} /> : null}
      {preserved.map(([name, value]) => <input key={name} type="hidden" name={name} value={value} />)}
      <div className="flex flex-wrap items-end gap-x-3 gap-y-2">
        {!isMocks && (
          <label className="min-w-[14rem] flex-[2] text-xs font-medium text-gray-600">
            Skill
            <select name="topic" defaultValue={filters.topic ?? ""} className={fieldClass}>
              <option value="">All skills</option>
              <SkillOptions topics={topics} />
            </select>
          </label>
        )}
        {!isMocks && (
          <label className="min-w-[8rem] flex-1 text-xs font-medium text-gray-600">
            Difficulty
            <select name="difficulty" defaultValue={filters.difficulty ?? ""} className={fieldClass}>
              <option value="">All levels</option>
              {difficultyOptions().map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
        )}
        {includeDates && (
          <>
            <label className="min-w-[9rem] flex-1 text-xs font-medium text-gray-600" title={showEndDate ? undefined : "Everything from this date until today."}>
              From
              <input name="from" type="date" defaultValue={filters.from ?? ""} className={fieldClass} />
            </label>
            {showEndDate && (
              <label className="min-w-[9rem] flex-1 text-xs font-medium text-gray-600">
                To
                <input name="to" type="date" defaultValue={filters.to ?? ""} className={fieldClass} />
              </label>
            )}
          </>
        )}
        <div className="flex items-center gap-2">
          <button
            type="submit"
            title="Scores and charts use every question matching these filters (blank answers count as incorrect)."
            className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
          >
            Apply
          </button>
          {active > 0 && (
            <Link
              href={clearQuery ? `${clearHref}${clearHref.includes("?") ? "&" : "?"}${clearQuery}` : clearHref}
              title="Remove skill, difficulty and date filters"
              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Clear ({active})
            </Link>
          )}
        </div>
      </div>
    </form>
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
