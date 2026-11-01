import { cn } from "@/lib/utils";

type PageWidth = "default" | "full";
type PageDensity = "comfortable" | "compact";

/**
 * The one page width of every view (px): every page starts at the same x and has the same width, so
 * switching views never moves the content. `full` (no max width) is only for full-screen surfaces.
 */
export const PAGE_WIDTH = 1180;

/** Title of every page (PageHeader; pages with their own header layout use the same class). */
export const PAGE_TITLE_CLASS = "text-[26px] font-bold leading-tight tracking-[-0.3px] text-[var(--sat-text)]";

interface PageShellProps extends React.HTMLAttributes<HTMLElement> {
  as?: React.ElementType;
  width?: PageWidth;
  density?: PageDensity;
}

/** Page container (mockup `.page`): centred, PAGE_WIDTH wide, padding 22px 20px 70px. Prefer this over ad-hoc max-w-* wrappers. */
export function PageShell({
  as: Component = "div",
  className,
  width = "default",
  density: _density,
  style,
  children,
  ...props
}: PageShellProps) {
  void _density;
  const px = width === "full" ? null : PAGE_WIDTH;
  return (
    <Component
      data-page-shell=""
      data-page-width={px ?? "full"}
      className={cn("mx-auto w-full px-4 pb-[70px] pt-[22px] sm:px-5", className)}
      style={{ maxWidth: px ? `${px}px` : "none", ...style }}
      {...props}
    >
      {children}
    </Component>
  );
}

interface PageHeaderProps extends Omit<React.HTMLAttributes<HTMLElement>, "title"> {
  /** Text, or a control that reads as the title (e.g. the student drop-down). */
  title: React.ReactNode;
  /** Small line above the title (chips: type, area, level, status). */
  eyebrow?: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  density?: PageDensity;
}

export function PageHeader({
  title,
  eyebrow,
  description,
  actions,
  className,
  ...props
}: PageHeaderProps) {
  // `density` no longer changes the header spacing (same rhythm in every view); kept for API compatibility.
  delete (props as { density?: PageDensity }).density;
  return (
    <header
      className={cn(
        "flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between",
        "mb-[18px]",
        className,
      )}
      {...props}
    >
      <div className="min-w-0">
        {eyebrow ? <div className="mb-1.5 flex flex-wrap items-center gap-2">{eyebrow}</div> : null}
        {typeof title === "string" ? <h1 className={PAGE_TITLE_CLASS}>{title}</h1> : title}
        {description ? <p className="mt-1 text-sm text-[var(--sat-muted)]">{description}</p> : null}
      </div>
      {actions ? <div className="flex min-w-0 max-w-full flex-wrap items-center gap-2 sm:shrink-0">{actions}</div> : null}
    </header>
  );
}

export function PageContent({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("@container space-y-4", className)} {...props}>
      {children}
    </div>
  );
}
