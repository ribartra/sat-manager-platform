import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Breadcrumbs,
  EmptyState,
  LinkTabs,
  PageShell,
  Pagination,
  SectionHeader,
  StatGrid,
  StatTile,
  TestAttemptsTable,
  pageFromParam,
  paginate,
} from "@/components/sat";
import { LineChart } from "@/components/sat/line-chart";
import { RetakeTestButton } from "@/components/sat/retake-test-button";
import { ModuleTiles } from "@/components/sat/test-ui";
import { DueLine, WorkStatusBadges } from "@/components/sat/work-status";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { auth } from "@/lib/auth";
import { loadStudentTests, sortTests, type StudentTestItem } from "@/lib/test-assignments";
import { formatDate } from "@/lib/utils";

interface PageProps {
  searchParams: Promise<{ view?: string; page?: string }>;
}

const VIEWS = ["pending", "completed", "all"] as const;
type View = (typeof VIEWS)[number];

/** Student Tests (mockup "tests.html"): pending / completed / all, module picker per Test, attempts and score charts. */
export default async function StudentTestsPage({ searchParams }: PageProps) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const query = await searchParams;
  const view: View = VIEWS.includes(query.view as View) ? (query.view as View) : "pending";

  const items = await loadStudentTests(session.user.id);
  const { pending, done } = sortTests(items);
  const shown = view === "pending" ? pending : view === "completed" ? done : [...pending, ...done];

  const submitted = items
    .flatMap((t) => t.attempts.filter((a) => a.status === "SUBMITTED").map((a) => ({ test: t, attempt: a })))
    .sort((a, b) => (a.attempt.submittedAt?.getTime() ?? 0) - (b.attempt.submittedAt?.getTime() ?? 0));
  const latest = submitted[submitted.length - 1] ?? null;
  const best = submitted.reduce<number | null>((m, s) => (s.attempt.totalScore !== null && (m === null || s.attempt.totalScore > m) ? s.attempt.totalScore : m), null);
  const inProgress = pending.filter((t) => t.state === "progress").length;
  const overdue = pending.filter((t) => t.overdue).length;
  const attemptsTotal = submitted.length;
  const chartLabels = submitted.map((s) => `${shortName(s.test.name)} · try ${s.attempt.tryNumber}`);

  const page = paginate(shown, pageFromParam(query.page), TESTS_PAGE_SIZE);

  return (
    <PageShell>
      <Breadcrumbs items={[{ label: "Home", href: "/student" }, { label: "Tests" }]} />
      <h1 className="text-2xl font-semibold text-gray-900">Tests</h1>
      <p className="mb-5 mt-1 text-sm text-gray-500">
        Full-length SAT tests assigned by your teacher. You can take a whole test or choose one module at a time.
      </p>

      <StatGrid cols={4}>
        <StatTile label="Tests to take" value={pending.length} sub={`${inProgress} in progress · ${overdue} overdue`} href="/student/tests?view=pending" />
        <StatTile
          label="Tests completed"
          value={`${items.filter((t) => t.lastSubmitted).length} of ${items.length}`}
          sub={`${attemptsTotal} attempt${attemptsTotal === 1 ? "" : "s"} in total · see them`}
          href="/student/tests?view=completed"
        />
        <StatTile tone="dark" label="Best total score" value={best ?? "—"} sub="out of 1600" />
        {latest ? (
          <StatTile
            label="Latest total score"
            value={latest.attempt.totalScore ?? "—"}
            sub={<>{latest.test.name} · {formatDate(latest.attempt.submittedAt!)} · open ›</>}
            href={`/student/tests/results/${latest.attempt.id}`}
          />
        ) : (
          <StatTile label="Latest total score" value={<span className="text-gray-400">—</span>} sub="No finished test yet" />
        )}
      </StatGrid>

      <LinkTabs
        className="mt-6"
        label="Tests view"
        active={view}
        tabs={VIEWS.map((v) => ({
          key: v,
          label: v === "pending" ? "Pending" : v === "completed" ? "Completed" : "All",
          count: v === "pending" ? pending.length : v === "completed" ? done.length : items.length,
          href: `/student/tests?view=${v}`,
        }))}
      />
      {view === "pending" && pending.length > 0 ? <p className="mb-3 text-xs text-gray-500">Sorted by due date. Tests in progress appear first.</p> : null}

      {shown.length === 0 ? (
        <EmptyState title={view === "pending" ? "No pending tests. Great job!" : "No tests here yet."} />
      ) : (
        <div id="tests" className="scroll-mt-6 space-y-4">
          {page.items.map((t) => (
            <TestCard key={t.assignmentId} item={t} />
          ))}
          <Pagination basePath="/student/tests" params={{ view }} anchor="tests" pageSize={TESTS_PAGE_SIZE} {...page} />
        </div>
      )}

      {view !== "pending" && submitted.length > 0 ? (
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <Card padding="md">
            <SectionHeader size="sm" title="Total score over time" description="Completed tests only · 400–1600" />
            <LineChart title="Total score over time" min={400} max={1600} labels={chartLabels} series={[{ name: "Total", color: "#6b7280", values: submitted.map((s) => s.attempt.totalScore) }]} />
          </Card>
          <Card padding="md">
            <SectionHeader size="sm" title="Section scores over time" description="Each section is scored 200–800" />
            <LineChart
              title="Section scores over time"
              min={200}
              max={800}
              labels={chartLabels}
              series={[
                { name: "Reading & Writing", color: "var(--sat-area-reading)", values: submitted.map((s) => s.attempt.rwScore) },
                { name: "Math", color: "var(--sat-area-math)", values: submitted.map((s) => s.attempt.mathScore), dashed: true },
              ]}
            />
          </Card>
        </div>
      ) : null}
    </PageShell>
  );
}

const TESTS_PAGE_SIZE = 10;

function shortName(name: string) {
  return name.replace(/^TEST\s*/i, "T");
}

function TestCard({ item }: { item: StudentTestItem }) {
  const base = `/student/tests/${item.assignmentId}`;
  const next = item.openAttempt?.view?.nextModule ?? null;
  const showPicker = item.state !== "done";
  return (
    <Card id={`test-${item.assignmentId}`} padding="md" className="scroll-mt-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold text-gray-900">{item.name}</h2>
            <WorkStatusBadges state={item.state} overdue={item.overdue} />
          </div>
          <DueLine
            assignedAt={item.assignedAt}
            dueDate={item.dueDate}
            completedAt={item.state === "done" ? item.lastSubmitted?.submittedAt ?? null : null}
            className="mt-1"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {item.state === "done" && item.lastSubmitted ? (
            <>
              <Button asChild variant="ghost" size="sm">
                <Link href={`/student/tests/results/${item.lastSubmitted.id}`}>View latest results</Link>
              </Button>
              <RetakeTestButton assignmentId={item.assignmentId} testName={item.name} />
            </>
          ) : item.state === "progress" && next ? (
            <Button asChild size="sm">
              <Link href={`${base}?module=${next.key}`}>Continue with {next.short} ›</Link>
            </Button>
          ) : item.state === "todo" ? (
            <Button asChild size="sm">
              <Link href={`${base}?module=rw1`}>Start test ›</Link>
            </Button>
          ) : null}
        </div>
      </div>

      {showPicker ? (
        <div className="mt-4">
          <p className="mb-2 text-xs text-gray-500">Or choose a module to {item.state === "progress" ? "continue with" : "start with"}:</p>
          <ModuleTiles
            detail
            modules={item.modules}
            hrefFor={(m) => (m.state === "done" && item.openAttempt ? `/student/tests/results/${item.openAttempt.id}#mod-${m.key}` : `${base}?module=${m.key}`)}
          />
        </div>
      ) : null}

      {item.attempts.length > 0 ? (
        <div className="mt-4">
          <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">Attempts</h3>
          <TestAttemptsTable rows={item.attempts} hrefFor={(id) => `/student/tests/results/${id}`} />
        </div>
      ) : null}
    </Card>
  );
}
