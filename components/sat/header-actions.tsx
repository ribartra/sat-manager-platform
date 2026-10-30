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

/** Blue text shortcut with an arrow to a related page ("Questions →"), next to the header actions. */
export const HEADER_SHORTCUT_CLASS = "inline-flex h-8 items-center whitespace-nowrap px-1 text-sm font-medium text-[var(--sat-primary)] hover:underline";

export function HeaderActions({ className, children }: { className?: string; children: React.ReactNode }) {
  // Wraps instead of pushing the page wider on phones; one row at the right of the title on desktop.
  return <div className={cn("flex min-w-0 max-w-full flex-wrap items-center gap-2 sm:shrink-0 lg:justify-end", className)}>{children}</div>;
}
