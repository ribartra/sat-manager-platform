import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DueLine, Pct, WorkStatusBadges } from "@/components/sat/work-status";
import { difficultyBadgeVariant, difficultyLabel } from "@/lib/domain-meta";
import { practiceAreaLabel, tabFromPracticeArea } from "@/lib/practice-area";
import type { PracticeSetItem } from "@/lib/student-practice";

/** Area tag: coloured square + area name. */
export function AreaTag({ area }: { area: PracticeSetItem["area"] }) {
  const tab = tabFromPracticeArea(area) ?? "math";
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium" style={{ color: `var(--sat-area-${tab})` }}>
      <span className="inline-block h-2 w-2 rounded-sm" style={{ backgroundColor: `var(--sat-area-${tab})` }} />
      {practiceAreaLabel(area)}
    </span>
  );
}

/** One practice set (mockup setRow): status, dates, tries, and Start / Continue / Try again. */
export function PracticeSetRow({ item, showArea = false }: { item: PracticeSetItem; showArea?: boolean }) {
  const player = `/student/practice/assignment/${item.assignmentId}`;
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 py-3 last:border-b-0">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          {showArea ? <AreaTag area={item.area} /> : null}
          <span className="text-sm font-medium text-gray-900">{item.skill}</span>
          <Badge variant={difficultyBadgeVariant(item.difficulty)}>{difficultyLabel(item.difficulty)}</Badge>
          <WorkStatusBadges state={item.state} overdue={item.overdue} />
        </div>
        <DueLine
          assignedAt={item.assignedAt}
          dueDate={item.dueDate}
          completedAt={item.state === "done" ? item.last?.submittedAt ?? null : null}
          className="mt-0.5"
        />
        {item.tries.length > 0 ? (
          <p className="text-xs text-gray-500">
            {item.tries.length} attempt{item.tries.length === 1 ? "" : "s"} · last <Pct value={item.last?.pct} className="font-semibold" /> · best{" "}
            <b className="text-gray-700">{item.best ?? "—"}%</b>
          </p>
        ) : item.openAnswered !== null ? (
          <p className="text-xs text-gray-500">{item.openAnswered} of {item.questionCount} answered so far</p>
        ) : null}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {item.last ? (
          <Button asChild variant="ghost" size="sm">
            <Link href={`/student/results/${item.last.id}`}>View results</Link>
          </Button>
        ) : null}
        {item.locked ? (
          <Button size="sm" variant="secondary" disabledReason="Your teacher hasn't opened this set yet.">Locked</Button>
        ) : item.state === "progress" ? (
          <Button asChild size="sm"><Link href={player}>Continue ›</Link></Button>
        ) : item.state === "done" ? (
          <Button asChild size="sm" variant="secondary"><Link href={`${player}?start=1`}>↻ Try again</Link></Button>
        ) : (
          <Button asChild size="sm"><Link href={player}>Start ›</Link></Button>
        )}
      </div>
    </div>
  );
}

/** Horizontal % bars (weakest first). */
export function PctBars({ rows }: { rows: { label: string; pct: number | null; sub?: string; href?: string; color?: string }[] }) {
  return (
    <div className="space-y-2.5">
      {rows.map((r) => {
        const body = (
          <>
            <div className="mb-1 flex items-center justify-between gap-3 text-sm">
              <span className="font-medium text-gray-800">{r.label}{r.sub ? <span className="ml-1 text-xs font-normal text-gray-400">· {r.sub}</span> : null}</span>
              <span className="shrink-0">{r.pct === null ? <span className="text-xs text-gray-400">No data yet</span> : <Pct value={r.pct} className="font-semibold" />}</span>
            </div>
            <div className="h-2 rounded-full bg-gray-100">
              <div className="h-2 rounded-full" style={{ width: `${r.pct ?? 0}%`, backgroundColor: r.color ?? "var(--sat-area-math)" }} />
            </div>
          </>
        );
        return r.href ? (
          <Link key={r.label} href={r.href} className="block rounded-md px-1 py-0.5 hover:bg-gray-50">{body}</Link>
        ) : (
          <div key={r.label} className="px-1 py-0.5">{body}</div>
        );
      })}
    </div>
  );
}
