import Link from "next/link";
import { currentContentScope } from "@/lib/content-scope";
import { redirect } from "next/navigation";
import { Calculator, Plus, Sparkles, User } from "lucide-react";
import { EmptyState, ListFilters, PageHeader, PageShell, Pagination, TestNumberAccordion, groupTestVersions, matchesQuery, pageFromParam, paginate, PAGE_SIZE } from "@/components/sat";
import { Breadcrumbs } from "@/components/sat/breadcrumbs";
import { TestModuleTiles } from "@/components/sat/test-module-tiles";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { auth } from "@/lib/auth";
import { requireContentImporter } from "@/lib/rbac";
import prisma from "@/lib/prisma";
import { fullTestStatusBadgeVariant, fullTestStatusLabel } from "@/lib/domain-meta";
import { studentAccessWhereFor } from "@/lib/program-scope";
import { moduleViewsForTest } from "@/lib/test-view";
import { formatDate } from "@/lib/utils";
import { TestActionsMenu } from "./test-actions-menu-client";
import { HEADER_ACTION_CLASS, HEADER_SHORTCUT_CLASS, HeaderActions } from "@/components/sat/header-actions";
import { suggestionValues } from "@/lib/search-suggestions";
import { ACTIVE_SOURCE_WHERE } from "@/lib/content-source";
import { openQuickImports } from "@/lib/quick-import.server";

interface PageProps {
  searchParams: Promise<{ view?: string; page?: string; q?: string }>;
}


/**
 * Teacher Tests (mockup `mejorada/teacher/tests.html`): one card per Test with its 4 modules and how
 * many of the teacher's students have it assigned, completed, in progress or overdue. Results per
 * student are on each Test's page. Practice never appears here.
 */
export default async function TeacherTestsPage({ searchParams }: PageProps) {
  const session = await auth();
  // Admin and master teacher import Tests with AI; a Tests source without a TEST N offers "+ Import TEST N".
  const importer = await requireContentImporter();
  const canImport = Boolean(importer);
  // A TEST N already being imported (saved, no Draft yet): its gap offers "Continue TEST N", not a new import.
  const openImports = importer ? await openQuickImports(importer.user) : [];
  const openImportFor = (sourceId: string, number: number) =>
    openImports.find((item) => item.kind === "FULL_PRACTICE_TEST" && item.sourceId === sourceId && item.testNumber === number);
  const now = new Date();
  const query = await searchParams;
  // The students × tests matrix was replaced by the per-test page (mockup); old links land here.
  if (query.view === "results") redirect("/teacher/tests");

  const studentWhere = session ? studentAccessWhereFor(session.user, now) : { role: "STUDENT", active: true, validationStatus: "APPROVED" };
  const tests = (
    await prisma.fullPracticeTest.findMany({
      // The Tests of the programs the teacher teaches (shared bank).
      // Tests of an inactive source are hidden (assigned ones keep working for the students).
      where: { ...(await currentContentScope()), ...ACTIVE_SOURCE_WHERE },
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
  // One search, no other filter: a TEST number ("10", "TEST 10") or a source name ("Innovator").
  const q = query.q?.trim() ?? "";
  const qNumber = q.match(/^(?:test\s*)?(\d+)$/i)?.[1];
  const shown = tests.filter((t) => !q || (qNumber ? String(t.number ?? "") === qNumber : matchesQuery(q, t.source?.name)));
  const filterParams = { q: q || undefined };
  // Every TEST N from 1 to the highest one, in every active Tests source: a source without that TEST N
  // shows "—" ("+ Import TEST N" for admin / master teacher); a TEST N no source has shows "—".
  const testSources = await prisma.source.findMany({ where: { active: true, forTests: true }, select: { id: true, name: true, sortOrder: true } });
  const maxNumber = tests.reduce((m, t) => Math.max(m, t.number ?? 0), 0);
  // "Import with AI" (header) only while something can be added: no Test yet, or an active Tests source
  // missing a number from TEST 1 to the highest. Complete = no button.
  const hasGap =
    canImport &&
    testSources.length > 0 &&
    (maxNumber === 0 ||
      testSources.some((source) => Array.from({ length: maxNumber }, (_, i) => i + 1).some((n) => !tests.some((t) => t.number === n && t.source?.id === source.id))));
  const gaps = Array.from({ length: maxNumber }, (_, i) => i + 1).flatMap((number) =>
    testSources
      .filter((source) => !tests.some((t) => t.number === number && t.source?.id === source.id))
      .filter((source) => !q || (qNumber ? String(number) === qNumber : matchesQuery(q, source.name)))
      .map((source) => ({ key: `gap-${number}-${source.id}`, sourceId: source.id, number, sourceName: source.name, sourceOrder: source.sortOrder, empty: true, node: null })),
  );
  // Pagination counts "TEST N" groups (every version of a test stays on the same page).
  const testGroups = groupTestVersions([
    ...shown.map((test) => ({ key: test.id, number: test.number, sourceName: test.source?.name ?? "No source", sourceOrder: test.source?.sortOrder ?? 999, node: null })),
    ...gaps,
  ]);
  const page = paginate(testGroups, pageFromParam(query.page), PAGE_SIZE);
  const pageTests = new Set(page.items.flatMap((group) => group.versions.map((version) => version.key)));


  return (
    <PageShell>
      <Breadcrumbs items={[{ label: "Home", href: "/teacher" }, { label: "Tests" }]} />
      <PageHeader
        title="Tests"
        description="Manage full-length tests. Each test has 4 modules: 2 of Reading & Writing and 2 of Math. Section scores (200–800) appear only on Test pages, never in practice."
        actions={
          <HeaderActions>
            {/* The questions of the Tests in the Question Bank (with the way back here). */}
            <Link href="/teacher/questions?area=tests" className={HEADER_SHORTCUT_CLASS}>Questions →</Link>
            <Link href="/teacher/tests/scoring" className={HEADER_ACTION_CLASS}>
              <Calculator size={14} aria-hidden /> How scores work
            </Link>
            {hasGap ? (
              <Link href="/teacher/import?kind=FULL_PRACTICE_TEST" className={HEADER_ACTION_CLASS}>
                <Sparkles size={14} aria-hidden /> Import with AI
              </Link>
            ) : null}
          </HeaderActions>
        }
      />

      <ListFilters
        action="/teacher/tests"
        q={q}
        placeholder="TEST number or source"
        suggestions={suggestionValues([
          ...tests.map((t) => (t.number ? `TEST ${t.number}` : null)),
          ...tests.map((t) => t.source?.name),
        ])}
      />
      {tests.length === 0 ? (
        <EmptyState title="No tests yet." description={canImport ? "Import one with Import with AI." : "Your program has no tests yet."} />
      ) : testGroups.length === 0 ? (
        <EmptyState title="No tests match these filters." />
      ) : (
        <div className="space-y-3.5">
          {/* One "TEST N" accordion per test number; inside, each source's version with its card. */}
          <TestNumberAccordion
            items={[
              ...gaps.filter((gap) => pageTests.has(gap.key)).map(({ sourceId, ...gap }) => ({
                ...gap,
                node: (
                  <div className="flex flex-wrap items-center gap-3 rounded-[10px] border border-dashed border-gray-300 bg-white px-4 py-2.5 text-sm text-[var(--sat-muted)]">
                    <span title={`${gap.sourceName} has no TEST ${gap.number} yet`}>—</span>
                    {canImport && openImportFor(sourceId, gap.number) ? (
                      <Link
                        href={openImportFor(sourceId, gap.number)!.href}
                        title={`${gap.sourceName} TEST ${gap.number} import started: continue it`}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--sat-primary)] bg-[var(--sat-primary-soft)] px-2.5 py-[5px] text-xs font-semibold text-[var(--sat-primary)] hover:underline"
                      >
                        Continue TEST {gap.number} import
                      </Link>
                    ) : canImport ? (
                      <Link
                        href={`/teacher/import?${new URLSearchParams({ kind: "FULL_PRACTICE_TEST", source: sourceId, number: String(gap.number) }).toString()}`}
                        title={`Import ${gap.sourceName} TEST ${gap.number} with AI`}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-[var(--sat-border)] px-2.5 py-[5px] text-xs font-semibold hover:border-[var(--sat-primary)] hover:bg-[var(--sat-primary-soft)] hover:text-[var(--sat-primary)]"
                      >
                        <Plus size={12} aria-hidden /> Import TEST {gap.number}
                      </Link>
                    ) : null}
                  </div>
                ),
              })),
              ...shown.filter((test) => pageTests.has(test.id)).map((test) => {
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
                  {/* Main button + the options drop-down (same pattern as a practice set). */}
                  <div className="flex gap-2">
                    <TestActionsMenu test={{ id: test.id, name: test.name, status: test.status }} canDelete={test._count.assignments === 0 && test._count.attempts === 0} />
                    <Button asChild size="sm">
                      <Link href={`/teacher/tests/${test.id}`}>Open →</Link>
                    </Button>
                  </div>
                </div>
                <div className="grid gap-2.5 px-4 py-3">
                  <TestModuleTiles modules={modules} hrefFor={(m) => `/teacher/tests/${test.id}#module-${m.key}`} />
                  <div className="flex flex-wrap items-center gap-2">
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
                  </div>
                </div>
              </div>
              ),
            };
            }),
            ]}
          />
          <Pagination basePath="/teacher/tests" params={filterParams} pageSize={PAGE_SIZE} {...page} />
        </div>
      )}
    </PageShell>
  );
}
