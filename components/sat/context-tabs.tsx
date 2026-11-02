import Link from "next/link";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ASSIGNMENT_CONTEXTS, contextLabel, type AssignmentContext, type ContextView } from "@/lib/assignment-context";

const VIEWS: { key: ContextView; label: string; hint: string }[] = [
  { key: "all", label: "All", hint: "Classroom and Homework. Scores come from Homework only." },
  { key: "classroom", label: "Classroom", hint: "Work done in class: what was done, no scores." },
  { key: "homework", label: "Homework", hint: "Scored practice: what results and reports count." },
];

/**
 * All / Classroom / Homework selector of practice (pendiente-p2.md): links that keep the other query
 * params (`context=all|classroom|homework`, All by default). Practice only; Tests have no context.
 */
export function ContextTabs({
  basePath,
  active,
  params = {},
  className,
}: {
  basePath: string;
  active: ContextView;
  /** Other query params to keep (area, student…). */
  params?: Record<string, string | undefined | null>;
  className?: string;
}) {
  const hrefFor = (view: ContextView) => {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) if (value) query.set(key, value);
    if (view !== "all") query.set("context", view);
    const qs = query.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  };
  return (
    <nav aria-label="Classroom or Homework" className={cn("inline-flex rounded-lg border border-[var(--sat-border)] bg-white p-0.5", className)}>
      {VIEWS.map((view) => (
        <Link
          key={view.key}
          href={hrefFor(view.key)}
          title={view.hint}
          aria-current={active === view.key ? "page" : undefined}
          className={cn(
            "rounded-md px-3 py-1 text-xs font-semibold",
            active === view.key ? "bg-[var(--sat-primary)] text-white" : "text-[var(--sat-muted)] hover:bg-[var(--sat-primary-soft)] hover:text-[var(--sat-text)]",
          )}
        >
          {view.label}
        </Link>
      ))}
    </nav>
  );
}

/**
 * Assign view: the Classroom · Homework choice above the sets (client trees only). Nothing is chosen
 * at first; the chosen tab filters which sets are already taken and is what gets assigned.
 */
export function ContextToggle({
  value,
  onChange,
  fixedReason,
  className,
}: {
  value: AssignmentContext | null;
  /** Missing: the context is fixed (`value`); the other tab says why (`fixedReason`). */
  onChange?: (context: AssignmentContext) => void;
  fixedReason?: string;
  className?: string;
}) {
  return (
    <div role="tablist" aria-label="Classroom or Homework" className={cn("inline-flex gap-0.5 rounded-lg border border-[var(--sat-border)] bg-white p-0.5", className)}>
      {ASSIGNMENT_CONTEXTS.map((context) => {
        const active = value === context;
        return (
          <Button
            key={context}
            type="button"
            size="sm"
            variant={active ? "primary" : "ghost"}
            role="tab"
            aria-selected={active}
            className={cn("h-7 rounded-md px-3 text-xs font-semibold", active ? "pointer-events-none" : "text-[var(--sat-muted)] hover:text-[var(--sat-text)]")}
            onClick={() => onChange?.(context)}
            disabledReason={!onChange && !active ? fixedReason ?? "Fixed." : null}
          >
            {contextLabel(context)}
          </Button>
        );
      })}
    </div>
  );
}
