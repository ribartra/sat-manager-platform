import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DueLine, Pct, WorkStatusBadges } from "@/components/sat/work-status";
import { difficultyBadgeVariant, difficultyLabel } from "@/lib/domain-meta";
import { practiceAreaLabel, tabFromPracticeArea } from "@/lib/practice-area";
import type { PracticeSetItem } from "@/lib/student-practice";
import { ListItem } from "@/components/sat/list";
import { formatDate, isAhead } from "@/lib/utils";

/** Area tag: coloured square + area name. */
export function AreaTag({ area }: { area: PracticeSetItem["area"] }) {
  const tab = tabFromPracticeArea(area) ?? "math";
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-semibold" style={{ color: `var(--sat-area-${tab})` }}>
      <span className="inline-block h-2 w-2 rounded-sm" style={{ backgroundColor: `var(--sat-area-${tab})` }} />
      {practiceAreaLabel(area)}
    </span>
  );
}

/** One practice set (mockup setRow): status, dates, tries, and Start / Continue / Try again. */
export function PracticeSetRow({
  item,
  showArea = false,
  resultHref = (id) => `/student/results/${id}`,
  readOnly = false,
}: {
  item: PracticeSetItem;
  showArea?: boolean;
  /** Where "View results" goes (the teacher's "Student view" opens the teacher attempt page). */
  resultHref?: (attemptId: string) => string;
  /** Teacher "Student view": no Start / Continue / Try again. */
  readOnly?: boolean;
}) {
  const player = `/student/practice/assignment/${item.assignmentId}`;
  return (
    <ListItem>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          {showArea ? <AreaTag area={item.area} /> : null}
          <span className="font-semibold text-[var(--sat-text)]">{item.skill}</span>
          <Badge variant={difficultyBadgeVariant(item.difficulty)}>{difficultyLabel(item.difficulty)}</Badge>
          <WorkStatusBadges state={item.state} overdue={item.overdue} />
        </div>
        <DueLine
          assignedAt={item.assignedAt}
          opensAt={item.opensAt}
          dueDate={item.dueDate}
          completedAt={item.state === "done" ? item.last?.submittedAt ?? null : null}
          className="mt-0.5"
        />
        {item.tries.length > 0 ? (
          <p className="text-xs text-[var(--sat-muted)]">
            {item.tries.length} attempt{item.tries.length === 1 ? "" : "s"} · last attempt <Pct value={item.last?.pct} className="font-semibold" />
          </p>
        ) : item.openAnswered !== null ? (
          <p className="text-xs text-[var(--sat-muted)]">{item.openAnswered} of {item.questionCount} answered so far</p>
        ) : null}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {item.last ? (
          <Button asChild variant="ghost" size="sm">
            <Link href={resultHref(item.last.id)}>View results</Link>
          </Button>
        ) : null}
        {readOnly ? null : item.locked ? (
          <Button size="sm" variant="secondary" disabledReason={notOpenReason(item.opensAt)}>{notOpenLabel(item.opensAt)}</Button>
        ) : item.state === "progress" ? (
          <Button asChild size="sm"><Link href={player}>Continue ›</Link></Button>
        ) : item.state === "done" ? (
          <Button asChild size="sm" variant="secondary"><Link href={`${player}?start=1`}>↻ Try again</Link></Button>
        ) : (
          <Button asChild size="sm"><Link href={player}>Start ›</Link></Button>
        )}
      </div>
    </ListItem>
  );
}

/** Horizontal % bars (mockup `hbars`); rows without data show a striped bar. */
export function PctBars({ rows }: { rows: { label: string; pct: number | null; sub?: string; href?: string; color?: string }[] }) {
  return (
    <div className="space-y-2.5">
      {rows.map((r) => {
        const body = (
          <>
            <div className="mb-1 flex items-center justify-between gap-3 text-sm">
              <span className="font-semibold" style={r.color ? { color: r.color } : undefined}>{r.label}{r.sub ? <span className="ml-1 text-xs font-normal text-[var(--sat-muted)]">· {r.sub}</span> : null}</span>
              <span className="shrink-0">{r.pct === null ? <span className="text-xs text-gray-400">No data yet</span> : <Pct value={r.pct} className="font-semibold" />}</span>
            </div>
            <StripedBar pct={r.pct} color={r.color ?? "var(--sat-area-math)"} />
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

/** Progress bar; striped grey when there is no value (mockup `.bar.striped`). */
export function StripedBar({ pct, color }: { pct: number | null; color: string }) {
  if (pct === null) {
    return <div className="h-3 rounded-md bg-[repeating-linear-gradient(45deg,#f1f5f9_0_6px,#e2e8f0_6px_12px)]" aria-hidden />;
  }
  return (
    <div className="h-3 overflow-hidden rounded-md bg-[var(--sat-surface-2)]" aria-hidden>
      <div className="h-full rounded-md" style={{ width: `${pct}%`, backgroundColor: color }} />
    </div>
  );
}

/** Button of a set that can't be started yet: its open date, or waiting for the teacher. */
export function notOpenLabel(opensAt: Date) {
  return isAhead(opensAt) ? `Opens ${formatDate(opensAt)}` : "Not open yet";
}

export function notOpenReason(opensAt: Date) {
  return isAhead(opensAt) ? `You can start it on ${formatDate(opensAt)}.` : "Your teacher will open it.";
}
