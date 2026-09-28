import { difficultyOptions } from "@/lib/domain-meta";
import type { ProgressFilterValues } from "@/lib/progress-filters";
import { buildProgressHref } from "@/lib/progress-filters";
import Link from "next/link";

export interface ProgressFilterTopic {
  id: string;
  name: string;
}

export function ProgressFilters({
  action,
  filters,
  topics,
  includeDates = true,
  preserve,
}: {
  action: string;
  filters: ProgressFilterValues;
  topics: ProgressFilterTopic[];
  includeDates?: boolean;
  /** Extra query params kept when applying or clearing filters (e.g. the active page tab). */
  preserve?: Record<string, string | undefined>;
}) {
  const preserved = Object.entries(preserve ?? {}).filter((entry): entry is [string, string] => Boolean(entry[1]));
  const clearHref = buildProgressHref(action, { area: filters.area, studentId: filters.studentId });
  const clearQuery = new URLSearchParams(preserved).toString();
  const isMocks = filters.area === "mocks";

  return (
    <form action={action} method="get" className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm sm:p-4">
      <input type="hidden" name="area" value={filters.area} />
      {filters.studentId ? <input type="hidden" name="studentId" value={filters.studentId} /> : null}
      {preserved.map(([name, value]) => <input key={name} type="hidden" name={name} value={value} />)}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {!isMocks && (
          <label className="text-xs font-medium text-gray-600">
            Topic
            <select name="topic" defaultValue={filters.topic ?? ""} className="mt-1 w-full rounded-md border border-gray-300 bg-white px-2 py-2 text-sm text-gray-900">
              <option value="">All topics</option>
              {topics.map((topic) => <option key={topic.id} value={topic.id}>{topic.name}</option>)}
            </select>
          </label>
        )}
        {!isMocks && (
          <label className="text-xs font-medium text-gray-600">
            Difficulty
            <select name="difficulty" defaultValue={filters.difficulty ?? ""} className="mt-1 w-full rounded-md border border-gray-300 bg-white px-2 py-2 text-sm text-gray-900">
              <option value="">All levels</option>
              {difficultyOptions().map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
        )}
        {includeDates && (
          <>
            <label className="text-xs font-medium text-gray-600">
              From
              <input name="from" type="date" defaultValue={filters.from ?? ""} className="mt-1 w-full rounded-md border border-gray-300 px-2 py-2 text-sm text-gray-900" />
            </label>
            <label className="text-xs font-medium text-gray-600">
              To
              <input name="to" type="date" defaultValue={filters.to ?? ""} className="mt-1 w-full rounded-md border border-gray-300 px-2 py-2 text-sm text-gray-900" />
            </label>
          </>
        )}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button type="submit" className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700">Apply filters</button>
        <Link href={clearQuery ? `${clearHref}${clearHref.includes("?") ? "&" : "?"}${clearQuery}` : clearHref} className="rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">Clear</Link>
        <span className="text-xs text-gray-500">Scores and charts use all questions matching these filters.</span>
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
