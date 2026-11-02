import { TestNumberAccordion } from "@/components/sat/test-number-accordion";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { SectionHead } from "@/components/sat/test-ui";
import { ChevronCell, LinkTr, RowLink, SimpleTable, TD } from "@/components/sat/link-table";
import { TestSectionScore, TestTotalCell } from "@/components/sat/test-cards";
import { Pct } from "@/components/sat/work-status";
import { Delta } from "@/components/sat/stat-tile";
import { AttemptStatusBadge, VoidableValue, invalidatedRowClass, isInvalidated } from "@/components/sat/attempt-status";
import type { TestAttemptRow } from "@/lib/test-assignments";
import { formatDate, formatDuration, relativeDay } from "@/lib/utils";

/**
 * "All attempts" tables (mockup result.html / test-result.html / practice.html): one row per try,
 * the whole row opens it, the try being viewed is marked (and not linked to itself), the best practice try gets a badge.
 */

/**
 * Row of an attempts table: linked, except the try being viewed (plain highlighted row, no chevron)
 * and views without attempt pages (parents: `linked` false, plain row).
 */
function AttemptTr({ viewing, linked = true, className, children }: { viewing: boolean; linked?: boolean; className?: string; children: React.ReactNode }) {
  if (!viewing && linked) return <LinkTr className={className}>{children}</LinkTr>;
  return (
    <tr className={viewing ? "bg-blue-50/60" : className} aria-current={viewing ? "page" : undefined}>
      {children}
      <td className="w-8" />
    </tr>
  );
}

/** The row's main link, or plain bold text on the row being viewed / without a link. */
function AttemptLink({ viewing, href, children }: { viewing: boolean; href?: string; children: React.ReactNode }) {
  return viewing || !href ? <span className="font-semibold text-[var(--sat-text)]">{children}</span> : <RowLink href={href}>{children}</RowLink>;
}

export interface PracticeAttemptRow {
  id: string;
  tryNumber: number;
  submittedAt: Date | null;
  correct: number;
  total: number;
  pct: number | null;
  time: number | null;
  status?: string;
  /** Tries of this row's own set (lists that mix sets); defaults to the number of rows. */
  tryCount?: number;
  /** Set name + badges, for lists that mix sets. */
  title?: React.ReactNode;
  /** % points vs. the previous counted try of the same set; shown as a "Change" column when present. */
  change?: number | null;
}

export function PracticeAttemptsTable({
  rows,
  hrefFor,
  viewingId,
  showBest = true,
}: {
  rows: PracticeAttemptRow[];
  /** Omit for views without attempt pages (parents): rows are not links. */
  hrefFor?: (id: string) => string;
  viewingId?: string;
  showBest?: boolean;
}) {
  const counted = rows.filter((r) => !isInvalidated(r.status) && r.pct !== null);
  const mixed = rows.some((r) => r.title);
  const withChange = rows.some((r) => r.change !== undefined);
  const bestId = showBest && !mixed && counted.length > 1 ? counted.reduce((b, r) => ((r.pct ?? -1) > (b.pct ?? -1) ? r : b)).id : null;
  return (
    <SimpleTable head={[...(mixed ? ["Practice set"] : []), "Attempt", "Completed", "Score", ...(withChange ? ["Change"] : []), "Correct", "Time", ""]}>
      {rows.map((r) => (
        <AttemptTr key={r.id} viewing={r.id === viewingId} linked={Boolean(hrefFor)} className={invalidatedRowClass(r.status)}>
          {mixed ? <td className={TD}><AttemptLink viewing={r.id === viewingId} href={hrefFor?.(r.id)}>{r.title}</AttemptLink></td> : null}
          <td className={TD}>
            {mixed ? <>Try {r.tryNumber}{r.tryCount ? ` of ${r.tryCount}` : ""}</> : <AttemptLink viewing={r.id === viewingId} href={hrefFor?.(r.id)}>Try {r.tryNumber} of {r.tryCount ?? rows.length}</AttemptLink>}
            {r.id === viewingId ? <Badge variant="info" className="ml-2">Viewing</Badge> : null}
            {r.id === bestId ? <Badge variant="success" className="ml-2">Best</Badge> : null}
            {r.status && r.status !== "SUBMITTED" ? <span className="ml-2"><AttemptStatusBadge status={r.status} /></span> : null}
          </td>
          <td className={`${TD} text-gray-600`}>
            {r.submittedAt ? <>{formatDate(r.submittedAt)}<span className="block text-xs text-gray-400">{relativeDay(r.submittedAt)}</span></> : "—"}
          </td>
          <td className={TD}><VoidableValue status={r.status}><Pct value={r.pct} className="font-semibold" /></VoidableValue></td>
          {withChange ? <td className={TD}>{r.change !== null && r.change !== undefined ? <Delta value={r.change} unit="%" /> : <span className="text-gray-300">—</span>}</td> : null}
          {/* No score (Classroom work): no correct count either. */}
          <td className={TD}>{r.pct === null ? <span className="text-gray-400">—</span> : <>{r.correct} of {r.total}</>}</td>
          <td className={`${TD} text-gray-600`}>{r.time ? formatDuration(r.time) : "—"}</td>
          {r.id === viewingId || !hrefFor ? null : <ChevronCell />}
        </AttemptTr>
      ))}
    </SimpleTable>
  );
}

export function TestAttemptsTable({
  rows,
  hrefFor,
  viewingId,
}: {
  rows: Pick<TestAttemptRow, "id" | "status" | "startedAt" | "submittedAt" | "rwScore" | "mathScore" | "totalScore" | "view" | "tryNumber">[];
  /** Omit for views without attempt pages (parents): rows are not links. */
  hrefFor?: (id: string) => string;
  viewingId?: string;
}) {
  return (
    <SimpleTable head={["Attempt", "Date", <SectionHead key="rw" section="RW" />, <SectionHead key="m" section="MATH" />, "Total", ""]}>
      {rows.map((r) => (
        <AttemptTr key={r.id} viewing={r.id === viewingId} linked={Boolean(hrefFor)}>
          <td className={TD}>
            <AttemptLink viewing={r.id === viewingId} href={hrefFor?.(r.id)}>Try {r.tryNumber} of {rows.length}</AttemptLink>
            {r.id === viewingId ? <Badge variant="info" className="ml-2">Viewing</Badge> : null}
            {r.status !== "SUBMITTED" ? <span className="ml-2"><AttemptStatusBadge status={r.status} /></span> : null}
          </td>
          <td className={`${TD} text-gray-600`}>
            {formatDate(r.submittedAt ?? r.startedAt)}
            <span className="block text-xs text-gray-400">{r.submittedAt ? "Completed" : "Started"} {relativeDay(r.submittedAt ?? r.startedAt)}</span>
          </td>
          <td className={TD}><TestSectionScore attempt={r} section="RW" /></td>
          <td className={TD}><TestSectionScore attempt={r} section="MATH" /></td>
          <td className={TD}><TestTotalCell attempt={r} /></td>
          {r.id === viewingId || !hrefFor ? null : <ChevronCell />}
        </AttemptTr>
      ))}
    </SimpleTable>
  );
}

/**
 * Shared shell of the grouped-attempts accordions (practice sets and Tests look the same): a header
 * row, then one native <details> per group (keyboard and screen-reader friendly, no JS) whose summary
 * row shows ONE attempt and whose body lists the group's tries.
 */
function GroupedAttemptsAccordion({
  head,
  cols,
  groups,
}: {
  head: React.ReactNode[];
  /** md+ grid template; one track per `head` entry plus the chevron. */
  cols: string;
  groups: { key: string; summary: React.ReactNode[]; body: React.ReactNode }[];
}) {
  const grid = `md:grid ${cols} md:items-center md:gap-3`;
  return (
    <div className="overflow-hidden rounded-[var(--sat-radius)] border border-[var(--sat-border)] bg-white text-sm">
      <div className={`hidden border-b border-[var(--sat-border)] bg-[var(--sat-surface-2)] px-3 py-2.5 text-xs font-semibold text-[var(--sat-muted)] ${grid}`}>
        {head.map((h, i) => <span key={i}>{h}</span>)}
        <span />
      </div>
      <ul className="divide-y divide-[var(--sat-border)]">
        {groups.map((group) => (
          <li key={group.key}>
            <details className="group">
              <summary className={`flex cursor-pointer list-none flex-wrap items-center gap-x-4 gap-y-1 px-3 py-[11px] hover:bg-[var(--sat-primary-soft)] [&::-webkit-details-marker]:hidden ${grid}`}>
                {group.summary.map((cell, i) => (
                  <span key={i} className={i === 0 ? "w-full min-w-0 font-semibold text-[var(--sat-text)] md:w-auto" : undefined}>{cell}</span>
                ))}
                <ChevronRight aria-hidden size={16} className="ml-auto text-[var(--sat-blank)] transition-transform group-open:rotate-90" />
              </summary>
              <div className="border-t border-[var(--sat-border)] bg-[var(--sat-surface-2)] px-3 py-3">{group.body}</div>
            </details>
          </li>
        ))}
      </ul>
    </div>
  );
}

function TriesCount({ count }: { count: number }) {
  return <span className="ml-2 text-xs font-normal text-[var(--sat-muted)]">{count} {count === 1 ? "try" : "tries"}</span>;
}

export interface PracticeSetAttempts {
  /** Assignment id (one row per practice set). */
  key: string;
  /** Set name + badges. */
  title: React.ReactNode;
  /** Tries of the set (highest try number), invalidated ones included. */
  tryCount: number;
  /** The latest counted try, or the latest try when none counts. Its score, correct, time and date go together. */
  last: PracticeAttemptRow;
  /** Newest first, at most `recentLimit` (the rest is in History). */
  recent: PracticeAttemptRow[];
  /** Skill and source of the set: with them the accordion opens skill → source → sets. */
  /** The practice set and its level (History links of the set). */
  practiceSetId?: string | null;
  difficulty?: string | null;
  skillId?: string | null;
  skillName?: string | null;
  sourceName?: string | null;
  sourceOrder?: number | null;
}

type PracticeSetAccordionProps = {
  sets: PracticeSetAttempts[];
  /** Omit for views without attempt pages (parents): rows are not links. */
  hrefFor?: (id: string) => string;
  /** "See all N tries" link (one URL, or one per set: the teacher's History filtered to that set); omitted where there is no History (parents). */
  historyHref?: string | ((set: PracticeSetAttempts) => string);
  recentLimit?: number;
};

/**
 * Practice attempts: one accordion per skill (A–Z); inside, each source (College Board, Cook…) with its
 * sets, one row per set showing its LAST attempt (not the best), which opens to its most recent tries.
 * Older tries are not deleted, only listed in History. Sets without skill/source info stay a flat list.
 */
export function PracticeSetAttemptsAccordion(props: PracticeSetAccordionProps) {
  const { sets } = props;
  if (sets.length === 0 || sets.some((set) => !set.skillName)) return <PracticeSetRows {...props} />;
  const bySkill = new Map<string, { name: string; sets: PracticeSetAttempts[] }>();
  for (const set of sets) {
    const key = set.skillId ?? set.skillName!;
    const group = bySkill.get(key) ?? bySkill.set(key, { name: set.skillName!, sets: [] }).get(key)!;
    group.sets.push(set);
  }
  const skills = [...bySkill.entries()].sort(([, a], [, b]) => a.name.localeCompare(b.name, "en", { numeric: true, sensitivity: "base" }));
  return (
    <div className="space-y-3">
      {skills.map(([key, skill]) => {
        const sources = new Map<string, { name: string; order: number; sets: PracticeSetAttempts[] }>();
        for (const set of skill.sets) {
          const name = set.sourceName ?? "No source";
          const group = sources.get(name) ?? sources.set(name, { name, order: set.sourceOrder ?? 999, sets: [] }).get(name)!;
          group.sets.push(set);
        }
        const last = skill.sets.map((set) => set.last.submittedAt).filter((d): d is Date => Boolean(d)).sort((a, b) => b.getTime() - a.getTime())[0];
        return (
          <details key={key} className="group overflow-hidden rounded-[var(--sat-radius)] border border-[var(--sat-border)] bg-white">
            <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 hover:bg-[var(--sat-primary-soft)] [&::-webkit-details-marker]:hidden">
              <ChevronRight aria-hidden size={16} className="shrink-0 text-[var(--sat-blank)] transition-transform group-open:rotate-90" />
              <span className="font-semibold text-[var(--sat-text)]">{skill.name}</span>
              <span className="text-xs text-gray-500">
                {skill.sets.length} set{skill.sets.length === 1 ? "" : "s"} · {[...sources.keys()].join(" · ")}
                {last ? ` · last ${formatDate(last)}` : ""}
              </span>
            </summary>
            <div className="space-y-4 border-t border-[var(--sat-border)] bg-[var(--sat-surface-2)] p-3">
              {[...sources.values()]
                .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name))
                .map((source) => (
                  <section key={source.name} className="space-y-1.5">
                    <h3 className="text-[13px] font-semibold text-gray-600">{source.name}</h3>
                    <PracticeSetRows {...props} sets={source.sets} />
                  </section>
                ))}
            </div>
          </details>
        );
      })}
    </div>
  );
}

function PracticeSetRows({ sets, hrefFor, historyHref, recentLimit = 3 }: PracticeSetAccordionProps) {
  return (
    <GroupedAttemptsAccordion
      head={["Practice set", "Last Attempt", "Correct", "Time", "Completed"]}
      cols="md:grid-cols-[minmax(0,1fr)_8rem_6rem_6rem_8rem_1.5rem]"
      groups={sets.map((set) => ({
        key: set.key,
        summary: [
          <>{set.title}<TriesCount count={set.tryCount} /></>,
          <span key="pct" className="whitespace-nowrap">
            <VoidableValue status={set.last.status}><Pct value={set.last.pct} className="font-semibold" /></VoidableValue>
            {set.last.change !== null && set.last.change !== undefined ? <Delta value={set.last.change} unit="%" className="ml-1.5" /> : null}
          </span>,
          set.last.pct === null ? <span key="c" className="text-gray-400">—</span> : <>{set.last.correct} of {set.last.total}</>,
          <span key="t" className="text-gray-600">{set.last.time ? formatDuration(set.last.time) : "—"}</span>,
          <span key="d" className="text-gray-600">{set.last.submittedAt ? formatDate(set.last.submittedAt) : "—"}</span>,
        ],
        body: (
          <>
            <p className="mb-2 text-xs text-[var(--sat-muted)]">
              {set.recent.length === 1 ? "The only try so far" : `Last ${Math.min(recentLimit, set.recent.length)} tries, newest first`}
            </p>
            <PracticeAttemptsTable
              showBest={false}
              hrefFor={hrefFor}
              rows={set.recent.slice(0, recentLimit).map((row) => ({ ...row, tryCount: set.tryCount }))}
            />
            {set.tryCount > Math.min(recentLimit, set.recent.length) ? (
              historyHref ? (
                <Link href={typeof historyHref === "function" ? historyHref(set) : historyHref} className="mt-2 inline-block text-xs font-medium text-blue-600 hover:underline">
                  See all {set.tryCount} tries in History →
                </Link>
              ) : (
                <p className="mt-2 text-xs text-[var(--sat-muted)]">{set.tryCount} tries in total.</p>
              )
            ) : null}
          </>
        ),
      }))}
    />
  );
}

type TestTry = Pick<TestAttemptRow, "id" | "status" | "startedAt" | "submittedAt" | "rwScore" | "mathScore" | "totalScore" | "view" | "tryNumber">;

export interface TestAttempts {
  /** Test assignment id (one row per Test). */
  key: string;
  title: React.ReactNode;
  /** The latest counted try, or the latest try when none counts (e.g. one in progress). */
  last: TestTry;
  /** Every try of this Test, newest first. */
  tries: TestTry[];
  /** "TEST N" and source: with them the rows are grouped in TEST N accordions, one version per source. */
  number?: number | null;
  sourceName?: string;
  sourceOrder?: number;
}

/**
 * Test attempts: one "TEST N" accordion per test number (TestNumberAccordion); inside, each source's
 * version as the usual row (last try's scores, opening to every try). Rows without number/source
 * info keep the flat list.
 */
export function TestAttemptsAccordion({ tests, hrefFor }: { tests: TestAttempts[]; hrefFor?: (id: string) => string }) {
  if (tests.length === 0 || tests.some((test) => test.sourceName === undefined)) return <TestAttemptRows tests={tests} hrefFor={hrefFor} />;
  return (
    <TestNumberAccordion
      items={tests.map((test) => ({
        key: test.key,
        number: test.number ?? null,
        sourceName: test.sourceName ?? "",
        sourceOrder: test.sourceOrder ?? 999,
        open: test.last.status === "IN_PROGRESS",
        node: <TestAttemptRows tests={[test]} hrefFor={hrefFor} />,
      }))}
    />
  );
}

function TestAttemptRows({ tests, hrefFor }: { tests: TestAttempts[]; hrefFor?: (id: string) => string }) {
  return (
    <GroupedAttemptsAccordion
      head={["Test", <SectionHead key="rw" section="RW" short />, <SectionHead key="m" section="MATH" />, "Total", "Date"]}
      cols="md:grid-cols-[minmax(0,1fr)_6rem_6rem_6rem_8rem_1.5rem]"
      groups={tests.map((test) => ({
        key: test.key,
        summary: [
          <>
            {test.title}
            <TriesCount count={test.tries.length} />
            {test.last.status !== "SUBMITTED" ? <span className="ml-2"><AttemptStatusBadge status={test.last.status} /></span> : null}
          </>,
          <TestSectionScore key="rw" attempt={test.last} section="RW" />,
          <TestSectionScore key="m" attempt={test.last} section="MATH" />,
          <TestTotalCell key="t" attempt={test.last} />,
          <span key="d" className="text-gray-600">{formatDate(test.last.submittedAt ?? test.last.startedAt)}</span>,
        ],
        body: (
          <>
            <p className="mb-2 text-xs text-[var(--sat-muted)]">{test.tries.length === 1 ? "The only try so far" : "Every try, newest first"}</p>
            <TestAttemptsTable rows={test.tries} hrefFor={hrefFor} />
          </>
        ),
      }))}
    />
  );
}
