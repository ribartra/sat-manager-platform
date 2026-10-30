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
  /** The view with this filter applied. */
  href?: string;
}

export interface ViewSummaryItem {
  key: string;
  label: React.ReactNode;
  detail?: React.ReactNode;
  href: string;
}

/**
 * One tall box per view on the teacher and student Home (up to 70% of the screen tall): the view's name, its main
 * number, its status (one chip per line, each opening the view with that filter), a short list of the
 * latest items (each opening it) and the way in. The rest of the box links to the view (the title link
 * covers it; chips and items sit above that cover).
 */
export function ViewSummaryCard({
  title,
  icon,
  href,
  value,
  valueLabel,
  chips = [],
  list,
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
  /** Latest items (students, tries, Tests) with their status. */
  list?: { title: string; items: ViewSummaryItem[]; empty: string };
  /** Icon badge colours: the Tests grey, or the primary blue. */
  accent?: "primary" | "tests";
  line?: React.ReactNode;
  action: string;
}) {
  return (
    // Tall, but capped at 70% of the screen: with fewer boxes (wider) they don't stretch to the bottom.
    <Card padding="md" className="relative flex min-h-[22rem] flex-col gap-3 hover:border-gray-400 lg:min-h-[min(calc(var(--app-vh)-11rem),calc(var(--app-vh)*0.7))]">
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
      <p>
        <span className="block text-4xl font-extrabold tabular-nums leading-none text-[var(--sat-text)]">{value}</span>
        <span className="mt-1 block text-sm text-[var(--sat-muted)]">{valueLabel}</span>
      </p>
      {chips.length > 0 ? (
        <div className="flex flex-col gap-1.5">
          {chips.map((c) => {
            const className = cn(
              "relative z-10 flex items-center justify-between gap-2 rounded-lg border px-2.5 py-1.5 text-xs leading-tight",
              c.color ? "border-current bg-white" : CHIP_TONE[c.tone ?? "default"],
              c.href && "hover:brightness-95 hover:underline",
            );
            const body = (
              <>
                <span>{c.label}</span> <b>{c.value}</b>
              </>
            );
            return c.href ? (
              <Link key={c.label} href={c.href} className={className} style={c.color ? { color: c.color } : undefined}>{body}</Link>
            ) : (
              <span key={c.label} className={className} style={c.color ? { color: c.color } : undefined}>{body}</span>
            );
          })}
        </div>
      ) : null}
      {line ? <p className="text-xs leading-relaxed text-gray-600">{line}</p> : null}
      {list ? (
        <div className="border-t border-gray-100 pt-2.5">
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--sat-muted)]">{list.title}</p>
          {list.items.length === 0 ? (
            <p className="text-xs text-gray-400">{list.empty}</p>
          ) : (
            <ul className="space-y-1">
              {list.items.map((item) => (
                <li key={item.key}>
                  <Link href={item.href} className="relative z-10 -mx-1.5 block rounded-md px-1.5 py-1 hover:bg-gray-50">
                    <span className="line-clamp-2 block text-sm text-gray-800">{item.label}</span>
                    {item.detail ? <span className="block text-xs text-gray-500">{item.detail}</span> : null}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
      <div className="mt-auto border-t border-gray-100 pt-2 text-right text-xs font-medium text-blue-600">{action}</div>
    </Card>
  );
}
