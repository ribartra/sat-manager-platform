import Link from "next/link";
import { currentContentScope } from "@/lib/content-scope";
import { redirect } from "next/navigation";
import { Plus, Sparkles, User } from "lucide-react";
import { EmptyState, ListFilters, PageShell, Pagination, TestNumberAccordion, groupTestVersions, matchesQuery, pageFromParam, paginate } from "@/components/sat";
import { Breadcrumbs } from "@/components/sat/breadcrumbs";
import { TestModuleTiles } from "@/components/sat/test-module-tiles";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { auth } from "@/lib/auth";
import { requireContentImporter } from "@/lib/rbac";
import { listSources } from "@/lib/content-source";
import prisma from "@/lib/prisma";
import { fullTestStatusBadgeVariant, fullTestStatusLabel } from "@/lib/domain-meta";
import { studentAccessWhereFor } from "@/lib/program-scope";
import { moduleViewsForTest } from "@/lib/test-view";
import { formatDate } from "@/lib/utils";
import { FullTestActions } from "./full-test-actions-client";

interface PageProps {
  searchParams: Promise<{ view?: string; page?: string; q?: string; status?: string; assigned?: string }>;
}

const PAGE_SIZE = 10;

/**
 * Teacher Tests (mockup `mejorada/teacher/tests.html`): one card per Test with its 4 modules and how
 * many of the teacher's students have it assigned, completed, in progress or overdue. Results per
 * student are on each Test's page. Practice never appears here.
 */
export default async function TeacherTestsPage({ searchParams }: PageProps) {
  const session = await auth();
  // Admin and master teacher import Tests with AI; a Tests source with no test yet offers "+ Import test".
  const canImport = Boolean(await requireContentImporter());
  const now = new Date();
  const query = await searchParams;
  // The students × tests matrix was replaced by the per-test page (mockup); old links land here.
  if (query.view === "results") redirect("/teacher/tests");

  const studentWhere = session ? studentAccessWhereFor(session.user, now) : { role: "STUDENT", active: true, validationStatus: "APPROVED" };
  const tests = (
    await prisma.fullPracticeTest.findMany({
      // The Tests of the programs the teacher teaches (shared bank).
      where: await currentContentScope(),
      include: {
        source: { select: { id: true, name: true, sortOrder: true } },
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
  )
    // Grouped by source (SAT-022: Innovator, College Board 2025, College Board 2026, …), then by name.
    .sort(
      (a, b) =>
        (a.source?.sortOrder ?? 999) - (b.source?.sortOrder ?? 999) ||
        (a.source?.name ?? "").localeCompare(b.source?.name ?? "") ||
        a.name.localeCompare(b.name, "en", { numeric: true }),
    );
  // Search + filters (URL): name, status, assigned to the teacher's students or not.
  const status = ["PUBLISHED", "DRAFT", "ARCHIVED"].includes(query.status ?? "") ? query.status : undefined;
  const assigned = query.assigned === "yes" || query.assigned === "no" ? query.assigned : undefined;
  const shown = tests.filter(
    (t) =>
      matchesQuery(query.q, t.name) &&
      (!status || t.status === status) &&
      (!assigned || (assigned === "yes") === t.assignments.length > 0),
  );
  const filterParams = { q: query.q || undefined, status, assigned };
  // Pagination counts "TEST N" groups (every version of a test stays on the same page).
  const testGroups = groupTestVersions(
    shown.map((test) => ({ key: test.id, number: test.number, sourceName: test.source?.name ?? "No source", sourceOrder: test.source?.sortOrder ?? 999, node: null })),
  );
  const page = paginate(testGroups, pageFromParam(query.page), PAGE_SIZE);
  const pageTests = new Set(page.items.flatMap((group) => group.versions.map((version) => version.key)));
  const emptySources = canImport
    ? (await listSources({ activeOnly: true, kind: "tests" })).filter((source) => !tests.some((test) => test.source?.id === source.id))
    : [];

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
          {canImport ? (
            <Button asChild variant="secondary">
              <Link href="/teacher/import?kind=FULL_PRACTICE_TEST"><Sparkles size={14} /> Import with AI</Link>
            </Button>
          ) : null}
          <Button asChild>
            <Link href="/teacher/tests/new"><Plus size={14} /> New test</Link>
          </Button>
        </div>
      </header>
      {emptySources.length ? (
        <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
          <span className="text-gray-500">No tests yet from</span>
          {emptySources.map((source) => (
            <Link
              key={source.id}
              href={`/teacher/import?${new URLSearchParams({ kind: "FULL_PRACTICE_TEST", source: source.id }).toString()}`}
              className="rounded-lg border border-dashed border-[var(--sat-border)] px-2.5 py-1 font-semibold text-[var(--sat-muted)] hover:border-[var(--sat-primary)] hover:bg-[var(--sat-primary-soft)]"
            >
              {source.name} · + Import test
            </Link>
          ))}
        </div>
      ) : null}

      <ListFilters
        action="/teacher/tests"
        q={query.q}
        placeholder="Test name"
        filters={[
          { name: "status", label: "Status", value: status, allLabel: "All statuses", options: ["PUBLISHED", "DRAFT", "ARCHIVED"].map((v) => ({ value: v, label: fullTestStatusLabel(v) })) },
          { name: "assigned", label: "Assigned", value: assigned, allLabel: "Assigned or not", options: [{ value: "yes", label: "Assigned to my students" }, { value: "no", label: "Not assigned yet" }] },
        ]}
      />
      {tests.length === 0 ? (
        <EmptyState title="No tests yet." description="Create one with New test." />
      ) : shown.length === 0 ? (
        <EmptyState title="No tests match these filters." />
      ) : (
        <div className="space-y-3.5">
          {/* One "TEST N" accordion per test number; inside, each source's version with its card. */}
          <TestNumberAccordion
            items={shown.filter((test) => pageTests.has(test.id)).map((test) => {
            const modules = moduleViewsForTest(test.modules.map((m) => ({ ...m, questions: m.questions })));
            const a = test.assignments;
            const completed = a.filter((x) => x.status === "COMPLETED").length;
            const inProgress = a.filter((x) => x.attempts.length > 0).length;
            const overdue = a.filter((x) => x.status === "OVERDUE" || (x.status !== "COMPLETED" && x.dueDate && x.dueDate < now)).length;
            const firstAssigned = a.reduce<Date | null>((m, x) => (!m || x.createdAt < m ? x.createdAt : m), null);
            const nextDue = a
              .filter((x) => x.status !== "COMPLETED" && x.dueDate)
              .reduce<Date | null>((m, x) => (!m || x.dueDate! < m ? x.dueDate : m), null);
            return {
              key: test.id,
              number: test.number,
              sourceName: test.source?.name ?? "No source",
              sourceOrder: test.source?.sortOrder ?? 999,
              node: (
              <div className="overflow-hidden rounded-[10px] border border-gray-200 bg-white shadow-sm">
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
              ),
            };
            })}
          />
          <Pagination basePath="/teacher/tests" params={filterParams} pageSize={PAGE_SIZE} {...page} />
        </div>
      )}
    </PageShell>
  );
}
