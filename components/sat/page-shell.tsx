import { cn } from "@/lib/utils";

type PageWidth = "narrow" | "default" | "wide" | "full";
type PageDensity = "comfortable" | "compact";
/** Page widths of the mockup (`mejorada/*.html` `.page` max-width), in px. */
export type PageMaxWidth = 720 | 920 | 960 | 1000 | 1080 | 1100 | 1180;

// Legacy `width` names map to the mockup widths; `maxWidth` sets the exact mockup width per page.
const WIDTH: Record<PageWidth, PageMaxWidth | null> = {
  narrow: 1080,
  default: 1080,
  wide: 1080,
  full: null,
};

interface PageShellProps extends React.HTMLAttributes<HTMLElement> {
  as?: React.ElementType;
  width?: PageWidth;
  /** Mockup page width in px (default 1080). */
  maxWidth?: PageMaxWidth;
  density?: PageDensity;
}

/** Page container (mockup `.page`): centred, mockup width, padding 22px 20px 70px. Prefer this over ad-hoc max-w-* wrappers. */
export function PageShell({
  as: Component = "div",
  className,
  width = "default",
  maxWidth,
  density: _density,
  style,
  children,
  ...props
}: PageShellProps) {
  void _density;
  const px = maxWidth ?? WIDTH[width];
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

interface PageHeaderProps extends React.HTMLAttributes<HTMLElement> {
  title: string;
  description?: React.ReactNode;
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
        "mb-[18px]",
        className,
      )}
      {...props}
    >
      <div className="min-w-0">
        <h1 className="text-[26px] font-bold tracking-[-0.3px] text-[var(--sat-text)]">{title}</h1>
        {description ? <p className="mt-1 text-sm text-[var(--sat-muted)]">{description}</p> : null}
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
