import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Breadcrumbs, EmptyState, ListFilters, PAGE_SIZE, PageHeader, PageShell, Pagination, pageFromParam, paginate } from "@/components/sat";
import { PendingTable, pendingColumns } from "@/components/sat/pending-table";
import { HEADER_ACTION_CLASS, HeaderActions } from "@/components/sat/header-actions";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { studentAccessWhereFor } from "@/lib/program-scope";
import { PRACTICE_AREA_TABS, practiceAreaLabel, type PracticeAreaCode } from "@/lib/practice-area";
import { parseHistoryParams, type HistoryArea } from "@/lib/history-params";
import { loadPending, PENDING_STATUS_OPTIONS, type PendingRow, type PendingStatus } from "@/lib/pending";
import { periodDates, periodParams, resolvePeriod } from "@/lib/period-filter";
import { assignHref } from "@/lib/assign-params";

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
  const show = pendingColumns(filter, status, !studentId);
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
          {/* A row opens the assignment's dates in Assign (the student keeps the progress). */}
          <PendingTable rows={page.items} show={show} hrefFor={pendingAssignHref} />
          <Pagination basePath="/teacher/pending" params={params} pageSize={PAGE_SIZE} {...page} />
        </>
      )}
    </PageShell>
  );
}

/** Open the assignment to change its dates (the student keeps the progress). */
function pendingAssignHref(r: PendingRow) {
  return r.kind === "test"
    ? assignHref({ studentId: r.studentId, test: r.testId ?? undefined })
    : assignHref({ studentId: r.studentId, area: r.area === "READING" ? "reading" : r.area === "WRITING" ? "writing" : "math", edit: r.practiceSetId ? [`${r.practiceSetId}:${r.context ?? "HOMEWORK"}`] : [] });
}
