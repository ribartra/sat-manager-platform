import Link from "next/link";
import { ChevronCell, LinkTr, RowAction, RowLink, SimpleTable, TD } from "@/components/sat/link-table";
import { DateCell, StudentCell } from "@/components/sat/teacher-ui";
import { Pct } from "@/components/sat/work-status";
import { practiceAreaLabel, type PracticeAreaCode } from "@/lib/practice-area";
import { isInactive, type StudentOverview } from "@/lib/teacher-overview";
import { formatDate } from "@/lib/utils";

const PRACTICE_AREAS: { code: PracticeAreaCode; tab: "math" | "reading" | "writing" }[] = [
  { code: "MATH", tab: "math" },
  { code: "READING", tab: "reading" },
  { code: "WRITING", tab: "writing" },
];

/**
 * The students table of Home and Students: latest practice per area and latest Test. A row opens the
 * student's page; an area cell goes straight to that area. `parents` (Students) adds the parent as a tag
 * under the name (not filterable, so not a column).
 */
export function StudentOverviewTable({ rows, now, parents }: { rows: StudentOverview[]; now: Date; parents?: Map<string, string> }) {
  return (
    <SimpleTable head={[
      "Name",
      "Last active",
      ...PRACTICE_AREAS.map((a) => <span key={a.code} style={{ color: `var(--sat-area-${a.tab})` }}>{practiceAreaLabel(a.code)}</span>),
      <span key="tests" className="text-[var(--sat-tests-ink)]">Tests</span>,
      "",
    ]}>
      {rows.map((s) => {
        const parent = parents?.get(s.id);
        const pending = s.tests.pending.length;
        return (
          <LinkTr key={s.id}>
            <td className={TD}>
              <StudentCell name={s.name} email={s.email} avatarUrl={s.avatarUrl}>
                <RowLink href={`/teacher/students/${s.id}`} className="block truncate">{s.name}</RowLink>
              </StudentCell>
              {parents ? (
                <span className="mt-1 inline-block max-w-[16rem] truncate rounded bg-[var(--sat-surface-2)] px-1.5 py-0.5 text-[11px] text-gray-600">
                  {parent ? `Parent: ${parent}` : "No parent linked"}
                </span>
              ) : null}
            </td>
            <td className={TD}><DateCell date={s.lastActiveAt} now={now} inactive={isInactive(s.lastActiveAt, now)} /></td>
            {PRACTICE_AREAS.map((a) => {
              const o = s.areas[a.code];
              return (
                <td key={a.code} className={TD}>
                  <RowAction>
                    <Link href={`/teacher/students/${s.id}?area=${a.tab}`} className="-mx-2 -my-1 block rounded-md px-2 py-1 hover:bg-gray-100">
                      {o.last ? (
                        <>
                          <b className="text-sm font-medium text-gray-800">{formatDate(o.last.at)}</b>
                          <span className="block text-xs text-gray-500">Practice · <Pct value={o.last.pct} /></span>
                        </>
                      ) : (
                        <span className="text-xs text-gray-400">No activity</span>
                      )}
                    </Link>
                  </RowAction>
                </td>
              );
            })}
            <td className={TD}>
              <RowAction>
                <Link href={`/teacher/students/${s.id}?area=tests`} className="-mx-2 -my-1 block rounded-md px-2 py-1 hover:bg-gray-100">
                  {s.tests.latest ? (
                    <>
                      <span className="whitespace-nowrap text-sm"><span className="text-[var(--sat-area-reading)]">R&amp;W</span> <b>{s.tests.latest.rw ?? "—"}</b> · <span className="text-[var(--sat-area-math)]">M</span> <b>{s.tests.latest.math ?? "—"}</b></span>
                      <span className="block text-xs text-gray-500">{s.tests.latest.label}{s.tests.latest.submittedAt ? ` · ${formatDate(s.tests.latest.submittedAt)}` : ""}</span>
                    </>
                  ) : (
                    <span className="text-xs text-gray-400">No test finished</span>
                  )}
                  {s.tests.inProgress ? <span className="block text-xs text-amber-700">{s.tests.inProgress} in progress</span> : null}
                  {pending ? (
                    <span className={`block text-xs ${s.tests.pending.some((p) => p.overdue) ? "text-red-600" : "text-gray-500"}`}>{pending} pending</span>
                  ) : null}
                </Link>
              </RowAction>
            </td>
            <ChevronCell />
          </LinkTr>
        );
      })}
    </SimpleTable>
  );
}
