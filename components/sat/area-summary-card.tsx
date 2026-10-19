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
  href: string;
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
      as={Link}
      href={href}
      padding="md"
      className="flex min-h-[14rem] flex-col gap-2 border-t-[6px] hover:border-gray-400"
      style={{ borderTopColor: `var(--sat-area-${tab})` }}
    >
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold" style={{ color: `var(--sat-area-${tab})` }}>{label}</h2>
        <span aria-hidden className="text-gray-400">›</span>
      </div>
      {latest ? (
        <div>
          <p className="text-xs text-gray-500">{latest.caption}</p>
          <p className="mt-1 flex items-end gap-2">
            <Pct value={latest.pct} className="text-4xl font-bold leading-none" />
            {latest.detail ? <span className="text-xs text-gray-500">{latest.detail}</span> : null}
          </p>
          {delta !== null && delta !== undefined ? <Delta value={delta} suffix="vs. previous practice" className="mt-1 block" /> : null}
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
    delta: s.delta,
    chips: [
      { label: "Completed", value: `${s.done} of ${s.total}` },
      { label: "To do", value: s.todo },
      { label: "Overdue", value: s.overdue, tone: s.overdue ? "danger" : "default" },
    ],
    weakest: s.weakest ? <>Weakest skill: <b>{s.weakest.skill}</b> ({s.weakest.pct}%)</> : null,
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
          {avgPct !== null ? <><Pct value={avgPct} className="font-semibold" /> avg</> : "No results yet"} · {todo ? `${todo} to do` : "all done"}
        </span>
      </div>
      <StripedBar pct={avgPct} color={`var(--sat-area-${tab})`} />
    </Link>
  );
}
