import Link from "next/link";
import { Card } from "@/components/ui/card";
import { ChipStat, Delta } from "@/components/sat/stat-tile";
import { Pct } from "@/components/sat/work-status";
import { AreaTag, StripedBar } from "@/components/sat/practice-set-row";
import type { PracticeAreaCode } from "@/lib/practice-area";
import type { AreaPracticeSummary } from "@/lib/student-practice";
import { tabFromPracticeArea } from "@/lib/practice-area";
import { formatDate, relativeDay } from "@/lib/utils";

/**
 * One practice area box (mockup `.area-box`): latest practice %, change vs. the previous one, chips,
 * weakest skill and a footer. Practice data only — SAT scores never appear here (Tests have their
 * own tab). Shared by student Home, student Practice and the teacher's per-student Summary.
 */
export interface AreaSummaryCardProps {
  area: PracticeAreaCode;
  label: string;
  /** Without href the box is a plain card (teacher area tab). */
  href?: string;
  latest: { caption: React.ReactNode; pct: number | null; detail?: React.ReactNode } | null;
  delta?: number | null;
  chips?: { label: string; value: React.ReactNode; tone?: "default" | "danger" }[];
  weakest?: React.ReactNode;
  footer: React.ReactNode;
  action: React.ReactNode;
  emptyText: string;
}

export function AreaSummaryCard({ area, label, href, latest, delta, chips = [], weakest, footer, action, emptyText }: AreaSummaryCardProps) {
  const tab = tabFromPracticeArea(area) ?? "math";
  return (
    <Card
      as={href ? Link : "div"}
      href={href}
      padding="md"
      className={`flex min-h-[14rem] flex-col gap-2 border-t-[6px] ${href ? "hover:border-gray-400" : ""}`}
      style={{ borderTopColor: `var(--sat-area-${tab})` }}
    >
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold" style={{ color: `var(--sat-area-${tab})` }}>{label}</h2>
        {href ? <span aria-hidden className="text-gray-400">›</span> : null}
      </div>
      {latest ? (
        <div>
          <p className="text-xs text-gray-500">{latest.caption}</p>
          <p className="mt-1 flex items-end gap-2">
            <Pct value={latest.pct} className="text-4xl font-bold leading-none" color={`var(--sat-area-${tab})`} />
            {latest.detail ? <span className="text-xs text-gray-500">{latest.detail}</span> : null}
          </p>
          {delta !== null && delta !== undefined ? <Delta value={delta} unit="%" suffix="vs. previous practice" className="mt-1 block" /> : null}
        </div>
      ) : (
        <p className="text-sm text-gray-500">{emptyText}</p>
      )}
      {chips.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {chips.map((c) => <ChipStat key={c.label} label={c.label} value={c.value} tone={c.tone} />)}
        </div>
      ) : null}
      {weakest ? <p className="text-xs text-gray-600">{weakest}</p> : null}
      <div className="mt-auto flex items-center justify-between gap-2 border-t border-gray-100 pt-2 text-xs text-gray-500">
        <span>{footer}</span>
        <span className="shrink-0 font-medium text-blue-600">{action}</span>
      </div>
    </Card>
  );
}

/**
 * Teacher's per-area summary at attempt level: Easy / Medium / Hard each show ONE attempt (the most
 * recent at that level: its set and date, linked), with the weakest skill underneath. Never an
 * average across sets. A level without attempts shows "—" (no attempts), never 0%.
 */
export function DifficultySummaryCard({
  area,
  label,
  levels,
  weakest,
  footer,
  emptyText,
}: {
  area: PracticeAreaCode;
  label: string;
  levels: { key: string; label: string; correct: number; total: number; percent: number | null; caption?: React.ReactNode; href?: string }[];
  weakest: React.ReactNode;
  footer: React.ReactNode;
  emptyText: string;
}) {
  const tab = tabFromPracticeArea(area) ?? "math";
  const any = levels.some((level) => level.total > 0);
  return (
    <Card padding="md" className="flex flex-col gap-3 border-t-[6px]" style={{ borderTopColor: `var(--sat-area-${tab})` }}>
      <h2 className="text-lg font-semibold" style={{ color: `var(--sat-area-${tab})` }}>{label}</h2>
      {any ? (
        <div className="grid grid-cols-3 gap-3">
          {levels.map((level) => {
            const body = (
              <>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{level.label}</p>
                <p className="mt-1">
                  <Pct value={level.percent} className="text-3xl font-bold leading-none sm:text-4xl" />
                </p>
                <p className="mt-1 text-xs text-gray-500">{level.total ? `${level.correct} of ${level.total} correct` : "No attempts"}</p>
                {level.caption ? <p className="mt-0.5 truncate text-[11px] text-gray-400">{level.caption}</p> : null}
              </>
            );
            return level.href ? (
              <Link key={level.key} href={level.href} className="block min-w-0 rounded-lg bg-[var(--sat-surface-2)] px-3 py-3 hover:bg-[var(--sat-primary-soft)]">
                {body}
              </Link>
            ) : (
              <div key={level.key} className="min-w-0 rounded-lg bg-[var(--sat-surface-2)] px-3 py-3">{body}</div>
            );
          })}
        </div>
      ) : (
        <p className="text-sm text-gray-500">{emptyText}</p>
      )}
      {weakest ? <p className="text-sm text-gray-700">{weakest}</p> : null}
      <p className="border-t border-gray-100 pt-2 text-xs text-gray-500">{footer}</p>
    </Card>
  );
}

/** Props for a student's own practice summary (lib/student-practice summarizeArea). */
export function studentAreaCardProps(s: AreaPracticeSummary, href: string, action: string): AreaSummaryCardProps {
  return {
    area: s.area,
    label: s.label,
    href,
    latest: s.latest
      ? {
          caption: <>Latest practice · {s.latest.item.skill} · {formatDate(s.latest.attempt.submittedAt)}</>,
          pct: s.latest.attempt.pct,
          detail: <>{s.latest.attempt.correct} of {s.latest.attempt.total} correct</>,
        }
      : null,
    chips: [
      { label: "Completed", value: `${s.done} of ${s.total}` },
      { label: "To do", value: s.todo },
      { label: "Overdue", value: s.overdue, tone: s.overdue ? "danger" : "default" },
    ],
    weakest: s.weakest ? <>Weakest skill: <b>{s.weakest.skill}</b> (last attempt {s.weakest.pct}%)</> : null,
    footer: s.lastPracticed ? `Last practiced ${relativeDay(s.lastPracticed)}` : "Not practiced yet",
    action,
    emptyText: `No ${s.label} practice finished yet.`,
  };
}

/**
 * Compact per-area practice row (mockup index `practiceRow`): area tag, average % bar (striped when
 * there is no result yet) and "x% avg · n to do".
 */
export function AreaPracticeRow({ area, avgPct, todo, href }: { area: PracticeAreaCode; avgPct: number | null; todo: number; href: string }) {
  const tab = tabFromPracticeArea(area) ?? "math";
  return (
    <Link href={href} className="block rounded-md px-1 py-1.5 hover:bg-white">
      <div className="mb-1 flex items-center justify-between gap-2 text-xs">
        <AreaTag area={area} />
        <span className="text-gray-500">
          {avgPct !== null ? <><Pct value={avgPct} className="font-semibold" color={`var(--sat-area-${tab})`} /> avg</> : "No results yet"} · {todo ? `${todo} to do` : "all done"}
        </span>
      </div>
      <StripedBar pct={avgPct} color={`var(--sat-area-${tab})`} />
    </Link>
  );
}

/**
 * Compact area box (mockup `.area-box.compact`): area name + latest %, then two summary lines.
 * Practice only. `href` makes the whole box a link (chevron on the second line).
 */
export function CompactAreaBox({
  area,
  label,
  href,
  pct,
  emptyText = "No practice yet",
  line1,
  delta,
  line1Right,
  line2,
}: {
  area: PracticeAreaCode;
  label: string;
  href?: string;
  pct: number | null;
  emptyText?: string;
  line1: React.ReactNode;
  delta?: number | null;
  /** Replaces the ▲/▼ delta on the first line (e.g. "3/5 done"). */
  line1Right?: React.ReactNode;
  line2: React.ReactNode;
}) {
  const tab = tabFromPracticeArea(area) ?? "math";
  const body = (
    <>
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-[17px] font-semibold" style={{ color: `var(--sat-area-${tab})` }}>{label}</h2>
        {pct !== null ? <Pct value={pct} className="text-[30px] font-bold leading-none" color={`var(--sat-area-${tab})`} /> : <span className="text-sm text-gray-500">{emptyText}</span>}
      </div>
      <div className="flex items-center justify-between gap-2 text-xs text-gray-500">
        <span className="min-w-0 truncate">{line1}</span>
        {line1Right !== undefined ? (
          <span className="shrink-0">{line1Right}</span>
        ) : delta !== null && delta !== undefined ? (
          <b className={delta >= 0 ? "text-green-600" : "text-red-600"}>{delta >= 0 ? "▲" : "▼"} {Math.abs(delta)}</b>
        ) : null}
      </div>
      <div className="flex items-center justify-between gap-2 text-xs text-gray-500">
        <span className="min-w-0 truncate">{line2}</span>
        {href ? <span aria-hidden className="text-gray-400">›</span> : null}
      </div>
    </>
  );
  const cls = "flex flex-col gap-1 border-t-[5px] px-4 py-3.5";
  return href ? (
    <Card as={Link} href={href} className={`${cls} hover:border-gray-400`} style={{ borderTopColor: `var(--sat-area-${tab})` }}>
      {body}
    </Card>
  ) : (
    <Card className={cls} style={{ borderTopColor: `var(--sat-area-${tab})` }}>
      {body}
    </Card>
  );
}

/** Grid for area boxes (mockup `.grid.boxes`: auto-fit, min 250px). */
/**
 * The card grid of every role's views: the Math / Reading / Writing cards and the Test cards share it,
 * so a Test card is exactly as wide as an area card (3 per row on desktop, 2 on tablets, 1 on phones).
 */
export function CardGrid({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={`grid gap-3 sm:grid-cols-2 lg:grid-cols-3 ${className ?? ""}`}>{children}</div>;
}

/** Area cards (Math / Reading / Writing): the shared CardGrid. */
export const AreaBoxGrid = CardGrid;
