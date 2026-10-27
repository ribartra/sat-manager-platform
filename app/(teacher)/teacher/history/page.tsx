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
  pageFromParam,
  paginate,
} from "@/components/sat";
import { AreaTag } from "@/components/sat/practice-set-row";
import { InvalidateAttemptButton } from "@/components/sat/invalidate-attempt-button";
import { Pct } from "@/components/sat/work-status";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { studentAccessWhereFor } from "@/lib/program-scope";
import { loadAttemptHistory, type HistoryRow } from "@/lib/attempt-history";
import { difficultyBadgeVariant, difficultyLabel } from "@/lib/domain-meta";
import { PRACTICE_AREA_TABS, type PracticeAreaCode } from "@/lib/practice-area";
import { formatDate, formatDuration, relativeDay } from "@/lib/utils";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ student?: string; type?: string; area?: string; status?: string; from?: string; page?: string }>;
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
  const page = paginate(rows, pageFromParam(query.page), PAGE_SIZE);
  const params = { student: studentId, type, area: query.area && area ? query.area : "", status, from };
  const anyFilter = Object.values(params).some(Boolean);

  return (
    <PageShell maxWidth={1180} width="wide">
      <Breadcrumbs items={[{ label: "Home", href: "/teacher" }, { label: "History" }]} />
      <h1 className="text-[26px] font-bold tracking-[-0.3px] text-gray-900">History</h1>
      <p className="mb-4 mt-0.5 text-sm text-gray-500">
        Every practice set and Test your students took, newest first. Practice shows % correct; Tests show SAT section scores.
      </p>

      <Card as="form" padding="sm" className="mb-4 flex flex-wrap items-end gap-3">
        <label className="min-w-[12rem] flex-1 text-xs font-medium text-gray-600">
          Student
          <select name="student" defaultValue={studentId} className="mt-1 w-full rounded-lg border border-[var(--sat-border-strong)] bg-white px-2.5 py-2 text-sm text-[var(--sat-text)]">
            <option value="">All students</option>
            {students.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </label>
        <label className="text-xs font-medium text-gray-600">
          Type
          <select name="type" defaultValue={type} className="mt-1 w-full rounded-lg border border-[var(--sat-border-strong)] bg-white px-2.5 py-2 text-sm text-[var(--sat-text)]">
            <option value="">Tests and practice</option>
            <option value="tests">Tests</option>
            <option value="practice">Practice</option>
          </select>
        </label>
        <label className="text-xs font-medium text-gray-600">
          Practice area
          <select name="area" defaultValue={area ? query.area : ""} className="mt-1 w-full rounded-lg border border-[var(--sat-border-strong)] bg-white px-2.5 py-2 text-sm text-[var(--sat-text)]">
            <option value="">All areas</option>
            {PRACTICE_AREA_TABS.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
          </select>
        </label>
        <label className="text-xs font-medium text-gray-600">
          Status
          <select name="status" defaultValue={status} className="mt-1 w-full rounded-lg border border-[var(--sat-border-strong)] bg-white px-2.5 py-2 text-sm text-[var(--sat-text)]">
            <option value="">Any</option>
            <option value="completed">Completed</option>
            <option value="progress">In progress</option>
          </select>
        </label>
        <label className="text-xs font-medium text-gray-600">
          From
          <input type="date" name="from" defaultValue={from} className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1 text-sm text-gray-900" />
        </label>
        <Button type="submit" size="sm">Apply</Button>
        {anyFilter ? <Link href="/teacher/history" className="pb-1.5 text-xs text-blue-600 hover:underline">Clear</Link> : null}
      </Card>

      <p className="mb-2 text-xs text-gray-500">{rows.length} attempt{rows.length === 1 ? "" : "s"}</p>
      {rows.length === 0 ? (
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
