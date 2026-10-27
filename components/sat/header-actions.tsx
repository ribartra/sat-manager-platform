import { cn } from "@/lib/utils";

/**
 * Page actions, top right of the page header (the student profile's style). Every role's views use
 * this slot and HEADER_ACTION_CLASS so actions look and sit the same everywhere: Back, Report,
 * Invalidate attempt, Try again, …
 */
export const HEADER_ACTION_CLASS =
  "inline-flex h-8 items-center justify-center gap-1.5 whitespace-nowrap rounded-md border border-gray-300 bg-white px-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50";

/** Red text variant of HEADER_ACTION_CLASS (Invalidate attempt). */
export const HEADER_ACTION_DANGER_CLASS = `${HEADER_ACTION_CLASS} text-[var(--sat-bad)] hover:bg-[var(--sat-bad-soft)]`;

export function HeaderActions({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn("flex shrink-0 flex-wrap items-center gap-2 lg:justify-end", className)}>{children}</div>;
}
