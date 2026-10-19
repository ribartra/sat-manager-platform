import Link from "next/link";
import { Plus } from "lucide-react";
import { EmptyState, PageShell } from "@/components/sat";
import { Breadcrumbs } from "@/components/sat/breadcrumbs";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { fullTestStatusBadgeVariant, fullTestStatusLabel } from "@/lib/domain-meta";
import { completedModulesOf } from "@/lib/full-test-progress";
import { studentAccessWhereFor } from "@/lib/program-scope";
import { moduleViewsForTest } from "@/lib/test-view";
import { cn, formatDate } from "@/lib/utils";
import { FullTestActions } from "./full-test-actions-client";

interface PageProps {
  searchParams: Promise<{ view?: string }>;
}

/**
 * Teacher Tests: the list of Tests, each with its 4 modules (R&W 1, R&W 2, Math 1, Math 2), and a
 * "Results by student" matrix (one cell per student and Test). Practice never appears here.
 */
export default async function TeacherTestsPage({ searchParams }: PageProps) {
  const session = await auth();
  const now = new Date();
  const query = await searchParams;
  const view = query.view === "results" ? "results" : "tests";

  const tests = (await prisma.fullPracticeTest.findMany({
    include: {
      modules: { include: { questions: { select: { questionId: true, isPretest: true } } }, orderBy: { order: "asc" } },
      _count: { select: { assignments: true, attempts: true } },
    },
    orderBy: { name: "asc" },
  })).sort((a, b) => a.name.localeCompare(b.name, "en", { numeric: true }));

  const tabs = (
    <nav aria-label="Tests view" className="mb-4 flex gap-1 border-b border-gray-200">
      {(["tests", "results"] as const).map((v) => (
        <Link
          key={v}
          href={v === "tests" ? "/teacher/tests" : "/teacher/tests?view=results"}
          aria-current={view === v ? "page" : undefined}
          className={cn(
            "border-b-2 px-3 py-2 text-sm font-medium",
            view === v ? "border-[var(--sat-area-tests)] text-[var(--sat-area-tests)]" : "border-transparent text-gray-500 hover:text-gray-800",
          )}
        >
          {v === "tests" ? `Tests (${tests.length})` : "Results by student"}
        </Link>
      ))}
    </nav>
  );

  const header = (
    <>
      <Breadcrumbs items={[{ label: "Home", href: "/teacher" }, { label: "Tests" }]} />
      <header className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Tests</h1>
          <p className="mt-1 text-sm text-gray-500">
            Full-length SAT tests. Each has 4 modules: 2 Reading &amp; Writing and 2 Math. Section scores (200–800) and the
            total (400–1600) appear only here, never in practice.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/teacher/tests/scoring" className="rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">How scores work</Link>
          <Link href="/teacher/tests/new" className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700">
            <Plus size={14} /> New test
          </Link>
        </div>
      </header>
      {tabs}
    </>
  );

  if (view === "results") {
    const published = tests.filter((t) => t.status === "PUBLISHED");
    const students = await prisma.user.findMany({
      where: session ? studentAccessWhereFor(session.user, now) : { role: "STUDENT", active: true, validationStatus: "APPROVED" },
      select: {
        id: true,
        name: true,
        fullTestAssignments: {
          select: {
            id: true,
            testId: true,
            status: true,
            dueDate: true,
            attempts: {
              select: { id: true, status: true, submittedAt: true, startedAt: true, rwScore: true, mathScore: true, moduleTimerState: true },
              orderBy: { startedAt: "desc" },
            },
          },
        },
      },
      orderBy: { name: "asc" },
    });
    return (
      <PageShell width="wide">
        {header}
        <p className="mb-3 text-sm text-gray-500">Each cell is one student in one Test: section scores, progress or status. Click it to review or assign.</p>
        {students.length === 0 || published.length === 0 ? (
          <EmptyState title="No students or published tests yet." />
        ) : (
          <Card className="overflow-x-auto">
            <table className="w-full min-w-[40rem] text-sm">
              <thead className="bg-gray-50 text-left text-xs text-gray-500">
                <tr>
                  <th className="sticky left-0 bg-gray-50 px-3 py-2">Student</th>
                  {published.map((t) => (
                    <th key={t.id} className="px-3 py-2">
                      <Link href={`/teacher/tests/${t.id}`} className="hover:underline">{t.name}</Link>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {students.map((s) => (
                  <tr key={s.id}>
                    <td className="sticky left-0 bg-white px-3 py-2">
                      <span className="flex items-center justify-between gap-3">
                        <Link href={`/teacher/students/${s.id}?area=tests`} className="font-medium text-gray-900 hover:underline">{s.name}</Link>
                        <Link href={`/teacher/students/${s.id}?area=tests`} className="text-xs text-blue-600 hover:underline">Open</Link>
                      </span>
                    </td>
                    {published.map((t) => {
                      const assignment = s.fullTestAssignments.find((a) => a.testId === t.id);
                      return (
                        <td key={t.id} className="px-2 py-1.5 align-top">
                          <MatrixCell studentId={s.id} testId={t.id} moduleCount={t.modules.length} assignment={assignment ?? null} now={now} />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
        <p className="mt-2 flex flex-wrap gap-3 text-xs text-gray-500">
          <span><span className="mr-1 inline-block h-3 w-3 rounded bg-blue-50 align-middle ring-1 ring-blue-200" />Completed (section scores)</span>
          <span><span className="mr-1 inline-block h-3 w-3 rounded bg-amber-50 align-middle ring-1 ring-amber-200" />In progress</span>
          <span><span className="mr-1 inline-block h-3 w-3 rounded bg-red-50 align-middle ring-1 ring-red-200" />Overdue</span>
          <span>+ Assign: not assigned yet</span>
        </p>
      </PageShell>
    );
  }

  return (
    <PageShell width="wide">
      {header}
      {tests.length === 0 ? (
        <EmptyState title="No tests yet." description="Create one with New test." />
      ) : (
        <div className="space-y-3">
          {tests.map((test) => {
            const modules = moduleViewsForTest(test.modules.map((m) => ({ ...m, questions: m.questions })));
            const questionCount = modules.reduce((sum, m) => sum + m.questionCount, 0);
            return (
              <Card key={test.id} padding="md">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link href={`/teacher/tests/${test.id}`} className="text-base font-semibold text-gray-900 hover:underline">{test.name}</Link>
                      <Badge variant={fullTestStatusBadgeVariant(test.status)}>{fullTestStatusLabel(test.status)}</Badge>
                    </div>
                    <p className="mt-0.5 text-xs text-gray-500">
                      {questionCount} questions · {test._count.assignments} assigned · {test._count.attempts} attempt{test._count.attempts === 1 ? "" : "s"}
                    </p>
                  </div>
                  <FullTestActions
                    testId={test.id}
                    status={test.status}
                    hasAssignments={test._count.assignments > 0}
                    hasAttempts={test._count.attempts > 0}
                    variant="list"
                  />
                </div>
                <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                  {modules.map((m) => (
                    <div key={m.key} className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2">
                      <p className={cn("text-sm font-semibold", m.section === "MATH" ? "text-[var(--sat-area-math)]" : "text-[var(--sat-area-reading)]")}>
                        {m.short} <span className="font-normal text-gray-500">· {m.tier}</span>
                      </p>
                      <p className="text-xs text-gray-500">{m.questionCount} questions · {m.minutes} min</p>
                    </div>
                  ))}
                  {modules.length === 0 ? <p className="text-xs text-gray-400">No modules yet.</p> : null}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </PageShell>
  );
}

function MatrixCell({
  studentId,
  testId,
  moduleCount,
  assignment,
  now,
}: {
  studentId: string;
  testId: string;
  moduleCount: number;
  assignment: {
    id: string;
    status: string;
    dueDate: Date | null;
    attempts: { id: string; status: string; submittedAt: Date | null; startedAt: Date; rwScore: number | null; mathScore: number | null; moduleTimerState: string | null }[];
  } | null;
  now: Date;
}) {
  const base = "block rounded-md px-2 py-1.5 text-xs";
  if (!assignment) {
    return (
      <Link href={`/teacher/students/${studentId}/assign-test?test=${testId}`} className={cn(base, "text-blue-600 hover:bg-blue-50")}>
        + Assign
      </Link>
    );
  }
  const open = assignment.attempts.find((a) => a.status === "IN_PROGRESS");
  const submitted = assignment.attempts.filter((a) => a.status === "SUBMITTED");
  const last = submitted.sort((a, b) => (b.submittedAt?.getTime() ?? 0) - (a.submittedAt?.getTime() ?? 0))[0];
  if (open) {
    const done = completedModulesOf(open.moduleTimerState, moduleCount).length;
    return (
      <Link href={`/teacher/students/${studentId}/tests/${open.id}`} className={cn(base, "bg-amber-50 text-amber-800 hover:bg-amber-100")}>
        <b>In progress</b>
        <span className="block">{done} of {moduleCount} modules</span>
      </Link>
    );
  }
  if (last) {
    return (
      <Link href={`/teacher/students/${studentId}/tests/${last.id}`} className={cn(base, "bg-blue-50 text-gray-800 hover:bg-blue-100")}>
        <span className="block">R&amp;W <b>{last.rwScore ?? "—"}</b></span>
        <span className="block">Math <b>{last.mathScore ?? "—"}</b></span>
        <span className="block text-gray-500">{last.submittedAt ? formatDate(last.submittedAt) : ""} · {submitted.length} {submitted.length === 1 ? "try" : "tries"}</span>
      </Link>
    );
  }
  // No open or counted try: pending. Tries the teacher set aside ("Not counted") are noted.
  const overdue = assignment.status === "OVERDUE" || (assignment.status !== "COMPLETED" && Boolean(assignment.dueDate && assignment.dueDate < now));
  const notCounted = assignment.attempts.filter((a) => a.status === "INVALIDATED").length;
  return (
    <span className={cn(base, overdue ? "bg-red-50 text-red-700" : "bg-gray-50 text-gray-600")}>
      <b>{overdue ? "Overdue" : "Not started"}</b>
      {assignment.dueDate ? <span className="block">due {formatDate(assignment.dueDate)}</span> : null}
      {notCounted ? <span className="block text-gray-500">{notCounted} not counted</span> : null}
    </span>
  );
}
