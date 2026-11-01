import { cn } from "@/lib/utils";

/** Section heading (mockup `.section-h`): title + optional one-line description, action on the right. */
export function SectionHeader({
  title,
  description,
  action,
  as: Heading = "h2",
  size = "md",
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  as?: "h2" | "h3";
  size?: "sm" | "md";
  className?: string;
}) {
  return (
    <div className={cn("mb-2.5 flex flex-wrap items-end justify-between gap-2", className)}>
      <div className="min-w-0">
        <Heading className={cn("font-bold text-[var(--sat-text)]", size === "sm" ? "text-[15px]" : "text-[17px]")}>{title}</Heading>
        {description ? <p className="text-[13px] text-[var(--sat-muted)]">{description}</p> : null}
      </div>
      {action ? <div className="flex shrink-0 flex-wrap items-center gap-2">{action}</div> : null}
    </div>
  );
}
