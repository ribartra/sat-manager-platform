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
  tone = "default",
  className,
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  sub?: React.ReactNode;
  href?: string;
  icon?: React.ReactNode;
  tone?: StatTone;
  className?: string;
}) {
  const dark = tone === "dark";
  const body = (
    <div className="flex items-start gap-3">
      {icon ? (
        <span
          aria-hidden
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
            dark ? "bg-white/40 text-[var(--sat-tests-ink)]" : tone === "danger" ? "bg-red-50 text-red-600" : tone === "warning" ? "bg-amber-50 text-amber-600" : "bg-gray-100 text-gray-600",
          )}
        >
          {icon}
        </span>
      ) : null}
      <div className="min-w-0">
        <p className={cn("text-xs font-medium", dark ? "text-gray-700" : "text-gray-500")}>{label}</p>
        <p className={cn("mt-0.5 text-2xl font-bold tabular-nums leading-tight", dark ? "text-[var(--sat-tests-ink)]" : "text-gray-900")}>{value}</p>
        {sub ? <p className={cn("mt-0.5 text-xs", dark ? "text-gray-600" : "text-gray-500")}>{sub}</p> : null}
      </div>
    </div>
  );
  const classes = cn(dark && "border-[var(--sat-area-tests)] bg-[var(--sat-area-tests)]", href && (dark ? "hover:brightness-95" : "hover:border-gray-400"), className);
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
  return <div className={cn("grid grid-cols-2 gap-3", colClass, className)}>{children}</div>;
}

/** "▲ 6 points vs. previous practice" / "▼ 4 …". Nothing when there is no previous value. */
export function Delta({ value, suffix = "", unit = "points", className }: { value: number | null | undefined; suffix?: string; unit?: string; className?: string }) {
  if (value === null || value === undefined) return null;
  const up = value >= 0;
  return (
    <span className={cn("whitespace-nowrap text-xs font-medium", up ? "text-green-700" : "text-red-600", className)}>
      {up ? "▲" : "▼"} {Math.abs(value)}{unit ? ` ${unit}` : ""}{suffix ? ` ${suffix}` : ""}
    </span>
  );
}

/** Small grey chip "Completed 3 of 5" (mockup `.echip`). */
export function ChipStat({ label, value, tone = "default" }: { label: React.ReactNode; value: React.ReactNode; tone?: "default" | "danger" }) {
  return (
    <span className={cn("rounded-md px-2 py-1 text-xs", tone === "danger" ? "bg-red-50 text-red-700" : "bg-gray-100 text-gray-600")}>
      {label} <b className={tone === "danger" ? "" : "text-gray-900"}>{value}</b>
    </span>
  );
}
