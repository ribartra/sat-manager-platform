import Link from "next/link";
import { Card } from "@/components/ui/card";
import { ChipStat } from "@/components/sat/stat-tile";

/**
 * One box per view on the teacher Home: the view's name, its main number, a few status chips, one
 * line of detail and the way in. The whole box links to the view.
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
}: {
  title: string;
  icon: React.ReactNode;
  href: string;
  value: React.ReactNode;
  valueLabel: React.ReactNode;
  chips?: { label: string; value: React.ReactNode; tone?: "default" | "danger" }[];
  line?: React.ReactNode;
  action: string;
}) {
  return (
    <Card as={Link} href={href} padding="md" className="flex min-h-[12rem] flex-col gap-2.5 hover:border-gray-400">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-base font-semibold text-[var(--sat-text)]">
          <span aria-hidden className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--sat-primary-soft)] text-[var(--sat-primary)]">{icon}</span>
          {title}
        </h2>
        <span aria-hidden className="text-gray-400">›</span>
      </div>
      <p className="flex items-baseline gap-2">
        <span className="text-3xl font-extrabold tabular-nums leading-none text-[var(--sat-text)]">{value}</span>
        <span className="text-sm text-[var(--sat-muted)]">{valueLabel}</span>
      </p>
      {chips.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {chips.map((c) => <ChipStat key={c.label} label={c.label} value={c.value} tone={c.tone} />)}
        </div>
      ) : null}
      {line ? <p className="truncate text-xs text-gray-600">{line}</p> : null}
      <div className="mt-auto border-t border-gray-100 pt-2 text-right text-xs font-medium text-blue-600">{action}</div>
    </Card>
  );
}
