import {
  AreaBoxGrid,
  CompactAreaBox,
  AttemptStatusBadge,
  EmptyState,
  PageShell,
  PracticeAreaTabs,
  PracticeSetAttemptsAccordion,
  TestAttemptsAccordion,
  SectionHeader,
  SkillResults,
  StatGrid,
  StatTile,
  TestCardsByNumber,
  type TestCardLinks,
  invalidatedRowClass,
  isInvalidated,
} from "@/components/sat";
import { AreaTag } from "@/components/sat/practice-set-row";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import type { ReactNode } from "react";
import { formatClock, formatDate } from "@/lib/utils";
import { assignmentStatusLabel, difficultyLabel } from "@/lib/domain-meta";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Hint, InfoHint } from "@/components/hint";
import { ClipboardList, Eye, History, Pencil, Plus } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { StudentDetailActions } from "./actions-client";
import { UnlockRequestActions } from "../../unlock-request-actions-client";
import { StudentSwitcher } from "./student-switcher";
import { GenerateReportDialog } from "./generate-report-dialog";
import { practiceSetGroups, setsFromReportAttempts, testGroups as groupTests } from "@/lib/attempt-groups";
import { ParentContact } from "./parent-contact";
import { refreshAssignmentStates } from "@/lib/assignments";
import { getFeatureSetting } from "@/lib/app-settings";
import { studentAccessWhereFor } from "@/lib/program-scope";
import { loadMockReport, loadPracticeReport, shortSetName } from "@/lib/student-report";
import { activeAreaTab, activeHomeTab, practiceAreaFromTab, practiceAreaLabel, resolvePracticeArea, type HomeTabKey, type PracticeAreaCode } from "@/lib/practice-area";
import { Breadcrumbs } from "@/components/sat/breadcrumbs";
import { HEADER_ACTION_CLASS, HeaderActions } from "@/components/sat/header-actions";
import { Pct } from "@/components/sat/work-status";
import { loadStudentTests, sortTests } from "@/lib/test-assignments";
import { loadStudentOverviews } from "@/lib/teacher-overview";
import { relativeDay } from "@/lib/utils";
import { buildProgressHref, progressFiltersFromParams } from "@/lib/progress-filters";
import { assignHref } from "@/lib/assign-params";
import { historyHref } from "@/lib/history-params";
import { PENDING_PREVIEW, pendingHref } from "@/lib/pending";
import { officialSkillsFor } from "@/lib/taxonomy-order";

// One page per student (replaces the former Student Analytics and Individual Report views).
// Practice tabs (Math / Reading / Writing): results by skill (SkillResults: weakest skill line, then
// Easy / Medium / Hard per skill — last attempt of each set, weighted by questions — opening to each
// source) in the main column; active assignments and teacher comments in the side column; practice attempts grouped by set below. "Don't count" / comments live in History. "Generate Report" builds the same report as a PDF (server-side).
// Data comes from lib/student-report.ts, shared with the PDF so both show the same numbers.
// Taxonomy note: the `topic` param / Topic table is the SKILL level (Section → Domain → Skill).

interface PageProps {
  params: Promise<{ studentId: string }>;
  searchParams: Promise<{ area?: string; topic?: string; difficulty?: string; from?: string; to?: string; attemptsPage?: string; examsPage?: string; activityPage?: string; type?: string }>;
}


export default async function StudentPage({ params, searchParams }: PageProps) {
  const { studentId } = await params;
  const query = await searchParams;
  // No date filter on this page (every tab shows all results); old `from` / `to` links are ignored.
  const filters = { ...progressFiltersFromParams(query), from: undefined, to: undefined };
  const area = activeAreaTab(filters.area, filters.area);
  // Every try lives in History now: the old History / Activity tabs open it for this student.
  if (query.area === "history" || query.area === "activity") {
    redirect(historyHref({ student: studentId, type: query.type === "tests" || query.type === "practice" ? query.type : undefined }));
  }
  // Tabs: Summary · Math · Reading · Writing · Tests (no `area` param = Summary).
  const view: HomeTabKey = activeHomeTab(query.area);
  const practiceArea = practiceAreaFromTab(area);
  const topicId = filters.topic ?? "";
  const difficulty = filters.difficulty ?? "";

  const session = await auth();
  const now = new Date();
  await refreshAssignmentStates(now);
  // Groups are optional (Admin → Settings, off by default): hide every Group control while off, for admins too.
  const teacherGroupManagementEnabled = await getFeatureSetting("TEACHER_GROUP_MANAGEMENT");
  const studentWhere = session
    ? studentAccessWhereFor(session.user, now)
    : { role: "STUDENT", active: true, validationStatus: "APPROVED" };

  const [student, roster, skills] = await Promise.all([
    prisma.user.findFirst({
      where: { id: studentId, ...studentWhere },
      include: {
        groups: { include: { group: true } },
        programEnrollments: { include: { program: true }, where: { active: true, status: "APPROVED" } },
      },
    }),
    prisma.user.findMany({ where: studentWhere, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    practiceArea ? officialSkillsFor(practiceArea) : Promise.resolve([]),
  ]);
  if (!student) notFound();

  // Report dialog: linked parents (email recipients) and submitted exams (per-exam report).
  const [parentLinks, submittedExams] = await Promise.all([
    prisma.parentStudent.findMany({
      where: { studentId },
      include: { parent: { select: { id: true, name: true, email: true } } },
      orderBy: { parent: { name: "asc" } },
    }),
    prisma.fullPracticeTestAttempt.findMany({
      where: { studentId, status: "SUBMITTED" },
      select: { id: true, submittedAt: true, totalScore: true, test: { select: { name: true } } },
      orderBy: { submittedAt: "desc" },
    }),
  ]);
  const reportParents = parentLinks.map((link) => link.parent);
  const reportExams = submittedExams.map((exam) => ({
    id: exam.id,
    label: `${exam.test.name} · ${exam.submittedAt ? formatDate(exam.submittedAt) : "—"} · ${exam.totalScore ?? "—"}`,
  }));

  const reportFilters = { topic: filters.topic, difficulty: filters.difficulty, from: filters.from, to: filters.to };
  const filterSummary = [
    topicId ? `Skill: ${skills.find((skill) => skill.id === topicId)?.name ?? topicId}` : null,
    difficulty ? `Difficulty: ${difficultyLabel(difficulty)}` : null,
  ].filter(Boolean).join(" · ");
  const switcherQuery = buildProgressHref("", filters).replace(/^\?/, "");
  const secondaryButton = HEADER_ACTION_CLASS;
  // Assign practice opens on the practice tab being viewed (Math by default), with its skill / level filters.
  const assignPracticeArea = area === "reading" || area === "writing" ? area : "math";
  const assignPracticeHref = assignHref({ studentId, area: assignPracticeArea, topic: filters.topic, difficulty: filters.difficulty });

  // Test cards for the teacher: completed modules open the attempt, nothing to start, no retake.
  const teacherTestLinks: TestCardLinks = {
    attempt: (id) => buildProgressHref(`/teacher/students/${studentId}/tests/${id}`, filters),
    module: null,
    test: (testId) => `/teacher/tests/${testId}`,
    canRetake: false,
  };

  const header = (
    <>
      <Breadcrumbs items={[{ label: "Home", href: "/teacher" }, { label: "Students", href: "/teacher/students" }, { label: student.name }]} />
      <div className="mb-[18px] flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <Avatar name={student.name} avatarUrl={student.avatarUrl} size="xl" />
          <div className="min-w-0">
            <StudentSwitcher name={student.name} students={roster} selectedStudentId={studentId} query={switcherQuery} />
            <p className="mt-0.5 truncate text-xs text-gray-500">
              {student.email} · {student.phone ?? "—"}
              {student.startDate && <> · Student since {formatDate(student.startDate)}</>}
              {teacherGroupManagementEnabled && <> · Groups: {student.groups.map((g) => g.group.name).join(", ") || "—"}</>}
              {" · "}Programs: {student.programEnrollments.map((e) => e.program.name).join(", ") || "—"}
            </p>
            <p className="text-xs text-gray-500">
              Last active: {student.lastActiveAt ? `${formatDate(student.lastActiveAt)} (${relativeDay(student.lastActiveAt)})` : "never"}
            </p>
            <ParentContact studentId={studentId} studentName={student.name} parents={parentLinks.map((link) => link.parent)} />
          </div>
        </div>
        <div className="flex flex-col items-start gap-2 lg:items-end">
          <HeaderActions>
            <Link href="/teacher" className={secondaryButton}>Back to Home</Link>
            <Hint label="See the app the way this student sees it (view only).">
              <Link href={buildProgressHref(`/teacher/impersonate/${studentId}`, filters)} className={secondaryButton}>
                <Eye size={14} /> Student view
              </Link>
            </Hint>
            <Link href={historyHref({ student: studentId })} className={secondaryButton}>
              <History size={14} /> History
            </Link>
            <GenerateReportDialog
              studentId={studentId}
              studentName={student.name}
              currentArea={area}
              filters={reportFilters}
              filterSummary={filterSummary}
              exams={reportExams}
              parents={reportParents}
            />
          </HeaderActions>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Hint label="Give this student one or more practice sets.">
          <Link href={assignPracticeHref} className="inline-flex h-9 items-center justify-center gap-1 shrink-0 whitespace-nowrap rounded-lg bg-[var(--sat-primary)] px-3.5 text-sm font-semibold text-white hover:bg-[var(--sat-primary-dark)]">
            <Plus size={14} /> Assign practice
          </Link>
        </Hint>
        <Hint label="Give this student a full-length Test (4 modules).">
          <Link href={assignHref({ studentId, area: "tests" })} className="inline-flex h-9 items-center justify-center gap-1 rounded-md bg-[var(--sat-area-tests)] px-3.5 text-sm font-medium text-[var(--sat-tests-ink)] hover:brightness-95">
            <ClipboardList size={14} /> Assign test
          </Link>
        </Hint>
        <span className="mx-1 hidden h-5 w-px bg-gray-200 sm:inline-block" aria-hidden />
        <Hint label="Edit name, email, phone and start date.">
          <Link href={`/teacher/students/${studentId}/edit`} className={secondaryButton}>
            <Pencil size={14} /> Edit
          </Link>
        </Hint>
        <StudentDetailActions studentId={studentId} isActive={student.active} />
      </div>

      <PracticeAreaTabs
        basePath={`/teacher/students/${studentId}`}
        active={view}
        includeSummary
        preserve={{ difficulty: filters.difficulty }}
        className="mb-3"
      />
    </>
  );
  const first = student.name.split(" ")[0];

  // ---------------------------------------------------------------- Summary (mockup mejorada/teacher/student.html)
  if (view === "summary") {
    const [overview, tests] = await Promise.all([
      loadStudentOverviews([studentId], now).then((m) => m.get(studentId)!),
      loadStudentTests(studentId),
    ]);
    const activity = await loadActivity(studentId, 4);
    const testItems = tests.filter((t) => t.attempts.length > 0 || t.state !== "done");
    return (
      <PageShell>
        {header}
        {/* report-9: the area cards are practice sets; say so above them, like the Tests block below. */}
        <SectionHeader
          title={<>Practice Sets <span className="text-xs font-normal text-gray-500">· last attempt in each area</span></>}
          action={<Link href={historyHref({ student: studentId, type: "practice" })} className="text-sm text-blue-600 hover:underline">Attempts ›</Link>}
        />
        <AreaBoxGrid>
          {(["MATH", "READING", "WRITING"] as PracticeAreaCode[]).map((code) => {
            const o = overview.areas[code];
            return (
              <CompactAreaBox
                key={code}
                area={code}
                label={practiceAreaLabel(code)}
                href={`/teacher/students/${studentId}?area=${code.toLowerCase()}`}
                pct={o.last?.pct ?? null}
                line1={o.last ? `Latest practice · ${o.last.setName} · ${relativeDay(o.last.at)}` : "Not practiced yet"}
                line2={o.weakestLast ? <>Weakest: <b className="text-gray-700">{o.weakestLast.name}</b> (last attempt {o.weakestLast.pct}%)</> : `${o.attempts} practice attempt${o.attempts === 1 ? "" : "s"}`}
              />
            );
          })}
        </AreaBoxGrid>

        <section className="mt-6">
          <SectionHeader
            title={<>Tests <span className="text-xs font-normal text-gray-500">· section scores</span></>}
            action={<Link href={historyHref({ student: studentId, type: "tests" })} className="text-sm text-blue-600 hover:underline">Attempts &amp; scores ›</Link>}
          />
          {testItems.length === 0 ? (
            <Card padding="md" className="text-sm text-gray-400">No tests assigned.</Card>
          ) : (
            <TestCardsByNumber items={testItems} links={teacherTestLinks} layout="compact" />
          )}
        </section>

        <section className="mt-6">
          <SectionHeader title="Recent activity" action={<Link href={historyHref({ student: studentId })} className="text-sm text-blue-600 hover:underline">History ›</Link>} />
          <ActivityList items={activity} studentId={studentId} />
        </section>
      </PageShell>
    );
  }

  // ---------------------------------------------------------------- Full Practice Tests
  if (!practiceArea) {
    const report = await loadMockReport(studentId, reportFilters);
    const tests = await loadStudentTests(studentId);
    const testIdByAssignment = new Map(tests.map((t) => [t.assignmentId, t.testId]));
    // One row per Test (its last counted try), opening to every try (in progress, submitted, not counted).
    const finished = new Set(report.examHistory.map((exam) => exam.id));
    const testGroups = groupTests(tests, (a) => a.status === "IN_PROGRESS" || finished.has(a.id));
    const attemptCount = testGroups.reduce((sum, g) => sum + g.tries.length, 0);

    return (
      <PageShell>
        {header}
        <KpiStrip
          items={[
            { label: "Tests completed", value: String(report.kpis.exams), hint: "Tests finished.", href: "#exam-history" },
            { label: "Latest total score", value: String(report.kpis.latestTotal ?? "—"), className: "text-[var(--sat-tests-ink)]", hint: "Total score (out of 1600) on the most recent test.", href: "#exam-history" },
            { label: "Latest Reading & Writing", value: String(report.kpis.latestRw ?? "—"), hint: "Reading & Writing score (out of 800) on the most recent test.", href: "#exam-history" },
            { label: "Latest Math", value: String(report.kpis.latestMath ?? "—"), hint: "Math score (out of 800) on the most recent test.", href: "#exam-history" },
            { label: "Tests to do", value: String(report.kpis.pending), hint: "Assigned but not finished yet.", href: "#active-tests" },
          ]}
        />
        {/* One "TEST N" accordion per test number, each source's version with its TestCard; then every try below. */}
        {tests.length > 0 ? (
          <div className="mb-6">
            <TestCardsByNumber items={[...sortTests(tests).pending, ...sortTests(tests).done]} links={teacherTestLinks} />
          </div>
        ) : null}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* One section per Test and attempt; no chart across different Tests (product rule). */}
          <div id="performance" className="min-w-0 space-y-6 lg:col-span-2">
            <section id="exam-history" className="scroll-mt-6">
              <SectionHeader
                title="Test attempts"
                description={`${testGroups.length} test${testGroups.length === 1 ? "" : "s"} · ${attemptCount} attempt${attemptCount === 1 ? "" : "s"} · each row shows the last try; open it to see every try. "Not counted" tries don't count toward scores`}
                action={
                  <Link href={assignHref({ studentId, area: "tests" })} className="text-xs font-medium text-blue-600 hover:underline">
                    Assign test
                  </Link>
                }
              />
              {testGroups.length === 0 ? (
                <EmptyState title="No test attempts yet." />
              ) : (
                <>
                  {/* Results: every Test of the student, no pages (a few Tests, each opening to its tries). */}
                  <TestAttemptsAccordion tests={testGroups} hrefFor={(id) => buildProgressHref(`/teacher/students/${studentId}/tests/${id}`, filters)} />
                </>
              )}
            </section>
          </div>
          <aside className="min-w-0 space-y-6">
            <SidePanel
              id="active-tests"
              title="Active tests"
              count={report.activeExams.length}
              empty="No active tests."
              footer={<SeeAllPending total={report.activeExams.length} href={pendingHref("/teacher/pending", { student: studentId, type: "tests" })} />}
            >
              {report.activeExams.slice(0, PENDING_PREVIEW).map((a) => {
                // Due-date edit of this test in Assign test (activeExams ids are assignment ids).
                const testId = testIdByAssignment.get(a.id);
                return (
                <li key={a.id} className="flex items-start justify-between gap-3 px-3 py-2">
                  <div className="min-w-0">
                    {a.openAttemptId ? (
                      <Link href={`/teacher/students/${studentId}/tests/${a.openAttemptId}`} className="block truncate text-sm font-medium text-gray-800 hover:underline">
                        {a.name}
                      </Link>
                    ) : testId ? (
                      <Link href={`/teacher/tests/${testId}`} className="block truncate text-sm font-medium text-gray-800 hover:underline">
                        {a.name}
                      </Link>
                    ) : (
                      <p className="truncate text-sm font-medium text-gray-800">{a.name}</p>
                    )}
                    <div className="mt-0.5 flex items-center gap-2">
                      <StatusBadge status={a.status} />
                      {a.dueDate && <span className="text-[11px] text-gray-400">Due {formatDate(a.dueDate)}</span>}
                      {a.openAttemptStartedAt && <span className="text-[11px] text-gray-400">Started {formatDate(a.openAttemptStartedAt)}</span>}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    {/* Already assigned: no "assign again"; only the due date while it is still open. */}
                    {testId && a.status !== "OVERDUE" ? (
                      <Hint label="Change the due date of this test.">
                        <Link
                          href={assignHref({ studentId, test: testId })}
                          className="shrink-0 text-xs font-medium text-blue-600 hover:underline"
                        >
                          Due date
                        </Link>
                      </Hint>
                    ) : null}
                  </div>
                </li>
                );
              })}
            </SidePanel>
          </aside>
        </div>

      </PageShell>
    );
  }

  // ---------------------------------------------------------------- Practice (Math / Reading / Writing)
  // Results by skill have no filters (product decision): the whole area, every source.
  const report = await loadPracticeReport(studentId, practiceArea, {});
  // Pending unlock requests of these sets (moved here from the former Home area tabs).
  const unlockRequests = (await getFeatureSetting("STUDENT_UNLOCK_REQUESTS"))
    ? await prisma.unlockRequest.findMany({
        where: { status: "PENDING", assignmentId: { in: report.assignments.map((a) => a.id) } },
        select: { id: true, assignmentId: true },
      })
    : [];
  const unlockByAssignment = new Map(unlockRequests.map((request) => [request.assignmentId, request.id]));
  const { areaLabel } = report;
  // One row per practice set (its last attempt), opening to its latest tries; every try is in History.
  const practiceSets = practiceSetGroups(setsFromReportAttempts(report.attemptHistory));

  return (
    <PageShell>
      {header}
      {report.completedExamCount > 0 || report.pendingExamCount > 0 ? (
        <div className="mt-3 rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700">
          Test results are kept apart from practice
          {report.completedExamCount > 0 ? ` (${first} finished ${report.completedExamCount} test${report.completedExamCount === 1 ? "" : "s"})` : ""}
          {report.pendingExamCount > 0 ? ` · ${report.pendingExamCount} test${report.pendingExamCount === 1 ? "" : "s"} assigned` : ""}.{" "}
          <Link href={buildProgressHref(`/teacher/students/${studentId}`, filters, { area: "tests" })} className="font-medium underline">
            See test results →
          </Link>
        </div>
      ) : null}

      <div className="mt-4 grid gap-6 lg:grid-cols-3">
        <div id="performance" className="min-w-0 space-y-6 lg:col-span-2">
          <SkillResults report={report} attemptHref={(id) => buildProgressHref(`/teacher/students/${studentId}/attempts/${id}`, filters)} />
        </div>

        <aside className="min-w-0 space-y-6">
          <SidePanel
            id="active-sets"
            title="Active practice sets"
            count={report.assignments.length}
            empty={`No active ${areaLabel} practice sets.`}
            footer={<SeeAllPending total={report.assignments.length} href={pendingHref("/teacher/pending", { student: studentId, type: "practice", area: assignPracticeArea })} />}
          >
            {report.assignments.slice(0, PENDING_PREVIEW).map((a) => (
              <li key={a.id} className="flex items-start justify-between gap-3 px-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-gray-800" title={a.name}>{shortSetName(a.name)}</p>
                  <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                    <StatusBadge status={a.status} />
                    {a.locked && <Badge variant="danger">Locked</Badge>}
                    {unlockByAssignment.has(a.id) ? <Badge variant="info">Unlock requested</Badge> : null}
                    {a.dueDate && <span className="text-[11px] text-gray-400">Due {formatDate(a.dueDate)}</span>}
                  </div>
                </div>
                {unlockByAssignment.has(a.id) ? <UnlockRequestActions requestId={unlockByAssignment.get(a.id)!} /> : null}
                {/* Already assigned: no "assign again" (the student can retry any time); only its dates/settings. */}
                {a.status !== "OVERDUE" ? (
                  <Hint label="Change the due date, open date or when answers are shown. The student's progress is kept.">
                    <Link
                      href={assignHref({ studentId, area: assignPracticeArea, edit: [a.practiceSetId] })}
                      className="shrink-0 text-xs font-medium text-blue-600 hover:underline"
                    >
                      Edit
                    </Link>
                  </Hint>
                ) : null}
              </li>
            ))}
          </SidePanel>

          {report.comments.length > 0 && (
            <SidePanel title="Teacher Comments" count={report.comments.length} empty="">
              {report.comments.map((entry) => (
                <li key={entry.id}>
                  {/* Each comment opens the attempt it was written on. */}
                  <Link href={`/teacher/students/${studentId}/attempts/${entry.id}`} className="block px-3 py-2 hover:bg-[var(--sat-primary-soft)]">
                    <p className="text-[11px] text-gray-400" title={entry.name}>{shortSetName(entry.name)} · {entry.submittedAt ? formatDate(entry.submittedAt) : "-"}</p>
                    <p className="text-sm text-gray-800">{entry.teacherComment}</p>
                  </Link>
                </li>
              ))}
            </SidePanel>
          )}
        </aside>
      </div>

      <section id="recent-attempts" className="mt-6 scroll-mt-6">
        <SectionHeader
          title={`${areaLabel} practice attempts`}
          description={`${practiceSets.length} practice set${practiceSets.length === 1 ? "" : "s"} · Last Attempt is the most recent try · open a set to see its last 3 tries`}
          action={
            <Link href={assignPracticeHref} className="text-xs font-medium text-blue-600 hover:underline">
              Assign practice
            </Link>
          }
        />
        {practiceSets.length === 0 ? (
          <EmptyState title={`No finished ${areaLabel} work yet.`} />
        ) : (
          <>
            <PracticeSetAttemptsAccordion
              // Results: every practice set of the area, no pages (each opens to its last tries).
              sets={practiceSets}
              hrefFor={(id) => buildProgressHref(`/teacher/students/${studentId}/attempts/${id}`, filters)}
              // "See all N tries": History of this student filtered to that set (skill, level, set).
              historyHref={(set) => historyHref({ student: studentId, area: area === "math" || area === "reading" || area === "writing" ? area : undefined, skill: set.skillId ?? undefined, difficulty: set.difficulty ?? undefined, set: set.practiceSetId ?? undefined })}
            />

          </>
        )}
      </section>
    </PageShell>
  );
}

/** KPI row (mockup stat cards); each label has a short "what is this" hint. */
/** KPI tiles; a tile with `href` jumps to the block that lists its items (its hint becomes the tooltip). */
function KpiStrip({ items }: { items: Array<{ label: string; value: string; className?: string; sub?: string; hint?: string; href?: string }> }) {
  return (
    <StatGrid cols={5} className="my-4">
      {items.map((item) => (
        <StatTile
          key={item.label}
          href={item.href}
          title={item.href ? item.hint : undefined}
          label={
            <span className="flex items-center gap-1">
              {item.label}
              {item.hint && !item.href ? <InfoHint label={item.hint} /> : null}
            </span>
          }
          value={<span className={item.className}>{item.value}</span>}
          sub={item.sub}
        />
      ))}
    </StatGrid>
  );
}

/** Under a pending panel showing the first PENDING_PREVIEW items: the shortcut to the whole list. */
function SeeAllPending({ total, href }: { total: number; href: string }) {
  if (total <= PENDING_PREVIEW) return null;
  return (
    <Link href={href} className="block px-3 py-2 text-xs font-medium text-blue-600 hover:underline">
      See all {total} pending →
    </Link>
  );
}

function SidePanel({ id, title, count, empty, children, footer }: { id?: string; title: string; count: number; empty: string; children: ReactNode; footer?: ReactNode }) {
  return (
    <section id={id}>
      <h2 className="mb-2 flex items-center justify-between text-sm font-semibold text-gray-900">
        {title}
        <span className="text-xs font-normal text-gray-400">{count}</span>
      </h2>
      <Card className="overflow-hidden">
        {count === 0 ? <p className="px-3 py-4 text-sm text-gray-400">{empty}</p> : <ul className="divide-y divide-gray-100">{children}</ul>}
        {count > PENDING_PREVIEW && footer ? <div className="border-t border-gray-100">{footer}</div> : null}
      </Card>
    </section>
  );
}

function StatusBadge({ status }: { status: string }) {
  const variant = status === "IN_PROGRESS" ? "warning" : status === "OVERDUE" ? "danger" : "info";
  const help: Record<string, string> = {
    PENDING: "Assigned, not started yet.",
    IN_PROGRESS: "The student started it but hasn't finished.",
    OVERDUE: "The due date passed before the student finished it.",
  };
  return (
    <span title={help[status]}>
      <Badge variant={variant}>{assignmentStatusLabel(status)}</Badge>
    </span>
  );
}

type ActivityItem = {
  id: string;
  kind: "Practice" | "Test";
  area: string;
  /** Practice area, shown as a coloured area tag (Tests already carry the grey Test badge). */
  areaCode: PracticeAreaCode | null;
  title: string;
  at: Date;
  status: string;
  pct: number | null;
  href: string;
};

/** Practice attempts and Test attempts, newest first (flat list for the Activity tab). */
async function loadActivity(studentId: string, take: number): Promise<ActivityItem[]> {
  const [practice, tests] = await Promise.all([
    prisma.attempt.findMany({
      where: { studentId, status: { in: ["SUBMITTED", "INVALIDATED", "IN_PROGRESS"] } },
      orderBy: { startedAt: "desc" },
      take,
      select: {
        id: true,
        status: true,
        startedAt: true,
        submittedAt: true,
        answers: { select: { isCorrect: true } },
        assignment: { select: { practiceSet: { select: { name: true, topic: { select: { domain: { select: { name: true, practiceArea: true } } } } } } } },
      },
    }),
    prisma.fullPracticeTestAttempt.findMany({
      where: { studentId },
      orderBy: { startedAt: "desc" },
      take,
      select: { id: true, status: true, startedAt: true, submittedAt: true, totalScore: true, test: { select: { name: true } } },
    }),
  ]);
  const items: ActivityItem[] = [
    ...practice.map((a) => {
      const set = a.assignment?.practiceSet;
      const correct = a.answers.filter((x) => x.isCorrect).length;
      return {
        id: a.id,
        kind: "Practice" as const,
        area: set?.topic.domain.practiceArea ? practiceAreaLabel(set.topic.domain.practiceArea) : "Practice",
        areaCode: resolvePracticeArea({ practiceArea: set?.topic.domain.practiceArea }),
        title: set ? shortSetName(set.name) : "Practice set",
        at: a.submittedAt ?? a.startedAt,
        status: a.status,
        pct: a.status === "IN_PROGRESS" || !a.answers.length ? null : Math.round((correct / a.answers.length) * 100),
        href: `/teacher/students/${studentId}/attempts/${a.id}`,
      };
    }),
    ...tests.map((a) => ({
      id: a.id,
      kind: "Test" as const,
      area: "R&W + Math",
      areaCode: null,
      title: a.test.name,
      at: a.submittedAt ?? a.startedAt,
      status: a.status,
      pct: null,
      href: `/teacher/students/${studentId}/tests/${a.id}`,
    })),
  ];
  return items.sort((a, b) => b.at.getTime() - a.at.getTime()).slice(0, take);
}

/** Practice and Test activity, newest first; `grouped` adds a heading per day (Activity tab). */
function ActivityList({ items, studentId, grouped = false }: { items: ActivityItem[]; studentId: string; grouped?: boolean }) {
  void studentId;
  if (items.length === 0) return <Card padding="md" className="text-sm text-gray-400">This student has no activity yet.</Card>;
  const dayOf = (d: Date) => d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  const days = grouped ? [...new Set(items.map((i) => dayOf(i.at)))] : [""];
  return (
    <div className="space-y-3">
      {days.map((day) => (
        <div key={day || "all"}>
          {grouped ? <p className="mb-1 mt-2 text-sm font-semibold text-gray-500">{day}</p> : null}
          <Card className="overflow-hidden">
            <ul className="divide-y divide-gray-100">
              {items
                .filter((item) => !grouped || dayOf(item.at) === day)
                .map((item) => (
                  <li key={`${item.kind}-${item.id}`}>
                    <Link href={item.href} className={`flex items-center justify-between gap-3 px-3 py-2 hover:bg-gray-50 ${invalidatedRowClass(item.status) ?? ""}`}>
                      <span className="min-w-0">
                        <span className="flex flex-wrap items-center gap-1.5">
                          <Badge variant={item.kind === "Test" ? "test" : "default"}>{item.kind}</Badge>
                          {item.areaCode ? <AreaTag area={item.areaCode} /> : null}
                          <span className="truncate text-sm font-medium text-gray-800">{item.title}</span>
                          {item.status === "IN_PROGRESS" ? <Badge variant="warning">In progress</Badge> : null}
                          {isInvalidated(item.status) ? <AttemptStatusBadge status={item.status} /> : null}
                        </span>
                        <span className="block text-xs text-gray-400">{grouped ? formatClock(item.at) : `${formatDate(item.at)} · ${relativeDay(item.at)}`}</span>
                      </span>
                      {item.kind === "Practice" ? <Pct value={item.pct} className="shrink-0 text-sm font-semibold" /> : <span className="shrink-0 text-xs text-blue-600">Review</span>}
                    </Link>
                  </li>
                ))}
            </ul>
          </Card>
        </div>
      ))}
    </div>
  );
}
