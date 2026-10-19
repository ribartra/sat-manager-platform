import Link from "next/link";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type StatTone = "default" | "dark" | "warning" | "danger";

/**
 * Big-number tile (mockup stat cards): label, value, one sub line. With `href` the whole tile is a
 * link (e.g. "see them" sets a filter). `dark` is the Test total tile (grey with dark ink, as in the mockup).
 */
export function StatTile({
  label,
  value,
  sub,
  href,
  icon,
  iconTone,
  tone = "default",
  className,
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  sub?: React.ReactNode;
  href?: string;
  icon?: React.ReactNode;
  /** Colour of the round icon badge (mockup stat cards: green check, blue trend, amber clock). */
  iconTone?: "ok" | "info" | "warn";
  tone?: StatTone;
  className?: string;
}) {
  const dark = tone === "dark";
  const body = (
    <div className="flex items-center gap-3">
      {icon ? (
        <span
          aria-hidden
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
            iconTone === "ok"
              ? "bg-[var(--sat-ok-soft)] text-[var(--sat-ok)]"
              : iconTone === "info"
                ? "bg-[var(--sat-primary-soft)] text-[var(--sat-primary)]"
                : iconTone === "warn"
                  ? "bg-[var(--sat-warn-soft)] text-[var(--sat-warn)]"
                  : dark
                    ? "bg-white/40 text-[var(--sat-tests-ink)]"
                    : tone === "danger"
                      ? "bg-red-50 text-red-600"
                      : tone === "warning"
                        ? "bg-amber-50 text-amber-600"
                        : "bg-gray-100 text-gray-600",
          )}
        >
          {icon}
        </span>
      ) : null}
      <div className="min-w-0">
        <p className={cn("text-xs font-medium", dark ? "text-gray-700" : "text-[var(--sat-muted)]")}>{label}</p>
        <p className={cn("text-2xl font-extrabold tabular-nums leading-[1.1]", dark ? "text-[var(--sat-tests-ink)]" : "text-[var(--sat-text)]")}>{value}</p>
        {sub ? <p className={cn("mt-0.5 text-xs", dark ? "text-gray-600" : "text-[var(--sat-muted)]")}>{sub}</p> : null}
      </div>
    </div>
  );
  const classes = cn(dark && "border-[var(--sat-area-tests)] bg-[var(--sat-area-tests)]", href && dark && "hover:brightness-95", className);
  return href ? (
    <Card as={Link} href={href} padding="md" className={cn("block", classes)}>
      {body}
    </Card>
  ) : (
    <Card padding="md" className={classes}>
      {body}
    </Card>
  );
}

/** Responsive row of StatTiles (2 columns on phones, `cols` from `sm`). */
export function StatGrid({ cols = 4, className, children }: { cols?: 2 | 3 | 4 | 5; className?: string; children: React.ReactNode }) {
  const colClass = { 2: "sm:grid-cols-2", 3: "sm:grid-cols-3", 4: "sm:grid-cols-2 lg:grid-cols-4", 5: "sm:grid-cols-3 lg:grid-cols-5" }[cols];
  return <div className={cn("grid grid-cols-2 gap-3.5", colClass, className)}>{children}</div>;
}

/** "▲ 6 points vs. previous practice" / "▼ 4 …". Nothing when there is no previous value. */
export function Delta({ value, suffix = "", unit = "points", className }: { value: number | null | undefined; suffix?: string; unit?: string; className?: string }) {
  if (value === null || value === undefined) return null;
  const up = value >= 0;
  return (
    <span className={cn("whitespace-nowrap text-xs font-bold", up ? "text-[var(--sat-ok)]" : "text-[var(--sat-bad)]", className)}>
      {up ? "▲" : "▼"} {Math.abs(value)}{unit ? ` ${unit}` : ""}{suffix ? ` ${suffix}` : ""}
    </span>
  );
}

/** Small grey chip "Completed 3 of 5" (mockup `.echip`). */
export function ChipStat({ label, value, tone = "default" }: { label: React.ReactNode; value: React.ReactNode; tone?: "default" | "danger" }) {
  return (
    <span className={cn("rounded-lg px-2 py-1.5 text-xs leading-tight", tone === "danger" ? "bg-[var(--sat-bad-soft)] text-[var(--sat-bad)]" : "bg-[var(--sat-surface-2)] text-[var(--sat-muted)]")}>
      {label} <b className={tone === "danger" ? "" : "text-[var(--sat-text)]"}>{value}</b>
    </span>
  );
}
