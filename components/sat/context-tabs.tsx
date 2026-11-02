import Link from "next/link";
import { cn } from "@/lib/utils";
import type { ContextView } from "@/lib/assignment-context";

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
