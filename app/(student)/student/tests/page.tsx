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
  TestAttemptsAccordion,
  TestCardsByNumber,
  type TestCardLinks,
  pageFromParam,
  paginate,
} from "@/components/sat";
import { testGroups as groupTests } from "@/lib/attempt-groups";
import { auth } from "@/lib/auth";
import { loadStudentTests, sortTests } from "@/lib/test-assignments";
import { formatDate } from "@/lib/utils";

interface PageProps {
  searchParams: Promise<{ view?: string; page?: string }>;
}

const VIEWS = ["pending", "completed", "all"] as const;
type View = (typeof VIEWS)[number];

/** Student Tests (mockup "tests.html"): pending / completed / all, module picker per Test, attempts grouped per Test. */
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
  const inProgress = pending.filter((t) => t.state === "progress").length;
  const overdue = pending.filter((t) => t.overdue).length;
  const attemptsTotal = submitted.length;
  // Attempt level only: one row per Test with its last try (no best score, no chart across Tests).
  const attemptGroups = groupTests(items, (a) => a.status !== "INVALIDATED");

  const page = paginate(shown, pageFromParam(query.page), TESTS_PAGE_SIZE);

  return (
    <PageShell>
      <Breadcrumbs items={[{ label: "Home", href: "/student" }, { label: "Tests" }]} />
      <h1 className="text-[26px] font-bold tracking-[-0.3px] text-gray-900">Tests</h1>
      <p className="mb-5 mt-1 text-sm text-gray-500">
        Full-length SAT tests assigned by your teacher. You can take a whole test or choose one module at a time.
      </p>

      <StatGrid cols={3}>
        <StatTile label="Tests to take" value={pending.length} sub={`${inProgress} in progress · ${overdue} overdue`} href="/student/tests?view=pending" />
        <StatTile
          label="Tests completed"
          value={`${items.filter((t) => t.lastSubmitted).length} of ${items.length}`}
          sub={`${attemptsTotal} attempt${attemptsTotal === 1 ? "" : "s"} in total · see them`}
          href="/student/tests?view=completed"
        />
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
        <div id="tests" className="scroll-mt-6">
          <TestCardsByNumber items={page.items} links={STUDENT_TEST_CARD_LINKS} openPending />
          <Pagination basePath="/student/tests" params={{ view }} anchor="tests" pageSize={TESTS_PAGE_SIZE} {...page} />
        </div>
      )}

      {view !== "pending" && attemptGroups.length > 0 ? (
        <section className="mt-6">
          <SectionHeader title="Your attempts" description="One row per test with its last try. Open a test to see every try." />
          <TestAttemptsAccordion tests={attemptGroups} hrefFor={(id) => `/student/tests/results/${id}`} />
        </section>
      ) : null}
    </PageShell>
  );
}

const TESTS_PAGE_SIZE = 10;

/** The student's Test card links (same card as every view): start / continue modules, review, retake. */
const STUDENT_TEST_CARD_LINKS: TestCardLinks = {
  attempt: (id) => `/student/tests/results/${id}`,
  module: (assignmentId, moduleKey) => `/student/tests/${assignmentId}?module=${moduleKey}`,
  canRetake: true,
};

