import { getFeatureSetting } from "@/lib/app-settings";

/**
 * Time filters are open-ended by default: unless Admin → Settings → "Show 'to' date in time
 * filters" is on, the end date is neither shown nor applied (range runs until today).
 */
export async function applyTimeFilterSetting<T extends { to?: string | null }>(
  filters: T,
): Promise<{ filters: T; showEndDate: boolean }> {
  const showEndDate = await getFeatureSetting("TIME_FILTER_END_DATE");
  return { filters: showEndDate ? filters : { ...filters, to: undefined }, showEndDate };
}
