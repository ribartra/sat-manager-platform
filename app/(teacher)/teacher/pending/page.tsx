import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import {
  Breadcrumbs,
  EmptyState,
  LinkTr,
  ListFilters,
  PAGE_SIZE,
  PageHeader,
  PageShell,
  Pagination,
  RowLink,
  SimpleTable,
  StudentCell,
  TD,
  ChevronCell,
  pageFromParam,
  paginate,
} from "@/components/sat";
import { AreaTag } from "@/components/sat/practice-set-row";
import { HEADER_ACTION_CLASS, HeaderActions } from "@/components/sat/header-actions";
import { Badge } from "@/components/ui/badge";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { studentAccessWhereFor } from "@/lib/program-scope";
import { difficultyBadgeVariant, difficultyLabel } from "@/lib/domain-meta";
import { PRACTICE_AREA_TABS, practiceAreaLabel, type PracticeAreaCode } from "@/lib/practice-area";
import { parseHistoryParams, type HistoryArea } from "@/lib/history-params";
import { loadPending, PENDING_STATUS_OPTIONS, type PendingRow, type PendingStatus } from "@/lib/pending";
import { periodDates, periodParams, resolvePeriod } from "@/lib/period-filter";
import { assignHref } from "@/lib/assign-params";
import { formatDate, relativeDay } from "@/lib/utils";

export const dynamic = "force-dynamic";

const AREA_CODE: Record<HistoryArea, PracticeAreaCode> = { math: "MATH", reading: "READING", writing: "WRITING" };

/**
 * Pending: every practice set and Test assigned to the teacher's students and not finished (not
 * started, in progress, overdue), overdue first then by due date — the full list behind the panels'
 * "See all N pending →". Filters in the URL (student, type / area, status, period on the assigned
 * date), 25 per page, a fixed filter hides its column. Students are scoped with studentAccessWhereFor.
 */
export default async function TeacherPendingPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const session = await auth();
  const now = new Date();
  const query = await searchParams;
  const filter = parseHistoryParams(query);
  const status = PENDING_STATUS_OPTIONS.some((o) => o.value === query.status) ? (query.status as PendingStatus) : undefined;
  const students = await prisma.user.findMany({
    where: session ? studentAccessWhereFor(session.user, now) : { role: "STUDENT", active: true, validationStatus: "APPROVED" },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  const studentId = students.some((s) => s.id === query.student) ? query.student! : "";
  const student = students.find((s) => s.id === studentId) ?? null;
  const period = resolvePeriod(query, now);

  const rows = await loadPending(studentId ? [studentId] : students.map((s) => s.id), {
    kind: filter.type === "tests" ? "test" : filter.type === "practice" ? "practice" : undefined,
    area: filter.area ? AREA_CODE[filter.area] : undefined,
    status,
    ...periodDates(period),
  });
  const page = paginate(rows, pageFromParam(query.page), PAGE_SIZE);
  const params = { student: studentId || undefined, type: filter.type, area: filter.area, status, ...periodParams(period) };

  // A fixed filter hides its column (it would repeat on every row).
  const show = { student: !studentId, type: !filter.type || (filter.type === "practice" && !filter.area), typeBadge: !filter.type, area: !filter.area, status: !status };
  const head = ["Due", ...(show.student ? ["Student"] : []), ...(show.type ? [show.typeBadge ? "Type" : "Area"] : []), "Test / practice set", ...(show.status ? ["Status"] : []), "Assigned", ""];
  const backArea = filter.type === "tests" ? "tests" : filter.area ?? (filter.type === "practice" ? "math" : null);
  const backHref = student ? `/teacher/students/${student.id}${backArea ? `?area=${backArea}` : ""}` : null;
  const context = [
    filter.type === "tests" ? "Tests" : filter.type === "practice" ? "Practice" : null,
    filter.area ? practiceAreaLabel(AREA_CODE[filter.area]) : null,
    status ? PENDING_STATUS_OPTIONS.find((o) => o.value === status)?.label : null,
  ].filter(Boolean);

  return (
    <PageShell>
      <Breadcrumbs
        items={
          student
            ? [{ label: "Home", href: "/teacher" }, { label: "Students", href: "/teacher/students" }, { label: student.name, href: backHref! }, { label: "Pending" }]
            : [{ label: "Home", href: "/teacher" }, { label: "Pending" }]
        }
      />
      <PageHeader
        title={student ? `Pending · ${student.name}` : "Pending"}
        description={
          <>
            {context.length ? <b className="font-medium text-gray-700">{context.join(" · ")} · </b> : null}
              Practice sets and Tests assigned and not finished yet: overdue first, then by due date.
          </>
        }
        actions={
          backHref ? (
            <HeaderActions>
              <Link href={backHref} className={HEADER_ACTION_CLASS}>
                <ArrowLeft size={14} aria-hidden /> Back to {student!.name.split(" ")[0]}
              </Link>
            </HeaderActions>
          ) : null
        }
      />

      <ListFilters
        action="/teacher/pending"
        search={false}
        filters={[
          { name: "student", label: "Student", value: studentId, allLabel: "All students", options: students.map((st) => ({ value: st.id, label: st.name })) },
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
              <PendingTableRow key={`${r.kind}-${r.id}`} row={r} show={show} />
            ))}
          </SimpleTable>
          <Pagination basePath="/teacher/pending" params={params} pageSize={PAGE_SIZE} {...page} />
        </>
      )}
    </PageShell>
  );
}

function PendingTableRow({ row: r, show }: { row: PendingRow; show: { student: boolean; type: boolean; typeBadge: boolean; area: boolean; status: boolean } }) {
  // Open the assignment to change its dates (the student keeps the progress).
  const href =
    r.kind === "test"
      ? assignHref({ studentId: r.studentId, test: r.testId ?? undefined })
      : assignHref({ studentId: r.studentId, area: r.area === "READING" ? "reading" : r.area === "WRITING" ? "writing" : "math", edit: r.practiceSetId ? [r.practiceSetId] : [] });
  return (
    <LinkTr>
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
      {show.student ? (
        <td className={TD}>
          <StudentCell name={r.studentName} avatarUrl={null} />
        </td>
      ) : null}
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
          <RowLink href={href}>{r.title}</RowLink>
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
  );
}
