import {
  AreaBoxGrid,
  AreaSummaryCard,
  CompactAreaBox,
  AttemptStatusBadge,
  ChevronCell,
  Delta,
  DIFFICULTIES,
  EmptyState,
  LinkTabs,
  LinkTr,
  PageShell,
  Pagination,
  PracticeAreaTabs,
  PracticeAttemptsTable,
  RowLink,
  SectionHeader,
  SimpleTable,
  SkillDifficultyMatrix,
  StatGrid,
  StatTile,
  TD,
  TestMiniCard,
  TestSectionScore,
  TestTotalCell,
  VoidableValue,
  invalidatedRowClass,
  isInvalidated,
  pageFromParam,
  paginate,
} from "@/components/sat";
import { SectionHead } from "@/components/sat/test-ui";
import { AreaTag } from "@/components/sat/practice-set-row";
import { LineChart } from "@/components/sat/line-chart";
import { loadAttemptHistory } from "@/lib/attempt-history";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";
import type { ReactNode } from "react";
import { formatClock, formatDate, formatDuration, formatTime } from "@/lib/utils";
import { assignmentStatusLabel, difficultyBadgeVariant, difficultyLabel } from "@/lib/domain-meta";
import { scoreBandTextClass } from "@/lib/score-band";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ProgressFilters } from "@/components/progress-filters";
import { PerformanceBreakdown } from "@/components/performance-breakdown";
import { TopicDifficultyTrend } from "@/components/topic-difficulty-trend";
import { MockSectionChart } from "@/components/progress-charts";
import { Hint, InfoHint } from "@/components/hint";
import { ClipboardList, Eye, History, Pencil, Plus } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { StudentDetailActions } from "./actions-client";
import { StudentSwitcher } from "./student-switcher";
import { GenerateReportDialog } from "./generate-report-dialog";
import { RestartExamButton } from "./restart-exam-button";
import { ParentAuthorization, type ParentAuthorizationView } from "./parent-authorization";
import { parentAuthorizationState } from "@/lib/parent-authorization";
import { refreshAssignmentStates } from "@/lib/assignments";
import { getFeatureSetting } from "@/lib/app-settings";
import { studentAccessWhereFor } from "@/lib/program-scope";
import { loadMockReport, loadPracticeReport, moduleTableOf, shortSetName } from "@/lib/student-report";
import { activeAreaTab, activeHomeTab, practiceAreaFromTab, practiceAreaLabel, resolvePracticeArea, type HomeTabKey, type PracticeAreaCode } from "@/lib/practice-area";
import { Breadcrumbs } from "@/components/sat/breadcrumbs";
import { Pct } from "@/components/sat/work-status";
import { loadStudentTests, sortTests } from "@/lib/test-assignments";
import { loadStudentOverviews } from "@/lib/teacher-overview";
import { relativeDay } from "@/lib/utils";
import { buildProgressHref, progressFilterEntries, progressFiltersFromParams } from "@/lib/progress-filters";
import { applyTimeFilterSetting } from "@/lib/time-filters";
import { officialSkillsFor } from "@/lib/taxonomy-order";

// One page per student (replaces the former Student Analytics and Individual Report views).
// Everything is on a single screen: KPI strip on top; performance + weak skills (with one-click
// "Assign practice") in the main column; active assignments, recent attempts and teacher
// comments in the side column. "Generate Report" builds the same report as a PDF (server-side).
// Data comes from lib/student-report.ts, shared with the PDF so both show the same numbers.
// Taxonomy note: the `topic` param / Topic table is the SKILL level (Section → Domain → Skill).

interface PageProps {
  params: Promise<{ studentId: string }>;
  searchParams: Promise<{ area?: string; topic?: string; difficulty?: string; from?: string; to?: string; attemptsPage?: string; examsPage?: string; activityPage?: string; type?: string }>;
}

const HISTORY_PAGE_SIZE = 10;
const ACTIVITY_PAGE_SIZE = 20;

export default async function StudentPage({ params, searchParams }: PageProps) {
  const { studentId } = await params;
  const query = await searchParams;
  const { filters, showEndDate } = await applyTimeFilterSetting(progressFiltersFromParams(query));
  const area = activeAreaTab(filters.area, filters.area);
  // Tabs: Summary · Math · Reading · Writing · Tests · Activity (no `area` param = Summary).
  const view: HomeTabKey | "activity" | "history" =
    query.area === "activity" ? "activity" : query.area === "history" ? "history" : activeHomeTab(query.area);
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
  const [parentLinks, submittedExams, parentAuth] = await Promise.all([
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
    parentAuthorizationState(student),
  ]);
  const parentAuthView: ParentAuthorizationView =
    parentAuth.status === "authorized"
      ? {
          status: "authorized",
          label: `Parent: ${parentAuth.parentName} (${parentAuth.parentEmail}) · Authorized${parentAuth.at ? ` ${formatDate(parentAuth.at)}` : ""}`,
        }
      : parentAuth.status === "waiting"
        ? {
            status: "waiting",
            parentEmail: parentAuth.parentEmail,
            label: `Waiting for parent: we emailed ${parentAuth.parentEmail} (link valid until ${formatDate(parentAuth.linkExpiresAt)}).`,
          }
        : { status: "none" };
  const reportParents = parentLinks.map((link) => link.parent);
  const reportExams = submittedExams.map((exam) => ({
    id: exam.id,
    label: `${exam.test.name} · ${exam.submittedAt ? formatDate(exam.submittedAt) : "—"} · ${exam.totalScore ?? "—"}`,
  }));
  const pageParams: Record<string, string | undefined> = { ...Object.fromEntries(progressFilterEntries(filters)), attemptsPage: query.attemptsPage, examsPage: query.examsPage };

  const reportFilters = { topic: filters.topic, difficulty: filters.difficulty, from: filters.from, to: filters.to };
  const filterSummary = [
    topicId ? `Skill: ${skills.find((skill) => skill.id === topicId)?.name ?? topicId}` : null,
    difficulty ? `Difficulty: ${difficultyLabel(difficulty)}` : null,
    filters.from ? `From ${filters.from}` : null,
    filters.to ? `To ${filters.to}` : null,
  ].filter(Boolean).join(" · ");
  const switcherQuery = buildProgressHref("", filters).replace(/^\?/, "");
  const secondaryButton =
    "inline-flex h-8 items-center justify-center gap-1.5 rounded-md border border-gray-300 bg-white px-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50";

  const header = (
    <>
      <Breadcrumbs items={[{ label: "Home", href: "/teacher" }, { label: "Students", href: "/teacher/students" }, { label: student.name }]} />
      <div className="mb-3 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <Avatar name={student.name} avatarUrl={student.avatarUrl} size="xl" />
          <div className="min-w-0">
            <h1 className="text-[26px] font-bold tracking-[-0.3px] text-gray-900">{student.name}</h1>
            <p className="mt-0.5 truncate text-xs text-gray-500">
              {student.email} · {student.phone ?? "—"}
              {student.startDate && <> · Student since {formatDate(student.startDate)}</>}
              {teacherGroupManagementEnabled && <> · Groups: {student.groups.map((g) => g.group.name).join(", ") || "—"}</>}
              {" · "}Programs: {student.programEnrollments.map((e) => e.program.name).join(", ") || "—"}
            </p>
            <p className="text-xs text-gray-500">
              Last active: {student.lastActiveAt ? `${formatDate(student.lastActiveAt)} (${relativeDay(student.lastActiveAt)})` : "never"}
            </p>
            <ParentAuthorization studentId={studentId} studentName={student.name} state={parentAuthView} />
          </div>
        </div>
        <div className="flex flex-col items-start gap-2 lg:items-end">
          <div className="flex flex-wrap items-center gap-2">
            <Link href="/teacher" className={secondaryButton}>Back to Home</Link>
            <Hint label="See the app the way this student sees it (view only).">
              <Link href={buildProgressHref(`/teacher/impersonate/${studentId}`, filters)} className={secondaryButton}>
                <Eye size={14} /> Student view
              </Link>
            </Hint>
            <Link href={`/teacher/students/${studentId}?area=history`} className={secondaryButton}>
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
          </div>
          <StudentSwitcher students={roster} selectedStudentId={studentId} query={switcherQuery} />
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Hint label="Give this student one or more practice sets.">
          <Link href={buildProgressHref(`/teacher/students/${studentId}/assign`, filters)} className="inline-flex h-9 items-center justify-center gap-1 shrink-0 whitespace-nowrap rounded-lg bg-[var(--sat-primary)] px-3.5 text-sm font-semibold text-white hover:bg-[var(--sat-primary-dark)]">
            <Plus size={14} /> Assign practice
          </Link>
        </Hint>
        <Hint label="Give this student a full-length Test (4 modules).">
          <Link href={buildProgressHref(`/teacher/students/${studentId}/assign-test`, filters)} className="inline-flex h-9 items-center justify-center gap-1 rounded-md bg-[var(--sat-area-tests)] px-3.5 text-sm font-medium text-[var(--sat-tests-ink)] hover:brightness-95">
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
        active={view as HomeTabKey}
        includeSummary
        extraTabs={[
          { key: "history", label: "History · attempts & scores" },
          { key: "activity", label: "Activity" },
        ]}
        preserve={{ difficulty: filters.difficulty, from: filters.from, to: filters.to }}
        className="mb-3"
      />
      {view !== "summary" && view !== "activity" && view !== "history" ? (
        <ProgressFilters
          action={`/teacher/students/${studentId}`}
          filters={filters}
          topics={skills.map((skill) => ({ id: skill.id, name: skill.name, group: skill.domain }))}
          showEndDate={showEndDate}
        />
      ) : null}
    </>
  );
  const first = student.name.split(" ")[0];

  // ---------------------------------------------------------------- Summary (mockup mejorada/teacher/student.html)
  if (view === "summary") {
    const [overview, tests, pendingSets] = await Promise.all([
      loadStudentOverviews([studentId], now).then((m) => m.get(studentId)!),
      loadStudentTests(studentId),
      prisma.assignment.findMany({
        where: { studentId, status: { in: ["PENDING", "IN_PROGRESS", "OVERDUE"] } },
        select: { id: true, status: true, dueDate: true },
      }),
    ]);
    const activity = await loadActivity(studentId, 4);
    const testItems = tests.filter((t) => t.attempts.length > 0 || t.state !== "done");
    const suggestions = (["MATH", "READING", "WRITING"] as PracticeAreaCode[])
      .map((code) => ({ code, w: overview.areas[code].weakest }))
      .filter((x): x is { code: PracticeAreaCode; w: NonNullable<typeof x.w> } => Boolean(x.w))
      .sort((a, b) => a.w.pct - b.w.pct);
    const { pending: pendingTests } = sortTests(tests);
    const pendingCount = pendingTests.length + pendingSets.length;
    const overdueCount =
      pendingTests.filter((t) => t.overdue).length + pendingSets.filter((a) => a.status === "OVERDUE" || (a.dueDate && a.dueDate < now)).length;
    return (
      <PageShell maxWidth={1180} width="wide">
        {header}
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
                line1={o.last ? `Latest practice · ${relativeDay(o.last.at)}` : "Not practiced yet"}
                delta={o.delta}
                line2={o.weakest ? <>Weakest: <b className="text-gray-700">{o.weakest.name}</b></> : `${o.attempts} practice attempt${o.attempts === 1 ? "" : "s"}`}
              />
            );
          })}
        </AreaBoxGrid>

        <section className="mt-6">
          <SectionHeader
            title={<>Tests <span className="text-xs font-normal text-gray-500">· section scores</span></>}
            action={<Link href={`/teacher/students/${studentId}?area=history&type=tests`} className="text-sm text-blue-600 hover:underline">Attempts &amp; scores ›</Link>}
          />
          {testItems.length === 0 ? (
            <Card padding="md" className="text-sm text-gray-400">No tests assigned.</Card>
          ) : (
            <div className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(160px,1fr))]">
              {testItems.map((t) => <TestMiniCard key={t.assignmentId} item={t} hrefFor={(id) => `/teacher/students/${studentId}/tests/${id}`} />)}
            </div>
          )}
        </section>

        <div className="mt-6 grid items-start gap-4 lg:grid-cols-2">
          <section>
            <SectionHeader title="Recent activity" action={<Link href={`/teacher/students/${studentId}?area=history`} className="text-sm text-blue-600 hover:underline">History ›</Link>} />
            <ActivityList items={activity} studentId={studentId} />
          </section>
          <Card padding="md">
            <div className="flex items-baseline justify-between gap-2">
              <h2 className="text-sm font-semibold text-gray-900">Then, assign something</h2>
              {suggestions.length > 0 ? (
                <Link
                  href={`/teacher/students/${studentId}?area=${suggestions[0].code.toLowerCase()}#weak-skills`}
                  className="whitespace-nowrap text-xs font-medium text-[var(--sat-primary)] hover:underline"
                >
                  View all ›
                </Link>
              ) : null}
            </div>
            <p className="mb-3 mt-0.5 text-sm text-gray-600">
              {pendingCount ? (
                <>
                  <b>{pendingCount}</b> pending{overdueCount ? <> · <b className="text-red-600">{overdueCount} overdue</b></> : null}
                </>
              ) : (
                "Nothing pending"
              )}
            </p>
            {suggestions.length === 0 ? (
              <p className="text-sm text-gray-400">Start with a practice set or a test.</p>
            ) : (
              <ul className="divide-y divide-gray-100 rounded-lg border border-gray-100">
                {suggestions.slice(0, 2).map(({ code, w }) => (
                  <li key={`${w.topicId}-${w.difficulty}`} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                    <span className="min-w-0 truncate">
                      <b className="font-medium text-gray-800">{w.name}</b> <Pct value={w.pct} className="font-semibold" />
                    </span>
                    <Button asChild size="sm" variant="secondary">
                      <Link href={`/teacher/students/${studentId}/assign?area=${code.toLowerCase()}&topic=${w.topicId}&difficulty=${w.difficulty}`}>Assign practice</Link>
                    </Button>
                  </li>
                ))}
              </ul>
            )}
            <Button asChild variant="secondary" className="mt-3 w-full">
              <Link href={`/teacher/students/${studentId}/assign-test`}>Assign a test</Link>
            </Button>
          </Card>
        </div>
      </PageShell>
    );
  }

  // ---------------------------------------------------------------- Activity
  if (view === "activity") {
    // Everything, newest first, 20 per page (mockup student.html activity pager).
    const activity = await loadActivity(studentId, 1000);
    const activityPage = paginate(activity, pageFromParam(query.activityPage), ACTIVITY_PAGE_SIZE);
    return (
      <PageShell maxWidth={1180} width="wide">
        {header}
        <p className="mb-2 text-sm text-gray-500">Every practice set and test, newest first. Click to review.</p>
        <ActivityList items={activityPage.items} studentId={studentId} grouped />
        <Pagination
          basePath={`/teacher/students/${studentId}`}
          params={{ area: "activity" }}
          param="activityPage"
          pageSize={ACTIVITY_PAGE_SIZE}
          {...activityPage}
        />
      </PageShell>
    );
  }

  // ---------------------------------------------------------------- History (every try, grouped by Test / practice set)
  if (view === "history") {
    const type = query.type === "tests" || query.type === "practice" ? query.type : "all";
    const rows = await loadAttemptHistory([studentId], { kind: type === "tests" ? "test" : type === "practice" ? "practice" : undefined });
    const groups = [...new Map(rows.map((r) => [r.groupId, rows.filter((x) => x.groupId === r.groupId)])).values()].map((g) =>
      [...g].sort((a, b) => a.tryNumber - b.tryNumber),
    );
    const typeHref = (t: string) => `/teacher/students/${studentId}?area=history${t === "all" ? "" : `&type=${t}`}`;
    return (
      <PageShell maxWidth={1180} width="wide">
        {header}
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-gray-500">Every try {first} made, grouped by Test and practice set. Changes compare with the previous counted try.</p>
          <LinkTabs
            className="mb-0 border-b-0"
            label="Show"
            active={type}
            tabs={[
              { key: "all", label: "All", href: typeHref("all") },
              { key: "tests", label: "Tests", href: typeHref("tests") },
              { key: "practice", label: "Practice", href: typeHref("practice") },
            ]}
          />
        </div>
        {groups.length === 0 ? (
          <EmptyState title="No attempts yet" description={`${first}'s practice sets and Tests will appear here.`} />
        ) : (
          <div className="space-y-4">
            {groups.map((tries) => {
              const head = tries[0];
              const isTest = head.kind === "test";
              const counted = tries.filter((t) => t.status === "SUBMITTED");
              const bestRw = isTest ? counted.reduce<number | null>((m, t) => (t.rw !== null && (m === null || t.rw > m) ? t.rw : m), null) : null;
              const bestMath = isTest ? counted.reduce<number | null>((m, t) => (t.math !== null && (m === null || t.math > m) ? t.math : m), null) : null;
              const bestPct = !isTest ? counted.reduce<number | null>((m, t) => (t.pct !== null && (m === null || t.pct > m) ? t.pct : m), null) : null;
              const hrefFor = (id: string) => buildProgressHref(`/teacher/students/${studentId}/${isTest ? "tests" : "attempts"}/${id}`, filters);
              return (
                <Card key={head.groupId} padding="md">
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      {isTest ? <Badge variant="test">Test</Badge> : <Badge>Practice</Badge>}
                      {head.area ? <AreaTag area={head.area} /> : null}
                      <h3 className="text-sm font-semibold text-gray-900">{head.title}</h3>
                      {head.difficulty ? <Badge variant={difficultyBadgeVariant(head.difficulty)}>{difficultyLabel(head.difficulty)}</Badge> : null}
                    </div>
                    <p className="text-xs text-gray-500">
                      {tries.length} {tries.length === 1 ? "try" : "tries"}
                      {isTest ? <> · Best R&amp;W <b>{bestRw ?? "—"}</b> · Best Math <b>{bestMath ?? "—"}</b></> : <> · Best <Pct value={bestPct} className="font-semibold" /></>}
                    </p>
                  </div>
                  {isTest ? (
                    <SimpleTable head={["Try", "Date", "Status", <SectionHead key="rw" section="RW" short />, "Change", <SectionHead key="m" section="MATH" />, "Change", ""]}>
                      {tries.map((t) => (
                        <LinkTr key={t.id} className={invalidatedRowClass(t.status)}>
                          <td className={TD}><RowLink href={hrefFor(t.id)}>Try {t.tryNumber}</RowLink></td>
                          <td className={`${TD} text-gray-600`}>{formatDate(t.at)}<span className="block text-xs text-gray-400">{relativeDay(t.at)}</span></td>
                          <td className={TD}>
                            {t.status === "IN_PROGRESS" ? <Badge variant="warning">{t.modulesDone ?? 0} of 4 modules</Badge> : <AttemptStatusBadge status={t.status} />}
                          </td>
                          <td className={`${TD} font-semibold tabular-nums`}><VoidableValue status={t.status}>{t.rw ?? "—"}</VoidableValue></td>
                          <td className={TD}><Delta value={t.changeRw} unit="" /></td>
                          <td className={`${TD} font-semibold tabular-nums`}><VoidableValue status={t.status}>{t.math ?? "—"}</VoidableValue></td>
                          <td className={TD}><Delta value={t.changeMath} unit="" /></td>
                          <ChevronCell />
                        </LinkTr>
                      ))}
                    </SimpleTable>
                  ) : (
                    <SimpleTable head={["Try", "Date", "Score", "Correct", "Change", "Time", ""]}>
                      {tries.map((t) => (
                        <LinkTr key={t.id} className={invalidatedRowClass(t.status)}>
                          <td className={TD}>
                            <RowLink href={hrefFor(t.id)}>Try {t.tryNumber}</RowLink>
                            {t.status !== "SUBMITTED" ? <span className="ml-2"><AttemptStatusBadge status={t.status} /></span> : null}
                          </td>
                          <td className={`${TD} text-gray-600`}>{formatDate(t.at)}<span className="block text-xs text-gray-400">{relativeDay(t.at)}</span></td>
                          <td className={TD}><VoidableValue status={t.status}><Pct value={t.pct} className="font-semibold" /></VoidableValue></td>
                          <td className={TD}>
                            {t.correct !== null ? (
                              <>
                                {t.correct} of {t.total}
                                <span className="block text-xs text-gray-500">{t.wrong} wrong · {t.blank} blank</span>
                              </>
                            ) : "—"}
                          </td>
                          <td className={TD}><Delta value={t.change} unit="pts" /></td>
                          <td className={`${TD} text-gray-600`}>{t.time ? formatDuration(t.time) : "—"}</td>
                          <ChevronCell />
                        </LinkTr>
                      ))}
                    </SimpleTable>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </PageShell>
    );
  }

  // ---------------------------------------------------------------- Full Practice Tests
  if (!practiceArea) {
    const report = await loadMockReport(studentId, reportFilters);
    const moduleTable = moduleTableOf(report.sectionModuleMetrics);
    const tests = await loadStudentTests(studentId);
    const testIdByAssignment = new Map(tests.map((t) => [t.assignmentId, t.testId]));
    // Every try (in progress, submitted, not counted), newest first; the date filter applies to finished tries.
    const inDates = new Set(report.examHistory.map((exam) => exam.id));
    const dated = Boolean(filters.from || filters.to);
    const testAttemptRows = tests
      .flatMap((t) => t.attempts.map((a) => ({ t, a })))
      .filter(({ a }) => (a.status === "IN_PROGRESS" ? !dated : inDates.has(a.id)))
      .sort((x, y) => (y.a.submittedAt ?? y.a.startedAt).getTime() - (x.a.submittedAt ?? x.a.startedAt).getTime());
    const examPage = paginate(testAttemptRows, pageFromParam(query.examsPage), HISTORY_PAGE_SIZE);
    return (
      <PageShell maxWidth={1180} width="wide">
        {header}
        <KpiStrip
          items={[
            { label: "Tests completed", value: String(report.kpis.exams), hint: "Finished in the selected dates.", href: "#exam-history" },
            { label: "Latest total score", value: String(report.kpis.latestTotal ?? "—"), className: "text-[var(--sat-tests-ink)]", hint: "Total score (out of 1600) on the most recent test.", href: "#exam-history" },
            { label: "Latest Reading & Writing", value: String(report.kpis.latestRw ?? "—"), hint: "Reading & Writing score (out of 800) on the most recent test.", href: "#exam-history" },
            { label: "Latest Math", value: String(report.kpis.latestMath ?? "—"), hint: "Math score (out of 800) on the most recent test.", href: "#exam-history" },
            { label: "Tests to do", value: String(report.kpis.pending), hint: "Assigned but not finished yet.", href: "#active-tests" },
          ]}
        />
        {tests.length > 0 ? (
          <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {tests.map((t) => <TestMiniCard key={t.assignmentId} item={t} hrefFor={(id) => `/teacher/students/${studentId}/tests/${id}`} />)}
          </div>
        ) : null}
        <div className="grid gap-6 lg:grid-cols-3">
          <div id="performance" className="min-w-0 space-y-6 lg:col-span-2">
            {report.exams.length === 0 ? (
              <Card padding="lg" className="py-12 text-center text-sm text-gray-400">This student hasn&apos;t finished a test yet.</Card>
            ) : (
              <>
                {report.scoreSeries.filter((m) => m.rwScore !== null || m.mathScore !== null).length >= 2 ? (
                  <Card padding="md">
                    <SectionHeader size="sm" title="Section scores by test" description="Reading & Writing (solid) and Math (dashed), 200–800" />
                    <LineChart
                      title="Section scores by test"
                      min={200}
                      max={800}
                      labels={report.scoreSeries.map((m) => m.label)}
                      series={[
                        { name: "Reading & Writing", color: "var(--sat-area-reading)", values: report.scoreSeries.map((m) => m.rwScore) },
                        { name: "Math", color: "var(--sat-area-math)", values: report.scoreSeries.map((m) => m.mathScore), dashed: true },
                      ]}
                    />
                  </Card>
                ) : (
                  <MockSectionChart metrics={report.scoreSeries} />
                )}
                <PerformanceBreakdown
                  title="Performance by section and module"
                  rowLabel="Section"
                  dimensionLabel="module"
                  dimensions={moduleTable.columns}
                  detailMetrics={moduleTable.detail}
                />
              </>
            )}
          </div>
          <aside className="min-w-0 space-y-6">
            <SidePanel id="active-tests" title="Active tests" count={report.activeExams.length} empty="No active tests.">
              {report.activeExams.map((a) => {
                // Pre-select this test in Assign test (activeExams ids are assignment ids).
                const testId = testIdByAssignment.get(a.id);
                const assignHref = buildProgressHref(`/teacher/students/${studentId}/assign-test`, filters);
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
                    {a.openAttemptId ? (
                      <Hint label="Start the test over. The current progress won't count.">
                        <RestartExamButton attemptId={a.openAttemptId} examName={a.name} />
                      </Hint>
                    ) : null}
                    <Hint label={a.status === "OVERDUE" ? "Give it to the student again with a new due date." : "Change the due date of this test."}>
                      <Link
                        href={testId ? `${assignHref}${assignHref.includes("?") ? "&" : "?"}test=${testId}` : assignHref}
                        className="shrink-0 text-xs font-medium text-blue-600 hover:underline"
                      >
                        {a.status === "OVERDUE" ? "Reassign" : "Due date"}
                      </Link>
                    </Hint>
                  </div>
                </li>
                );
              })}
            </SidePanel>
          </aside>
        </div>

        <section id="exam-history" className="mt-6 scroll-mt-6">
          <SectionHeader
            title="Test attempts"
            description={`${testAttemptRows.length} attempt${testAttemptRows.length === 1 ? "" : "s"} · every try is kept; "Not counted" tries don't count toward scores`}
            action={
              <Link href={buildProgressHref(`/teacher/students/${studentId}/assign-test`, filters)} className="text-xs font-medium text-blue-600 hover:underline">
                Assign test
              </Link>
            }
          />
          {testAttemptRows.length === 0 ? (
            <EmptyState title="No test attempts yet." />
          ) : (
            <>
              <SimpleTable head={["Date", "Test", "Attempt", <SectionHead key="rw" section="RW" short />, <SectionHead key="m" section="MATH" />, "Total", ""]}>
                {examPage.items.map(({ t, a }) => (
                  <LinkTr key={a.id} className={invalidatedRowClass(a.status)}>
                    <td className={`${TD} text-gray-600`}>
                      {formatDate(a.submittedAt ?? a.startedAt)}
                      <span className="block text-xs text-gray-400">{a.submittedAt ? "Completed" : "Started"} {relativeDay(a.submittedAt ?? a.startedAt)}</span>
                    </td>
                    <td className={TD}>
                      <RowLink href={buildProgressHref(`/teacher/students/${studentId}/tests/${a.id}`, filters)}>{t.name}</RowLink>
                      {a.status !== "SUBMITTED" ? <span className="ml-2"><AttemptStatusBadge status={a.status} /></span> : null}
                    </td>
                    <td className={`${TD} whitespace-nowrap`}>Try {a.tryNumber} of {t.attempts.length}</td>
                    <td className={TD}><TestSectionScore attempt={a} section="RW" /></td>
                    <td className={TD}><TestSectionScore attempt={a} section="MATH" /></td>
                    <td className={TD}><TestTotalCell attempt={a} /></td>
                    <ChevronCell />
                  </LinkTr>
                ))}
              </SimpleTable>
              <Pagination
                basePath={`/teacher/students/${studentId}`}
                params={pageParams}
                param="examsPage"
                anchor="exam-history"
                pageSize={HISTORY_PAGE_SIZE}
                {...examPage}
              />
            </>
          )}
        </section>
      </PageShell>
    );
  }

  // ---------------------------------------------------------------- Practice (Math / Reading / Writing)
  const [report, areaOverview] = await Promise.all([
    loadPracticeReport(studentId, practiceArea, reportFilters),
    loadStudentOverviews([studentId], now).then((m) => m.get(studentId)!.areas[practiceArea]),
  ]);
  const { areaLabel, kpis } = report;
  const attemptPage = paginate(report.attemptHistory, pageFromParam(query.attemptsPage), HISTORY_PAGE_SIZE);
  const triesByAssignment = new Map<string, number>();
  for (const attempt of report.attemptHistory) {
    if (attempt.assignmentId) triesByAssignment.set(attempt.assignmentId, Math.max(triesByAssignment.get(attempt.assignmentId) ?? 0, attempt.attemptNumber ?? 1));
  }
  const assignHref = (overrides: { topic?: string; difficulty?: string }, extra: Record<string, string>) => {
    const href = buildProgressHref(`/teacher/students/${studentId}/assign`, filters, overrides);
    return `${href}${href.includes("?") ? "&" : "?"}${new URLSearchParams(extra).toString()}`;
  };
  return (
    <PageShell maxWidth={1180} width="wide">
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
      <KpiStrip
        items={[
          { label: "Sets completed", value: String(kpis.attempts), hint: `${areaLabel} practice sets finished (with the current filters).`, href: "#recent-attempts" },
          {
            label: "Questions correct",
            value: kpis.overall.percent !== null ? `${kpis.overall.percent}%` : "—",
            className: scoreBandTextClass(kpis.overall.percent),
            sub: kpis.overall.total ? `${kpis.overall.correct} of ${kpis.overall.total} correct` : undefined,
            hint: "% of questions answered correctly. Blank answers count as wrong.",
            href: "#performance",
          },
          { label: "Total time", value: formatDuration(kpis.totalTime), hint: "Total time on finished work.", href: "#recent-attempts" },
          { label: "Time per question", value: kpis.avgQuestionTime !== null ? formatDuration(kpis.avgQuestionTime) : "—", hint: "Average time per answered question.", href: "#recent-attempts" },
          { label: "Sets to finish", value: String(kpis.pending), hint: "Assigned but not finished yet.", href: "#active-sets" },
        ]}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div id="performance" className="min-w-0 space-y-6 lg:col-span-2">
          <section className="grid items-start gap-4 xl:grid-cols-[minmax(0,320px)_1fr]">
            <AreaSummaryCard
              area={practiceArea}
              label={`${areaLabel} practice`}
              latest={
                areaOverview.last
                  ? {
                      caption: <>Latest practice · {areaOverview.last.setName} · {formatDate(areaOverview.last.at)}</>,
                      pct: areaOverview.last.pct,
                      detail: "correct",
                    }
                  : null
              }
              delta={areaOverview.delta}
              chips={[{ label: "Average", value: areaOverview.avgPct !== null ? `${areaOverview.avgPct}%` : "—" }]}
              weakest={areaOverview.weakest ? <>Weakest skill: <b>{areaOverview.weakest.name}</b> ({areaOverview.weakest.pct}%)</> : null}
              footer={`${areaOverview.attempts} practice attempt${areaOverview.attempts === 1 ? "" : "s"} · ${areaOverview.toDo} set${areaOverview.toDo === 1 ? "" : "s"} to do`}
              action=""
              emptyText={`No ${areaLabel} practice yet.`}
            />
            <div className="min-w-0">
            <SectionHeader
              title={`${areaLabel} skills by difficulty`}
              description="Practice only · % correct by difficulty · click a cell to filter this page"
            />
            <SkillDifficultyMatrix
              selected={{ skill: topicId, difficulty }}
              actionHeader=""
              emptyText={`No finished ${areaLabel} work for this student yet.`}
              rows={report.skillMatrix.map((row) => ({
                id: row.topicId,
                label: row.label,
                cells: Object.fromEntries(
                  DIFFICULTIES.map((d) => {
                    const c = row.cells[d];
                    return [
                      d,
                      c
                        ? {
                            pct: c.percent,
                            right: c.correct,
                            total: c.total,
                            tries: c.tries,
                            href: `${buildProgressHref(`/teacher/students/${studentId}`, filters, { topic: row.topicId, difficulty: d })}#performance`,
                          }
                        : null,
                    ];
                  }),
                ),
                action: (
                  <Link
                    href={assignHref({ topic: row.topicId, difficulty: undefined }, { domain: row.domainId })}
                    className="whitespace-nowrap font-medium text-blue-600 hover:underline"
                  >
                    Assign
                  </Link>
                ),
              }))}
            />
            </div>
          </section>

          <PerformanceBreakdown
            title="Performance by skill and difficulty"
            rowLabel="Skill"
            dimensionLabel="difficulty"
            dimensions={difficulty ? [difficulty] : ["EASY", "MEDIUM", "HARD"]}
            summaryMetrics={report.difficultyMetrics}
            detailMetrics={report.topicDifficultyMetrics}
            groups={report.skillGroups}
          />

          {topicId && difficulty && report.trend.topics.length > 0 && report.trend.attemptCount > 0 && (
            <TopicDifficultyTrend
              topics={report.trend.topics}
              pointsByTopic={report.trend.pointsByTopic}
              selectedTopic={skills.find((skill) => skill.id === topicId)?.name ?? report.trend.topics[0]}
              selectedDifficulty={difficulty}
            />
          )}

          <section id="weak-skills">
            <div className="mb-2 flex items-baseline justify-between gap-3">
              <h2 className="text-base font-semibold text-gray-900">Skill performance by difficulty</h2>
              <p className="text-xs text-gray-500">Lowest score first · assign practice from each row</p>
            </div>
            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[36rem] text-sm">
                  <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                    <tr>
                      <th className="px-3 py-2 text-left">Skill · level</th>
                      <th className="px-3 py-2 text-right">% correct</th>
                      <th className="px-3 py-2 text-right">
                        <span className="whitespace-nowrap">Avg time <InfoHint label="Average time per answered question." /></span>
                      </th>
                      <th className="px-3 py-2 text-left">
                        Suggested next step <InfoHint label="Under 50%: re-teach · 50–74%: review mistakes · 75%+: light practice" />
                      </th>
                      <th className="px-3 py-2" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {report.weakSkills.map((bucket) => (
                      <tr key={bucket.key}>
                        <td className="px-3 py-2">
                          <span className="font-medium text-gray-800">{bucket.label}</span>
                          <span className="ml-2 rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-gray-600">{difficultyLabel(bucket.difficulty)}</span>
                        </td>
                        <td className={`whitespace-nowrap px-3 py-2 text-right font-medium ${scoreBandTextClass(bucket.percent)}`}>{bucket.percent}% <span className="text-xs font-normal text-gray-400">({bucket.correct}/{bucket.total})</span></td>
                        <td className="px-3 py-2 text-right text-gray-500">{bucket.avgTime !== null ? formatTime(bucket.avgTime) : "-"}</td>
                        <td className="px-3 py-2 text-xs text-gray-600">{bucket.recommendation}</td>
                        <td className="px-3 py-2 text-right">
                          {bucket.assignableIds.length > 0 ? (
                            <Hint label={`Assign ${bucket.assignableIds.length} more ${bucket.label} set${bucket.assignableIds.length === 1 ? "" : "s"} at this level.`}>
                              <Link
                                href={assignHref({ topic: bucket.topicId, difficulty: bucket.difficulty }, { domain: bucket.domainId, sets: bucket.assignableIds.join(",") })}
                                className="whitespace-nowrap text-xs font-medium text-blue-600 hover:underline"
                              >
                                Assign practice
                              </Link>
                            </Hint>
                          ) : bucket.pendingCount > 0 ? (
                            <Hint label="Assigned but not finished yet. See Active practice sets.">
                              <a href="#active-sets" className="whitespace-nowrap text-xs text-gray-400 hover:underline">
                                {bucket.pendingCount} assigned
                              </a>
                            </Hint>
                          ) : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {report.weakSkills.length === 0 && (
                <p className="py-10 text-center text-sm text-gray-500">No finished {areaLabel} work for this student yet.</p>
              )}
            </Card>
          </section>
        </div>

        <aside className="min-w-0 space-y-6">
          <SidePanel id="active-sets" title="Active practice sets" count={report.assignments.length} empty={`No active ${areaLabel} practice sets.`}>
            {report.assignments.map((a) => (
              <li key={a.id} className="flex items-start justify-between gap-3 px-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-gray-800" title={a.name}>{shortSetName(a.name)}</p>
                  <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                    <StatusBadge status={a.status} />
                    {a.locked && <Badge variant="danger">Locked</Badge>}
                    {a.dueDate && <span className="text-[11px] text-gray-400">Due {formatDate(a.dueDate)}</span>}
                  </div>
                </div>
                <Hint label={a.status === "OVERDUE" ? "Give it to the student again, with a new due date if you like." : "Change the due date, open date or when answers are shown. The student's progress is kept."}>
                  <Link
                    href={assignHref({ topic: a.topicId, difficulty: a.difficulty }, { sets: a.practiceSetId })}
                    className="shrink-0 text-xs font-medium text-blue-600 hover:underline"
                  >
                    {a.status === "OVERDUE" ? "Reassign" : "Edit"}
                  </Link>
                </Hint>
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
          description={`${report.attemptHistory.length} finished attempt${report.attemptHistory.length === 1 ? "" : "s"} · click a row to see each answer`}
          action={
            <Link href={buildProgressHref(`/teacher/students/${studentId}/assign`, filters)} className="text-xs font-medium text-blue-600 hover:underline">
              Assign practice
            </Link>
          }
        />
        {report.attemptHistory.length === 0 ? (
          <EmptyState title={`No finished ${areaLabel} work yet.`} />
        ) : (
          <>
            <PracticeAttemptsTable
              hrefFor={(id) => buildProgressHref(`/teacher/students/${studentId}/attempts/${id}`, filters)}
              rows={attemptPage.items.map((attempt) => ({
                id: attempt.id,
                tryNumber: attempt.attemptNumber ?? 1,
                tryCount: attempt.assignmentId ? triesByAssignment.get(attempt.assignmentId) : undefined,
                submittedAt: attempt.submittedAt,
                correct: attempt.correct,
                total: attempt.total,
                pct: attempt.percent,
                time: attempt.totalTime,
                status: attempt.status,
                title: (
                  <>
                    {shortSetName(attempt.name)}
                    {attempt.difficulty ? <Badge variant={difficultyBadgeVariant(attempt.difficulty)} className="ml-2">{difficultyLabel(attempt.difficulty)}</Badge> : null}
                  </>
                ),
              }))}
            />
            <Pagination
              basePath={`/teacher/students/${studentId}`}
              params={pageParams}
              param="attemptsPage"
              anchor="recent-attempts"
              pageSize={HISTORY_PAGE_SIZE}
              {...attemptPage}
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

function SidePanel({ id, title, count, empty, children, footer }: { id?: string; title: string; count: number; empty: string; children: ReactNode; footer?: ReactNode }) {
  return (
    <section id={id}>
      <h2 className="mb-2 flex items-center justify-between text-sm font-semibold text-gray-900">
        {title}
        <span className="text-xs font-normal text-gray-400">{count}</span>
      </h2>
      <Card className="overflow-hidden">
        {count === 0 ? <p className="px-3 py-4 text-sm text-gray-400">{empty}</p> : <ul className="divide-y divide-gray-100">{children}</ul>}
        {count > 0 && footer ? <div className="border-t border-gray-100">{footer}</div> : null}
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
