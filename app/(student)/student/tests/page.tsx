import Link from "next/link";
import { redirect } from "next/navigation";
import { EmptyState, PageShell, VoidableValue } from "@/components/sat";
import { Breadcrumbs } from "@/components/sat/breadcrumbs";
import { LineChart } from "@/components/sat/line-chart";
import { ModuleTiles, SectionCell } from "@/components/sat/test-ui";
import { DueLine, WorkStatusBadges } from "@/components/sat/work-status";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { auth } from "@/lib/auth";
import { loadStudentTests, sortTests, type StudentTestItem } from "@/lib/test-assignments";
import { formatDate } from "@/lib/utils";

interface PageProps {
  searchParams: Promise<{ view?: string }>;
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

  return (
    <PageShell>
      <Breadcrumbs items={[{ label: "Home", href: "/student" }, { label: "Tests" }]} />
      <h1 className="text-2xl font-semibold text-gray-900">Tests</h1>
      <p className="mt-1 text-sm text-gray-500">
        Full-length SAT tests assigned by your teacher. You can take a whole test or choose one module at a time.
      </p>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card as={Link} href="/student/tests?view=pending" padding="md" className="hover:border-gray-400">
          <p className="text-xs text-gray-500">Tests to take</p>
          <p className="mt-1 text-2xl font-semibold text-gray-900">{pending.length}</p>
          <p className="text-xs text-gray-500">{inProgress} in progress · {overdue} overdue</p>
        </Card>
        <Card as={Link} href="/student/tests?view=completed" padding="md" className="hover:border-gray-400">
          <p className="text-xs text-gray-500">Tests completed</p>
          <p className="mt-1 text-2xl font-semibold text-gray-900">{done.length} of {items.length}</p>
          <p className="text-xs text-gray-500">{attemptsTotal} attempt{attemptsTotal === 1 ? "" : "s"} in total · see them</p>
        </Card>
        <Card padding="md" className="border-gray-800 bg-gray-900 text-white">
          <p className="text-xs text-gray-300">Best total score</p>
          <p className="mt-1 text-2xl font-semibold">{best ?? "—"}</p>
          <p className="text-xs text-gray-300">out of 1600</p>
        </Card>
        {latest ? (
          <Card as={Link} href={`/student/tests/results/${latest.attempt.id}`} padding="md" className="hover:border-gray-400">
            <p className="text-xs text-gray-500">Latest total score</p>
            <p className="mt-1 text-2xl font-semibold text-gray-900">{latest.attempt.totalScore ?? "—"}</p>
            <p className="text-xs text-gray-500">{latest.test.name} · {formatDate(latest.attempt.submittedAt!)} · open ›</p>
          </Card>
        ) : (
          <Card padding="md">
            <p className="text-xs text-gray-500">Latest total score</p>
            <p className="mt-1 text-2xl font-semibold text-gray-400">—</p>
            <p className="text-xs text-gray-500">No finished test yet</p>
          </Card>
        )}
      </div>

      <nav aria-label="Tests view" className="mb-4 mt-6 flex gap-1 border-b border-gray-200">
        {VIEWS.map((v) => {
          const count = v === "pending" ? pending.length : v === "completed" ? done.length : items.length;
          const label = v === "pending" ? "Pending" : v === "completed" ? "Completed" : "All";
          return (
            <Link
              key={v}
              href={`/student/tests?view=${v}`}
              aria-current={view === v ? "page" : undefined}
              className={`border-b-2 px-3 py-2 text-sm font-medium ${view === v ? "border-gray-900 text-gray-900" : "border-transparent text-gray-500 hover:text-gray-800"}`}
            >
              {label} ({count})
            </Link>
          );
        })}
      </nav>
      {view === "pending" && pending.length > 0 ? <p className="mb-3 text-xs text-gray-500">Sorted by due date. Tests in progress appear first.</p> : null}

      {shown.length === 0 ? (
        <EmptyState title={view === "pending" ? "No pending tests. Great job!" : "No tests here yet."} />
      ) : (
        <div className="space-y-4">
          {shown.map((t) => (
            <TestCard key={t.assignmentId} item={t} />
          ))}
        </div>
      )}

      {view !== "pending" && submitted.length > 0 ? (
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <Card padding="md">
            <h2 className="text-sm font-semibold text-gray-900">Total score over time</h2>
            <p className="mb-2 text-xs text-gray-500">Completed tests only</p>
            <LineChart title="Total score over time" min={400} max={1600} labels={chartLabels} series={[{ name: "Total", color: "#111827", values: submitted.map((s) => s.attempt.totalScore) }]} />
          </Card>
          <Card padding="md">
            <h2 className="text-sm font-semibold text-gray-900">Section scores over time</h2>
            <p className="mb-2 text-xs text-gray-500">Each section is scored 200–800</p>
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

function shortName(name: string) {
  return name.replace(/^TEST\s*/i, "T");
}

function TestCard({ item }: { item: StudentTestItem }) {
  const base = `/student/tests/${item.assignmentId}`;
  const next = item.openAttempt?.view?.nextModule ?? null;
  const showPicker = item.state !== "done";
  return (
    <Card id={`test-${item.assignmentId}`} padding="md" className="scroll-mt-20">
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
          {item.lastSubmitted ? (
            <Button asChild variant="ghost" size="sm">
              <Link href={`/student/tests/results/${item.lastSubmitted.id}`}>View latest results</Link>
            </Button>
          ) : null}
          {item.state === "progress" && next ? (
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
            modules={item.modules}
            hrefFor={(m) => (m.state === "done" && item.openAttempt ? `/student/tests/results/${item.openAttempt.id}#mod-${m.key}` : `${base}?module=${m.key}`)}
          />
        </div>
      ) : null}

      {item.attempts.length > 0 ? (
        <div className="mt-4 overflow-x-auto">
          <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">Attempts</h3>
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-gray-500">
              <tr>
                <th className="py-1 pr-3">Attempt</th>
                <th className="pr-3">Date</th>
                <th className="pr-3">R&amp;W</th>
                <th className="pr-3">Math</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {item.attempts.map((a) => (
                <tr key={a.id}>
                  <td className="py-1.5 pr-3">
                    <Link href={`/student/tests/results/${a.id}`} className="text-blue-600 hover:underline">Try {a.tryNumber}</Link>
                    {a.status === "IN_PROGRESS" ? <Badge variant="warning" className="ml-2">In progress</Badge> : null}
                  </td>
                  <td className="pr-3 text-gray-600">{formatDate(a.submittedAt ?? a.startedAt)}</td>
                  <td className="pr-3">{a.view ? <SectionCell section={a.view.sections.RW} /> : <VoidableValue status={a.status}>{a.rwScore ?? "—"}</VoidableValue>}</td>
                  <td className="pr-3">{a.view ? <SectionCell section={a.view.sections.MATH} /> : <VoidableValue status={a.status}>{a.mathScore ?? "—"}</VoidableValue>}</td>
                  <td className="font-semibold">{a.view ? "—" : <VoidableValue status={a.status}>{a.totalScore ?? "—"}</VoidableValue>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </Card>
  );
}
