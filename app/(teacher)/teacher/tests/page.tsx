import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus, User } from "lucide-react";
import { EmptyState, PageShell, Pagination, pageFromParam, paginate } from "@/components/sat";
import { Breadcrumbs } from "@/components/sat/breadcrumbs";
import { TestModuleTiles } from "@/components/sat/test-module-tiles";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { fullTestStatusBadgeVariant, fullTestStatusLabel } from "@/lib/domain-meta";
import { studentAccessWhereFor } from "@/lib/program-scope";
import { moduleViewsForTest } from "@/lib/test-view";
import { formatDate } from "@/lib/utils";
import { FullTestActions } from "./full-test-actions-client";

interface PageProps {
  searchParams: Promise<{ view?: string; page?: string }>;
}

const PAGE_SIZE = 10;

/**
 * Teacher Tests (mockup `mejorada/teacher/tests.html`): one card per Test with its 4 modules and how
 * many of the teacher's students have it assigned, completed, in progress or overdue. Results per
 * student are on each Test's page. Practice never appears here.
 */
export default async function TeacherTestsPage({ searchParams }: PageProps) {
  const session = await auth();
  const now = new Date();
  const query = await searchParams;
  // The students × tests matrix was replaced by the per-test page (mockup); old links land here.
  if (query.view === "results") redirect("/teacher/tests");

  const studentWhere = session ? studentAccessWhereFor(session.user, now) : { role: "STUDENT", active: true, validationStatus: "APPROVED" };
  const tests = (
    await prisma.fullPracticeTest.findMany({
      include: {
        modules: { include: { questions: { select: { questionId: true, isPretest: true } } }, orderBy: { order: "asc" } },
        _count: { select: { assignments: true, attempts: true } },
        // Counts only for students this teacher can see (program scope).
        assignments: {
          where: { student: studentWhere },
          select: { status: true, dueDate: true, createdAt: true, attempts: { where: { status: "IN_PROGRESS" }, select: { id: true } } },
        },
      },
      orderBy: { name: "asc" },
    })
  ).sort((a, b) => a.name.localeCompare(b.name, "en", { numeric: true }));
  const page = paginate(tests, pageFromParam(query.page), PAGE_SIZE);

  return (
    <PageShell maxWidth={1100} width="wide">
      <Breadcrumbs items={[{ label: "Home", href: "/teacher" }, { label: "Tests" }]} />
      <header className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-[26px] font-bold tracking-[-0.3px] text-gray-900">Tests</h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage full-length tests. Each test has 4 modules: 2 of Reading &amp; Writing and 2 of Math. Section scores (200–800) appear only on
            Test pages, never in practice.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="secondary">
            <Link href="/teacher/tests/scoring">How scores work</Link>
          </Button>
          <Button asChild>
            <Link href="/teacher/tests/new"><Plus size={14} /> New test</Link>
          </Button>
        </div>
      </header>

      {tests.length === 0 ? (
        <EmptyState title="No tests yet." description="Create one with New test." />
      ) : (
        <div className="space-y-3.5">
          {page.items.map((test) => {
            const modules = moduleViewsForTest(test.modules.map((m) => ({ ...m, questions: m.questions })));
            const a = test.assignments;
            const completed = a.filter((x) => x.status === "COMPLETED").length;
            const inProgress = a.filter((x) => x.attempts.length > 0).length;
            const overdue = a.filter((x) => x.status === "OVERDUE" || (x.status !== "COMPLETED" && x.dueDate && x.dueDate < now)).length;
            const firstAssigned = a.reduce<Date | null>((m, x) => (!m || x.createdAt < m ? x.createdAt : m), null);
            const nextDue = a
              .filter((x) => x.status !== "COMPLETED" && x.dueDate)
              .reduce<Date | null>((m, x) => (!m || x.dueDate! < m ? x.dueDate : m), null);
            return (
              <div key={test.id} className="overflow-hidden rounded-[10px] border border-gray-200 bg-white shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-2 bg-[var(--sat-area-tests)] px-4 py-2.5 text-[var(--sat-tests-ink)]">
                  <div className="flex flex-wrap items-center gap-2">
                    <b className="text-base">{test.name}</b>
                    <span className="text-sm">
                      {firstAssigned ? `· assigned ${formatDate(firstAssigned)}` : "· not assigned yet"}
                      {nextDue ? ` · next due ${formatDate(nextDue)}` : ""}
                    </span>
                    {test.status !== "PUBLISHED" ? <Badge variant={fullTestStatusBadgeVariant(test.status)}>{fullTestStatusLabel(test.status)}</Badge> : null}
                  </div>
                  <div className="flex gap-2">
                    <Button asChild size="sm" variant="secondary">
                      <Link href={`/teacher/tests/${test.id}/assign`}>Assign</Link>
                    </Button>
                    <Button asChild size="sm">
                      <Link href={`/teacher/tests/${test.id}`}>Open →</Link>
                    </Button>
                  </div>
                </div>
                <div className="grid gap-2.5 px-4 py-3">
                  <TestModuleTiles modules={modules} hrefFor={(m) => `/teacher/tests/${test.id}#module-${m.key}`} />
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    {/* Counts open the Test page's Students table (who is assigned, done, in progress, late). */}
                    <Link
                      href={`/teacher/tests/${test.id}#students`}
                      title="See the students of this test"
                      className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md text-sm text-gray-600 hover:underline"
                    >
                      <span className="inline-flex items-center gap-1"><User size={14} /> <b>{a.length}</b> assigned</span>
                      <span className="text-green-700"><b>{completed}</b> completed</span>
                      <span className="text-amber-700"><b>{inProgress}</b> in progress</span>
                      {overdue ? <span className="text-red-600"><b>{overdue}</b> overdue</span> : null}
                    </Link>
                    <FullTestActions
                      testId={test.id}
                      status={test.status}
                      hasAssignments={test._count.assignments > 0}
                      hasAttempts={test._count.attempts > 0}
                      variant="list"
                    />
                  </div>
                </div>
              </div>
            );
          })}
          <Pagination basePath="/teacher/tests" params={{}} pageSize={PAGE_SIZE} {...page} />
        </div>
      )}
    </PageShell>
  );
}
