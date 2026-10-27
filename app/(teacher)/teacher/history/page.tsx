import Link from "next/link";
import {
  AttemptStatusBadge,
  Breadcrumbs,
  ChevronCell,
  Delta,
  EmptyState,
  LinkTr,
  PageShell,
  Pagination,
  RowAction,
  RowLink,
  SimpleTable,
  StudentCell,
  TD,
  VoidableValue,
  invalidatedRowClass,
  ListFilters,
  matchesQuery,
  pageFromParam,
  paginate,
} from "@/components/sat";
import { AreaTag } from "@/components/sat/practice-set-row";
import { InvalidateAttemptButton } from "@/components/sat/invalidate-attempt-button";
import { Pct } from "@/components/sat/work-status";
import { Badge } from "@/components/ui/badge";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { studentAccessWhereFor } from "@/lib/program-scope";
import { loadAttemptHistory, type HistoryRow } from "@/lib/attempt-history";
import { difficultyBadgeVariant, difficultyLabel } from "@/lib/domain-meta";
import { PRACTICE_AREA_TABS, type PracticeAreaCode } from "@/lib/practice-area";
import { formatDate, formatDuration, relativeDay } from "@/lib/utils";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ student?: string; type?: string; area?: string; status?: string; from?: string; page?: string; q?: string }>;
}

const PAGE_SIZE = 25;

/**
 * Attempt history for every student the teacher can see (mockup teacher/history.html): practice
 * and Test tries, newest first, with try numbers and the change vs. the previous try. Practice
 * shows % correct; Tests show SAT section scores. Students are scoped with studentAccessWhereFor.
 */
export default async function TeacherHistoryPage({ searchParams }: PageProps) {
  const session = await auth();
  const now = new Date();
  const query = await searchParams;
  const students = await prisma.user.findMany({
    where: session ? studentAccessWhereFor(session.user, now) : { role: "STUDENT", active: true, validationStatus: "APPROVED" },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  const studentId = students.some((s) => s.id === query.student) ? query.student! : "";
  const area: PracticeAreaCode | null = PRACTICE_AREA_TABS.find((t) => t.key === query.area)?.practiceArea ?? null;
  // Choosing an area means practice (Tests have no area).
  const type = area ? "practice" : query.type === "tests" || query.type === "practice" ? query.type : "";
  const status = query.status === "completed" || query.status === "progress" ? query.status : "";
  const from = query.from && !Number.isNaN(new Date(`${query.from}T00:00:00`).getTime()) ? query.from : "";

  const rows = await loadAttemptHistory(studentId ? [studentId] : students.map((s) => s.id), {
    kind: type === "tests" ? "test" : type === "practice" ? "practice" : undefined,
    area: area ?? undefined,
    status: status || undefined,
    from: from ? new Date(`${from}T00:00:00`) : undefined,
  });
  // Text search: student name or practice set / Test name.
  const q = (query.q ?? "").trim();
  const shownRows = rows.filter((r) => matchesQuery(q, r.studentName, r.title));
  const page = paginate(shownRows, pageFromParam(query.page), PAGE_SIZE);
  const params = { q, student: studentId, type, area: query.area && area ? query.area : "", status, from };

  return (
    <PageShell maxWidth={1180} width="wide">
      <Breadcrumbs items={[{ label: "Home", href: "/teacher" }, { label: "History" }]} />
      <h1 className="text-[26px] font-bold tracking-[-0.3px] text-gray-900">History</h1>
      <p className="mb-4 mt-0.5 text-sm text-gray-500">
        Every practice set and Test your students took, newest first. Practice shows % correct; Tests show SAT section scores.
      </p>

      <ListFilters
        action="/teacher/history"
        q={q}
        placeholder="Student, practice set or Test"
        filters={[
          { name: "student", label: "Student", value: studentId, allLabel: "All students", options: students.map((st) => ({ value: st.id, label: st.name })) },
          { name: "type", label: "Type", value: type, allLabel: "Tests and practice", options: [{ value: "tests", label: "Tests" }, { value: "practice", label: "Practice" }] },
          { name: "area", label: "Practice area", value: area ? query.area : "", allLabel: "All areas", options: PRACTICE_AREA_TABS.map((t) => ({ value: t.key, label: t.label })) },
          { name: "status", label: "Status", value: status, allLabel: "Any", options: [{ value: "completed", label: "Completed" }, { value: "progress", label: "In progress" }] },
        ]}
        dates={[{ name: "from", label: "From", value: from }]}
      />

      <p className="mb-2 text-xs text-gray-500">{shownRows.length} attempt{shownRows.length === 1 ? "" : "s"}</p>
      {shownRows.length === 0 ? (
        <EmptyState title="No attempts match these filters." />
      ) : (
        <>
          <SimpleTable head={["Date", "Student", "Type", "Test / practice set", "Attempt", "Score", "Change", "", ""]}>
            {page.items.map((r) => <HistoryTableRow key={r.id} row={r} />)}
          </SimpleTable>
          <Pagination basePath="/teacher/history" params={params} pageSize={PAGE_SIZE} {...page} />
        </>
      )}
    </PageShell>
  );
}

function HistoryTableRow({ row: r }: { row: HistoryRow }) {
  const isTest = r.kind === "test";
  const href = `/teacher/students/${r.studentId}/${isTest ? "tests" : "attempts"}/${r.id}`;
  return (
    <LinkTr className={invalidatedRowClass(r.status)}>
      <td className={`${TD} whitespace-nowrap text-gray-600`}>
        {formatDate(r.at)}
        <span className="block text-xs text-gray-400">{r.status === "IN_PROGRESS" ? "Started" : "Completed"} {relativeDay(r.at)}</span>
      </td>
      <td className={TD}>
        <RowAction>
          <Link href={`/teacher/students/${r.studentId}?area=history`} className="hover:underline">
            <StudentCell name={r.studentName} avatarUrl={r.avatarUrl} />
          </Link>
        </RowAction>
      </td>
      <td className={TD}>
        <span className="flex flex-wrap items-center gap-1.5">
          {isTest ? <Badge variant="test">Test</Badge> : <Badge>Practice</Badge>}
          {r.area ? <AreaTag area={r.area} /> : null}
        </span>
      </td>
      <td className={TD}>
        <span className="flex flex-wrap items-center gap-2">
          <RowLink href={href}>{r.title}</RowLink>
          {r.difficulty ? <Badge variant={difficultyBadgeVariant(r.difficulty)}>{difficultyLabel(r.difficulty)}</Badge> : null}
          {r.status === "INVALIDATED" ? <AttemptStatusBadge status={r.status} /> : null}
        </span>
      </td>
      <td className={`${TD} whitespace-nowrap`}>
        Try {r.tryNumber} of {r.tryCount}
        {r.status === "IN_PROGRESS" ? (
          <span className="block text-xs text-amber-700">{isTest ? `${r.modulesDone ?? 0} of 4 modules` : "In progress"}</span>
        ) : null}
      </td>
      <td className={TD}>
        {isTest ? (
          r.status === "IN_PROGRESS" ? (
            <span className="text-xs text-gray-400">—</span>
          ) : (
            <VoidableValue status={r.status}>
              <span className="whitespace-nowrap"><span className="text-[var(--sat-area-reading)]">R&amp;W</span> <b className="tabular-nums">{r.rw ?? "—"}</b> · <span className="text-[var(--sat-area-math)]">Math</span> <b className="tabular-nums">{r.math ?? "—"}</b></span>
            </VoidableValue>
          )
        ) : r.pct !== null ? (
          <VoidableValue status={r.status}>
            <Pct value={r.pct} className="font-semibold" /> <span className="text-xs text-gray-500">{r.correct} of {r.total}</span>
            {r.time ? <span className="block text-xs text-gray-400">{formatDuration(r.time)}</span> : null}
          </VoidableValue>
        ) : (
          <span className="text-xs text-gray-400">—</span>
        )}
      </td>
      <td className={TD}>
        {isTest ? (
          <span className="flex flex-col text-xs">
            {r.changeRw !== null ? <span>R&amp;W <Delta value={r.changeRw} unit="" /></span> : null}
            {r.changeMath !== null ? <span>Math <Delta value={r.changeMath} unit="" /></span> : null}
          </span>
        ) : (
          <Delta value={r.change} unit="pts" />
        )}
      </td>
      <td className={`${TD} text-right`}>
        {/* The only action on an attempt, same component as the attempt pages and the student's History. */}
        <RowAction><InvalidateAttemptButton attemptId={r.id} kind={isTest ? "test" : "practice"} status={r.status} /></RowAction>
      </td>
      <ChevronCell />
    </LinkTr>
  );
}
