// Date filters are periods: All time, Last week, Last month, Last year or a Custom start → end date.
// URL params: `period` (+ `from` / `to` as YYYY-MM-DD for Custom). A link with only `from` / `to`
// (older links) counts as Custom. Pages resolve the period to the dates they filter by.

export const PERIODS = [
  { value: "all", label: "All time" },
  { value: "week", label: "Last week" },
  { value: "month", label: "Last month" },
  { value: "year", label: "Last year" },
  { value: "custom", label: "Custom…" },
] as const;

export type Period = (typeof PERIODS)[number]["value"];

export interface PeriodValue {
  period: Period;
  /** Start date (YYYY-MM-DD), inclusive; none = no lower bound. */
  from?: string;
  /** End date (YYYY-MM-DD), inclusive; only for Custom. */
  to?: string;
}

const isDay = (value?: string | null): value is string => Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(new Date(`${value}T00:00:00`).getTime()));
const dayOf = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

/** The period chosen in the URL and the dates it covers (relative periods end today). */
export function resolvePeriod(params: { period?: string | null; from?: string | null; to?: string | null }, now = new Date()): PeriodValue {
  const from = isDay(params.from) ? params.from : undefined;
  const to = isDay(params.to) ? params.to : undefined;
  const period = PERIODS.some((p) => p.value === params.period) ? (params.period as Period) : from || to ? "custom" : "all";
  if (period === "custom") {
    if (!from && !to) return { period: "all" };
    // A reversed range is read in order.
    return from && to && from > to ? { period, from: to, to: from } : { period, from, to };
  }
  if (period === "all") return { period };
  const start = new Date(now);
  if (period === "week") start.setDate(start.getDate() - 7);
  if (period === "month") start.setMonth(start.getMonth() - 1);
  if (period === "year") start.setFullYear(start.getFullYear() - 1);
  return { period, from: dayOf(start) };
}

/** URL params that keep the period (links, pagination): Custom keeps its dates, the rest only the period. */
export function periodParams(value: PeriodValue): Record<string, string | undefined> {
  if (value.period === "all") return {};
  return value.period === "custom" ? { period: "custom", from: value.from, to: value.to } : { period: value.period };
}

/** Start / end of the period as Dates (end of the day for `to`). */
export function periodDates(value: PeriodValue): { from?: Date; to?: Date } {
  return {
    from: value.from ? new Date(`${value.from}T00:00:00`) : undefined,
    to: value.to ? new Date(`${value.to}T23:59:59.999`) : undefined,
  };
}

/** Custom: "Oct 1, 2026 – Oct 29, 2026" (`short`: "Oct 1 – Oct 29", years only when not this year); else the period's name. */
export function periodLabel(value: PeriodValue, short = false): string {
  if (value.period !== "custom") return PERIODS.find((p) => p.value === value.period)?.label ?? "All time";
  const thisYear = String(new Date().getFullYear());
  const fmt = (day?: string) =>
    day
      ? new Date(`${day}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", ...(short && day.startsWith(thisYear) ? {} : { year: "numeric" }) })
      : short ? "Start" : "…";
  return `${fmt(value.from)} – ${value.to ? fmt(value.to) : "today"}`;
}

export { dayOf as isoDay };
