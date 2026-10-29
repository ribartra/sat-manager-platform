import Link from "next/link";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface FilterBarProps extends React.HTMLAttributes<HTMLElement> {
  /** Optional title above the controls. */
  label?: string;
  /** Render as a GET `<form>` (URL-driven filters) instead of a `<div>` (live, client-side filters). */
  action?: string;
}

/**
 * The one filter bar of the app (mockup `.filters`): white box, one row of labelled controls aligned
 * to the bottom. Every control inside is the same height (38px), so every bar has the same height
 * whatever its fields; on narrow containers the fields stack.
 */
export function FilterBar({ label, action, className, children, ...props }: FilterBarProps) {
  const Component = action !== undefined ? "form" : "div";
  return (
    <Component
      action={action}
      role="search"
      className={cn(
        "@container mb-3.5 space-y-2 rounded-[var(--sat-radius)] border border-[var(--sat-border)] bg-white p-3",
        // Same control height in every bar (inputs, selects, buttons and links styled as buttons).
        "[&_input:not([type=hidden]):not([type=checkbox])]:h-[38px] [&_select]:h-[38px] [&_button]:h-[38px] [&_a[data-filter-action]]:h-[38px]",
        className,
      )}
      {...props}
    >
      {label ? <p className="text-xs font-medium text-[var(--sat-muted)]">{label}</p> : null}
      <div className="flex flex-col gap-2.5 @md:flex-row @md:flex-wrap @md:items-end">{children}</div>
    </Component>
  );
}

/** One labelled control in a FilterBar (mockup `.field`): 12px muted label above, grows to fill. */
export function FilterField({ label, htmlFor, className, children }: { label: string; htmlFor?: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={cn("flex min-w-[130px] flex-1 flex-col gap-1", className)}>
      <label htmlFor={htmlFor} className="text-xs font-medium text-[var(--sat-muted)]">{label}</label>
      {children}
    </div>
  );
}

/** Label class of a FilterField, for controls that render their own labels (TaxonomyPicker). */
export const FILTER_LABEL_CLASS = "text-xs font-medium text-[var(--sat-muted)]";
export const FILTER_FIELD_CLASS = "flex min-w-[130px] flex-1 flex-col gap-1";

/** Apply (submit) and, when something is filtered, Clear — the end of every URL-driven FilterBar. */
export function FilterActions({ clearHref, clearLabel = "Clear", title }: { clearHref?: string | null; clearLabel?: string; title?: string }) {
  return (
    <div className="flex items-center gap-2">
      <Button type="submit" variant="secondary" title={title}>Apply</Button>
      {clearHref ? (
        <Button asChild variant="ghost">
          <Link href={clearHref} data-filter-action="">{clearLabel}</Link>
        </Button>
      ) : null}
    </div>
  );
}
