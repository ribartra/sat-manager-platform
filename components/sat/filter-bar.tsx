import { cn } from "@/lib/utils";

interface FilterBarProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Optional title above the controls. */
  label?: string;
}

/** Filter card (mockup `.filters`): white box, controls wrap and align to the bottom. */
export function FilterBar({ label, className, children, ...props }: FilterBarProps) {
  return (
    <div
      className={cn(
        "@container mb-3.5 space-y-2 rounded-[var(--sat-radius)] border border-[var(--sat-border)] bg-white p-3",
        className,
      )}
      {...props}
    >
      {label ? <p className="text-xs font-medium text-[var(--sat-muted)]">{label}</p> : null}
      <div className="flex flex-col gap-2.5 @md:flex-row @md:flex-wrap @md:items-end">{children}</div>
    </div>
  );
}

/** One labelled control in a FilterBar (mockup `.field`): 12px muted label above, grows to fill. */
export function FilterField({ label, htmlFor, className, children }: { label: string; htmlFor?: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={cn("flex min-w-[150px] flex-1 flex-col gap-1", className)}>
      <label htmlFor={htmlFor} className="text-xs font-medium text-[var(--sat-muted)]">{label}</label>
      {children}
    </div>
  );
}
