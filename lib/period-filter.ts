// Date filters are periods: All time, Last 30 / 60 / 90 days or a Custom start → end date.
// URL params: `period` (+ `from` / `to` as YYYY-MM-DD for Custom). A link with only `from` / `to`
// (older links) counts as Custom. Pages resolve the period to the dates they filter by.

/** The periods offered in every Period select. */
export const PERIODS = [
  { value: "all", label: "All time" },
  { value: "30d", label: "Last 30 days" },
  { value: "60d", label: "Last 60 days" },
  { value: "90d", label: "Last 90 days" },
  { value: "custom", label: "Custom…" },
] as const;

/** Periods still read from older links (and Home's "last 7 days" chips) but not offered in the select. */
const LEGACY_PERIODS = [
  { value: "week", label: "Last 7 days" },
  { value: "month", label: "Last month" },
  { value: "year", label: "Last year" },
] as const;

const ALL_PERIODS = [...PERIODS, ...LEGACY_PERIODS];

export type Period = (typeof ALL_PERIODS)[number]["value"];

const DAYS_BACK: Partial<Record<Period, number>> = { week: 7, "30d": 30, "60d": 60, "90d": 90 };

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
  const period = ALL_PERIODS.some((p) => p.value === params.period) ? (params.period as Period) : from || to ? "custom" : "all";
  if (period === "custom") {
    if (!from && !to) return { period: "all" };
    // A reversed range is read in order.
    return from && to && from > to ? { period, from: to, to: from } : { period, from, to };
  }
  if (period === "all") return { period };
  const start = new Date(now);
  const days = DAYS_BACK[period];
  if (days) start.setDate(start.getDate() - days);
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
  if (value.period !== "custom") return periodName(value.period);
  const thisYear = String(new Date().getFullYear());
  const fmt = (day?: string) =>
    day
      ? new Date(`${day}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", ...(short && day.startsWith(thisYear) ? {} : { year: "numeric" }) })
      : short ? "Start" : "…";
  return `${fmt(value.from)} – ${value.to ? fmt(value.to) : "today"}`;
}

/** The name of a (non-custom) period: "Last 30 days", "All time"… */
export function periodName(period: Period): string {
  return ALL_PERIODS.find((p) => p.value === period)?.label ?? "All time";
}

/** Whether the select lists this period (older ones only show while they are the current value). */
export function isOfferedPeriod(period: Period) {
  return PERIODS.some((p) => p.value === period);
}

/** "Last 30 days (Oct 2 – Nov 1, 2026)", "Oct 1, 2026 – Oct 29, 2026" or "All time": a report's header. */
export function periodSummary(value: PeriodValue, now = new Date()): string {
  if (value.period === "all") return "All time";
  if (value.period === "custom") return periodLabel(value);
  const fmt = (day: string) => new Date(`${day}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  return value.from ? `${periodName(value.period)} (${fmt(value.from)} – ${fmt(dayOf(now))})` : periodName(value.period);
}

export { dayOf as isoDay };
