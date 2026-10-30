import Link from "next/link";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { StickyOffset } from "@/components/sat/sticky-offset";

interface FilterBarProps extends React.HTMLAttributes<HTMLElement> {
  /** Optional title above the controls. */
  label?: string;
  /** Stays at the top while the list scrolls (md and up). Off for bars inside a card. */
  sticky?: boolean;
  /** Render as a GET `<form>` (URL-driven filters) instead of a `<div>` (live, client-side filters). */
  action?: string;
  /** Compact page navigation (Pagination `compact`): sticks with the filters, top right of the bar. */
  pager?: React.ReactNode;
}

/**
 * The one filter bar of the app (mockup `.filters`): white box, one row of labelled controls aligned
 * to the bottom. Every control inside is the same height (38px), so every bar has the same height
 * whatever its fields; on narrow containers the fields stack. On desktop it sticks to the top of the
 * page while a long list scrolls (`sticky={false}` for bars inside cards).
 */
export function FilterBar({ label, action, sticky = true, pager, className, children, ...props }: FilterBarProps) {
  const Component = action !== undefined ? "form" : "div";
  return (
    <Component
      action={action}
      role="search"
      data-filter-bar={sticky ? "" : undefined}
      className={cn(
        "@container mb-3.5 space-y-2 rounded-[var(--sat-radius)] border border-[var(--sat-border)] bg-white p-3",
        // Long lists: the filters stay on screen (desktop); table headers stick right under them.
        sticky && "md:sticky md:top-2 md:z-20 md:shadow-[0_6px_14px_-12px_rgba(15,23,42,0.35)]",
        // Same control height in every bar (inputs, selects, buttons and links styled as buttons).
        "[&_input:not([type=hidden]):not([type=checkbox])]:h-[38px] [&_select]:h-[38px] [&_button]:h-[38px] [&_a[data-filter-action]]:h-[38px]",
        className,
      )}
      {...props}
    >
      {sticky ? <StickyOffset /> : null}
      {label || pager ? (
        // With no label the row only shows when the pager renders (more than one page).
        <div className={cn("items-center justify-between gap-2", label ? "flex" : "hidden has-[nav]:flex")}>
          {label ? <p className="text-xs font-medium text-[var(--sat-muted)]">{label}</p> : <span />}
          {pager}
        </div>
      ) : null}
      <div className="flex flex-col gap-2.5 @md:flex-row @md:flex-wrap @md:items-end">{children}</div>
    </Component>
  );
}

/** One labelled control in a FilterBar (mockup `.field`): 12px muted label above, grows to fill. */
export function FilterField({ label, htmlFor, className, children }: { label: string; htmlFor?: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={cn("flex min-w-[108px] flex-1 flex-col gap-1", className)}>
      <label htmlFor={htmlFor} className="text-xs font-medium text-[var(--sat-muted)]">{label}</label>
      {children}
    </div>
  );
}

/**
 * Above this many options a filter drop-down gets a search box inside (SearchableSelect). Lives here,
 * not in the client component: a server page importing a constant from a "use client" file gets a
 * reference, not the number.
 */
export const SEARCHABLE_MIN_OPTIONS = 8;

/** Label class of a FilterField, for controls that render their own labels (TaxonomyPicker). */
export const FILTER_LABEL_CLASS = "text-xs font-medium text-[var(--sat-muted)]";
export const FILTER_FIELD_CLASS = "flex min-w-[108px] flex-1 flex-col gap-1";

/** Apply (submit) and, when something is filtered, Clear — the end of every URL-driven FilterBar. */
export function FilterActions({
  clearHref,
  clearLabel = "Clear",
  title,
  applyButton = true,
}: {
  clearHref?: string | null;
  clearLabel?: string;
  title?: string;
  /** false: the filters apply as soon as a value is chosen (no Apply button). */
  applyButton?: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      {applyButton ? <Button type="submit" variant="secondary" title={title}>Apply</Button> : null}
      {clearHref ? (
        <Button asChild variant="ghost">
          <Link href={clearHref} data-filter-action="">{clearLabel}</Link>
        </Button>
      ) : null}
    </div>
  );
}
