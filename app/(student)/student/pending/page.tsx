import { redirect } from "next/navigation";
import { EmptyState, LinkTr, ListFilters, PAGE_SIZE, PageHeader, PageShell, Pagination, RowLink, SimpleTable, TD, ChevronCell, pageFromParam, paginate } from "@/components/sat";
import { Breadcrumbs } from "@/components/sat/breadcrumbs";
import { AreaTag } from "@/components/sat/practice-set-row";
import { Badge } from "@/components/ui/badge";
import { auth } from "@/lib/auth";
import { difficultyBadgeVariant, difficultyLabel } from "@/lib/domain-meta";
import { PRACTICE_AREA_TABS, practiceAreaLabel, type PracticeAreaCode } from "@/lib/practice-area";
import { parseHistoryParams, type HistoryArea } from "@/lib/history-params";
import { loadPending, PENDING_STATUS_OPTIONS, type PendingStatus } from "@/lib/pending";
import { periodDates, periodParams, resolvePeriod } from "@/lib/period-filter";
import { formatDate, relativeDay } from "@/lib/utils";

export const dynamic = "force-dynamic";

const AREA_CODE: Record<HistoryArea, PracticeAreaCode> = { math: "MATH", reading: "READING", writing: "WRITING" };

/**
 * The student's pending work (everything assigned and not finished), overdue first then by due date:
 * the full list behind "See all N pending →" of the Practice and Home panels. Filters in the URL
 * (type / area, status, period on the assigned date), 25 per page; a fixed filter hides its column.
 */
export default async function StudentPendingPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const query = await searchParams;
  const filter = parseHistoryParams(query);
  const status = PENDING_STATUS_OPTIONS.some((o) => o.value === query.status) ? (query.status as PendingStatus) : undefined;
  const period = resolvePeriod(query);
  const rows = await loadPending([session.user.id], {
    kind: filter.type === "tests" ? "test" : filter.type === "practice" ? "practice" : undefined,
    area: filter.area ? AREA_CODE[filter.area] : undefined,
    status,
    ...periodDates(period),
  });
  const page = paginate(rows, pageFromParam(query.page), PAGE_SIZE);
  const params = { type: filter.type, area: filter.area, status, ...periodParams(period) };
  const show = { type: !filter.type || (filter.type === "practice" && !filter.area), typeBadge: !filter.type, area: !filter.area, status: !status };
  const head = ["Due", ...(show.type ? [show.typeBadge ? "Type" : "Area"] : []), "Test / practice set", ...(show.status ? ["Status"] : []), "Assigned", ""];
  const context = [
    filter.type === "tests" ? "Tests" : filter.type === "practice" ? "Practice" : null,
    filter.area ? practiceAreaLabel(AREA_CODE[filter.area]) : null,
    status ? PENDING_STATUS_OPTIONS.find((o) => o.value === status)?.label : null,
  ].filter(Boolean);

  return (
    <PageShell>
      <Breadcrumbs items={[{ label: "Home", href: "/student" }, filter.type === "tests" ? { label: "Tests", href: "/student/tests" } : { label: "Practice", href: "/student/practice" }, { label: "Pending" }]} />
      <PageHeader
        title="Pending"
        description={
          <>
            {context.length ? <b className="font-medium text-gray-700">{context.join(" · ")} · </b> : null}
            Everything your teacher assigned that you haven&apos;t finished: overdue first, then by due date.
          </>
        }
      />
      <ListFilters
        action="/student/pending"
        search={false}
        filters={[
          {
            name: "what",
            label: "Type",
            value: filter.type === "tests" ? "tests" : filter.area ?? (filter.type === "practice" ? "practice" : ""),
            allLabel: "Tests and practice",
            options: [{ value: "tests", label: "Tests" }, { value: "practice", label: "Practice" }, ...PRACTICE_AREA_TABS.map((t) => ({ value: t.key, label: `Practice · ${t.label}` }))],
          },
          { name: "status", label: "Status", value: status ?? "", allLabel: "Any", options: PENDING_STATUS_OPTIONS },
        ]}
        period={period}
      />
      <p className="mb-2 text-xs text-gray-500">{rows.length} pending</p>
      {rows.length === 0 ? (
        <EmptyState title="Nothing pending with these filters." />
      ) : (
        <>
          <SimpleTable head={head}>
            {page.items.map((r) => (
              <LinkTr key={`${r.kind}-${r.id}`}>
                <td className={`${TD} whitespace-nowrap`}>
                  {r.dueDate ? (
                    <>
                      <span className={r.status === "OVERDUE" ? "font-medium text-[var(--sat-bad)]" : "text-gray-700"}>{formatDate(r.dueDate)}</span>
                      <span className="block text-xs text-gray-400">{relativeDay(r.dueDate)}</span>
                    </>
                  ) : (
                    <span className="text-xs text-gray-400">No due date</span>
                  )}
                </td>
                {show.type ? (
                  <td className={TD}>
                    <span className="flex flex-wrap items-center gap-1.5">
                      {show.typeBadge ? r.kind === "test" ? <Badge variant="test">Test</Badge> : <Badge>Practice</Badge> : null}
                      {r.area && show.area ? <AreaTag area={r.area} /> : null}
                    </span>
                  </td>
                ) : null}
                <td className={TD}>
                  <span className="flex flex-wrap items-center gap-2">
                    {/* Opens the set / Test to start or continue it. */}
                    <RowLink href={r.kind === "test" ? `/student/tests/${r.id}` : `/student/practice/assignment/${r.id}`}>{r.title}</RowLink>
                    {r.difficulty ? <Badge variant={difficultyBadgeVariant(r.difficulty)}>{difficultyLabel(r.difficulty)}</Badge> : null}
                    {r.locked ? <Badge variant="danger">Locked</Badge> : null}
                  </span>
                </td>
                {show.status ? (
                  <td className={TD}>
                    <Badge variant={r.status === "OVERDUE" ? "danger" : r.status === "IN_PROGRESS" ? "warning" : "info"}>
                      {r.status === "OVERDUE" ? "Overdue" : r.status === "IN_PROGRESS" ? "In progress" : "Not started"}
                    </Badge>
                  </td>
                ) : null}
                <td className={`${TD} whitespace-nowrap text-gray-600`}>{formatDate(r.assignedAt)}</td>
                <ChevronCell />
              </LinkTr>
            ))}
          </SimpleTable>
          <Pagination basePath="/student/pending" params={params} pageSize={PAGE_SIZE} {...page} />
        </>
      )}
    </PageShell>
  );
}
