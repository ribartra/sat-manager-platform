import { activeAreaTab, type AreaTabKey } from "@/lib/practice-area";

export type ProgressFilterValues = {
  area: AreaTabKey;
  topic?: string;
  difficulty?: string;
  from?: string;
  to?: string;
  studentId?: string;
};

export function progressFiltersFromParams(params: {
  area?: string | null;
  topic?: string | null;
  difficulty?: string | null;
  from?: string | null;
  to?: string | null;
  studentId?: string | null;
}): ProgressFilterValues {
  return {
    area: activeAreaTab(params.area, "math"),
    topic: params.topic || undefined,
    difficulty: params.difficulty || undefined,
    from: params.from || undefined,
    to: params.to || undefined,
    studentId: params.studentId || undefined,
  };
}

export function progressFilterEntries(filters: Partial<ProgressFilterValues>) {
  return Object.entries(filters).filter(([, value]) => Boolean(value)) as Array<[string, string]>;
}

export function buildProgressHref(
  pathname: string,
  filters: Partial<ProgressFilterValues>,
  overrides?: Partial<ProgressFilterValues>,
): string {
  const params = new URLSearchParams();
  const merged = { ...filters, ...overrides };
  for (const [key, value] of progressFilterEntries(merged)) params.set(key, value);
  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}

export function progressFilterQuery(filters: Partial<ProgressFilterValues>): string {
  const params = new URLSearchParams();
  for (const [key, value] of progressFilterEntries(filters)) params.set(key, value);
  return params.toString();
}

export function parseProgressDate(value?: string, endOfDay = false): Date | undefined {
  if (!value) return undefined;
  const date = new Date(`${value}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}`);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

export function progressDateWhere(filters: Pick<ProgressFilterValues, "from" | "to">) {
  const from = parseProgressDate(filters.from);
  const to = parseProgressDate(filters.to, true);
  return from || to
    ? {
        submittedAt: {
          ...(from ? { gte: from } : {}),
          ...(to ? { lte: to } : {}),
        },
      }
    : {};
}

export function clearTopicWhenAreaChanges(
  filters: Partial<ProgressFilterValues>,
  nextArea: AreaTabKey,
): Partial<ProgressFilterValues> {
  return { ...filters, area: nextArea, topic: undefined };
}
