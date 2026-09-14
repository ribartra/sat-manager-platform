import { cn } from "@/lib/utils";

interface FilterBarProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Optional title above the controls. */
  label?: string;
}

/** Layout wrapper for list filters (search, selects, apply). */
export function FilterBar({ label, className, children, ...props }: FilterBarProps) {
  return (
    <div className={cn("@container mb-4 space-y-2", className)} {...props}>
      {label ? <p className="text-xs font-medium text-muted-foreground">{label}</p> : null}
      <div className="flex flex-col gap-3 @md:flex-row @md:flex-wrap @md:items-end">{children}</div>
    </div>
  );
}
