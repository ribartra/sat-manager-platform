import Link from "next/link";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/** Same colours as the views: status badges (Completed / In progress / Not started / Overdue). */
const CHIP_TONE = {
  default: "border-transparent bg-[var(--sat-surface-2)] text-[var(--sat-muted)]",
  success: "border-[var(--sat-ok-border)] bg-[var(--sat-ok-soft)] text-[var(--sat-ok)]",
  warning: "border-[var(--sat-warn-border)] bg-[var(--sat-warn-soft)] text-[var(--sat-warn)]",
  danger: "border-[var(--sat-bad-border)] bg-[var(--sat-bad-soft)] text-[var(--sat-bad)]",
  info: "border-blue-200 bg-[var(--sat-primary-soft)] text-[var(--sat-primary)]",
} as const;

export interface ViewSummaryChip {
  label: string;
  value: React.ReactNode;
  tone?: keyof typeof CHIP_TONE;
  /** Area colour (Math / Reading / Writing), as on the practice and Test surfaces. */
  color?: string;
}

/**
 * One box per view on the teacher Home: the view's name, its main number, a few status chips, one
 * line of detail and the way in. The whole box links to the view (the title link covers it).
 */
export function ViewSummaryCard({
  title,
  icon,
  href,
  value,
  valueLabel,
  chips = [],
  line,
  action,
  accent = "primary",
}: {
  title: string;
  icon: React.ReactNode;
  href: string;
  value: React.ReactNode;
  valueLabel: React.ReactNode;
  chips?: ViewSummaryChip[];
  /** Icon badge colours: the Tests grey, or the primary blue. */
  accent?: "primary" | "tests";
  line?: React.ReactNode;
  action: string;
}) {
  return (
    <Card padding="md" className="relative flex min-h-[12rem] flex-col gap-2.5 hover:border-gray-400">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-base font-semibold text-[var(--sat-text)]">
          <span
            aria-hidden
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-full",
              accent === "tests" ? "bg-[var(--sat-area-tests)] text-[var(--sat-tests-ink)]" : "bg-[var(--sat-primary-soft)] text-[var(--sat-primary)]",
            )}
          >
            {icon}
          </span>
          <Link href={href} className="after:absolute after:inset-0 after:rounded-[inherit]">{title}</Link>
        </h2>
        <span aria-hidden className="text-gray-400">›</span>
      </div>
      <p className="flex items-baseline gap-2">
        <span className="text-3xl font-extrabold tabular-nums leading-none text-[var(--sat-text)]">{value}</span>
        <span className="text-sm text-[var(--sat-muted)]">{valueLabel}</span>
      </p>
      {chips.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {chips.map((c) => (
            <span
              key={c.label}
              className={cn("rounded-lg border px-2 py-1 text-xs leading-tight", c.color ? "border-current bg-white" : CHIP_TONE[c.tone ?? "default"])}
              style={c.color ? { color: c.color } : undefined}
            >
              {c.label} <b>{c.value}</b>
            </span>
          ))}
        </div>
      ) : null}
      {line ? <p className="truncate text-xs text-gray-600">{line}</p> : null}
      <div className="mt-auto border-t border-gray-100 pt-2 text-right text-xs font-medium text-blue-600">{action}</div>
    </Card>
  );
}
