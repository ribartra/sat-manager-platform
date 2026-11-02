import { cn } from "@/lib/utils";

/**
 * A numbered step of the Assign view ("1. Choose the student", "2. Check what they have done"…),
 * read from top to bottom. The heading sits above the step's content.
 */
export function AssignStep({
  n,
  title,
  hint,
  children,
  className,
}: {
  n: number;
  title: React.ReactNode;
  hint?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("min-w-0", className)}>
      <div className="mb-2 flex flex-wrap items-center gap-x-2 gap-y-0.5">
        <span aria-hidden className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--sat-primary)] text-xs font-bold text-white">
          {n}
        </span>
        <h2 className="text-[15px] font-semibold text-[var(--sat-text)]">
          <span className="sr-only">Step {n}: </span>
          {title}
        </h2>
        {hint ? <p className="w-full pl-8 text-xs text-[var(--sat-muted)]">{hint}</p> : null}
      </div>
      {children}
    </section>
  );
}
