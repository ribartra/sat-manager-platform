import Link from "next/link";
import { cn } from "@/lib/utils";

/** Mockup `.list`: a column of separate row cards, 8px apart. */
export function ListStack({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("flex flex-col gap-2", className)} {...props}>
      {children}
    </div>
  );
}

/**
 * Mockup `.li`: one white row card (radius 10, `12px 14px`), content left and actions right.
 * With `href` the whole row is a link and gets the blue card hover. `compact` = `.mini-list .li`.
 */
export function ListItem({
  href,
  compact = false,
  className,
  children,
}: {
  href?: string;
  compact?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  const classes = cn(
    "flex items-center justify-between gap-3.5 rounded-[var(--sat-radius)] border border-[var(--sat-border)] bg-white max-[560px]:flex-wrap",
    compact ? "px-3 py-[9px]" : "px-3.5 py-3",
    href && "transition-[border-color,box-shadow] hover:border-[#93c5fd] hover:shadow-[0_4px_14px_rgba(37,99,235,.1)]",
    className,
  );
  return href ? (
    <Link href={href} className={classes}>
      {children}
    </Link>
  ) : (
    <div className={classes}>{children}</div>
  );
}
