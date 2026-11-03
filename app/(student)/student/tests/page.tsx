import { PAGE_SIZE } from "@/components/sat/pagination";
import Link from "next/link";
import { redirect } from "next/navigation";
import { HEADER_SHORTCUT_CLASS, HeaderActions } from "@/components/sat/header-actions";
import { historyHref } from "@/lib/history-params";
import { pendingHref } from "@/lib/pending";
import { Breadcrumbs, EmptyState, LinkTabs, PageHeader, PageShell, Pagination, TestCardsByNumber, type TestCardLinks, pageFromParam, paginate } from "@/components/sat";
import { getStudentViewer } from "@/lib/student-viewer";
import { loadStudentTests, sortTests } from "@/lib/test-assignments";

interface PageProps {
  searchParams: Promise<{ view?: string; page?: string }>;
}

const VIEWS = ["pending", "completed", "all"] as const;
type View = (typeof VIEWS)[number];

/**
 * Student Tests: the assigned Tests as cards (the same Test card as every view) — to take / completed /
 * all — with Start / Continue per module, results and Retake. Every try is in History.
 */
export default async function StudentTestsPage({ searchParams }: PageProps) {
  // The student shown: the signed-in student, or the teacher's Student view (read only).
  const viewer = await getStudentViewer();
  if (!viewer) redirect("/login");
  const query = await searchParams;
  const view: View = VIEWS.includes(query.view as View) ? (query.view as View) : "pending";

  const items = await loadStudentTests(viewer.studentId);
  const { pending, done } = sortTests(items);
  const shown = view === "pending" ? pending : view === "completed" ? done : [...pending, ...done];

  const page = paginate(shown, pageFromParam(query.page), TESTS_PAGE_SIZE);

  return (
    <PageShell>
      <Breadcrumbs items={[{ label: "Home", href: "/student" }, { label: "Tests" }]} />
      <PageHeader
        title="Tests"
        description="Full-length SAT tests assigned by your teacher. You can take a whole test or choose one module at a time."
        actions={
          <HeaderActions>
            <Link href={pendingHref("/student/pending", { type: "tests" })} className={HEADER_SHORTCUT_CLASS}>Pending →</Link>
            {/* Every try of every Test (the cards show the last one). */}
            <Link href={historyHref({ type: "tests" }, {}, "/student/history")} className={HEADER_SHORTCUT_CLASS}>History →</Link>
          </HeaderActions>
        }
      />

      <LinkTabs
        label="Tests view"
        active={view}
        tabs={VIEWS.map((v) => ({
          key: v,
          label: v === "pending" ? "To take" : v === "completed" ? "Completed" : "All",
          count: v === "pending" ? pending.length : v === "completed" ? done.length : items.length,
          href: `/student/tests?view=${v}`,
        }))}
      />
      {view === "pending" && pending.length > 0 ? <p className="mb-3 text-xs text-gray-500">Sorted by due date. Tests in progress appear first.</p> : null}

      {shown.length === 0 ? (
        <EmptyState title={view === "pending" ? "No pending tests. Great job!" : "No tests here yet."} />
      ) : (
        <div id="tests" className="scroll-mt-6">
          <TestCardsByNumber items={page.items} links={viewer.readOnly ? { ...STUDENT_TEST_CARD_LINKS, canRetake: false } : STUDENT_TEST_CARD_LINKS} openPending />
          <Pagination basePath="/student/tests" params={{ view }} anchor="tests" pageSize={TESTS_PAGE_SIZE} {...page} />
        </div>
      )}

    </PageShell>
  );
}

const TESTS_PAGE_SIZE = PAGE_SIZE;

/** The student's Test card links (same card as every view): start / continue modules, review, retake. */
const STUDENT_TEST_CARD_LINKS: TestCardLinks = {
  attempt: (id) => `/student/tests/results/${id}`,
  module: (assignmentId, moduleKey) => `/student/tests/${assignmentId}?module=${moduleKey}`,
  canRetake: true,
};

