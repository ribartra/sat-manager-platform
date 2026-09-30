import { cn } from "@/lib/utils";

type PageWidth = "narrow" | "default" | "wide" | "full";
type PageDensity = "comfortable" | "compact";

// One page width for every view (same container as the top nav), so the left/right
// margins never jump between views. `width` is kept for API compatibility only.
const PAGE_WIDTH = "max-w-[var(--sat-page-wide)]";
const WIDTH: Record<PageWidth, string> = {
  narrow: PAGE_WIDTH,
  default: PAGE_WIDTH,
  wide: PAGE_WIDTH,
  full: "max-w-none",
};

// Same outer vertical rhythm for every view: nav -> first content is always 32px.
const DENSITY_Y: Record<PageDensity, string> = {
  comfortable: "py-8",
  compact: "py-8",
};

interface PageShellProps extends React.HTMLAttributes<HTMLElement> {
  as?: React.ElementType;
  width?: PageWidth;
  density?: PageDensity;
}

/** Page container: the shared page width + horizontal padding. Prefer this over ad-hoc max-w-* wrappers. */
export function PageShell({
  as: Component = "div",
  className,
  width = "default",
  density = "comfortable",
  children,
  ...props
}: PageShellProps) {
  return (
    <Component
      data-page-shell=""
      className={cn("mx-auto w-full px-4", WIDTH[width], DENSITY_Y[density], className)}
      {...props}
    >
      {children}
    </Component>
  );
}

interface PageHeaderProps extends React.HTMLAttributes<HTMLElement> {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  density?: PageDensity;
}

export function PageHeader({
  title,
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
        "mb-6",
        className,
      )}
      {...props}
    >
      <div className="min-w-0">
        <h1 className="text-xl font-semibold text-foreground">{title}</h1>
        {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
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
