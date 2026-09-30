import { AttemptStatusBadge, PageShell, Pagination, PracticeAreaTabs, VoidableValue, invalidatedRowClass, isInvalidated, pageFromParam, paginate } from "@/components/sat";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";
import type { ReactNode } from "react";
import { formatDate, formatTime } from "@/lib/utils";
import { scoreBandTextClass } from "@/lib/score-band";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ProgressFilters } from "@/components/progress-filters";
import { PerformanceBreakdown } from "@/components/performance-breakdown";
import { TopicDifficultyTrend } from "@/components/topic-difficulty-trend";
import { MockSectionChart } from "@/components/progress-charts";
import { Hint, InfoHint } from "@/components/hint";
import { ChevronLeft, ClipboardList, Eye, Pencil, Plus } from "lucide-react";
import { StudentDetailActions } from "./actions-client";
import { StudentSwitcher } from "./student-switcher";
import { GenerateReportDialog } from "./generate-report-dialog";
import { refreshAssignmentStates } from "@/lib/assignments";
import { getFeatureSetting } from "@/lib/app-settings";
import { studentAccessWhereFor } from "@/lib/program-scope";
import { loadMockReport, loadPracticeReport, shortSetName, type ReportAttempt } from "@/lib/student-report";
import { activeAreaTab, practiceAreaFromTab } from "@/lib/practice-area";
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
  searchParams: Promise<{ area?: string; topic?: string; difficulty?: string; from?: string; to?: string; attemptsPage?: string; examsPage?: string }>;
}

const HISTORY_PAGE_SIZE = 10;

export default async function StudentPage({ params, searchParams }: PageProps) {
  const { studentId } = await params;
  const query = await searchParams;
  const { filters, showEndDate } = await applyTimeFilterSetting(progressFiltersFromParams(query));
  const area = activeAreaTab(filters.area, filters.area);
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
  const pageParams: Record<string, string | undefined> = { ...Object.fromEntries(progressFilterEntries(filters)), attemptsPage: query.attemptsPage, examsPage: query.examsPage };

  const reportFilters = { topic: filters.topic, difficulty: filters.difficulty, from: filters.from, to: filters.to };
  const filterSummary = [
    topicId ? `Skill: ${skills.find((skill) => skill.id === topicId)?.name ?? topicId}` : null,
    difficulty ? `Difficulty: ${difficulty}` : null,
    filters.from ? `From ${filters.from}` : null,
    filters.to ? `To ${filters.to}` : null,
  ].filter(Boolean).join(" · ");
  const switcherQuery = buildProgressHref("", filters).replace(/^\?/, "");
  const secondaryButton =
    "inline-flex h-8 items-center justify-center gap-1.5 rounded-md border border-gray-300 bg-white px-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50";

  const header = (
    <>
      <div className="mb-3 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <Link href={buildProgressHref("/teacher", filters)} className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-blue-600">
            <ChevronLeft size={12} /> Students
          </Link>
          <h1 className="text-2xl font-semibold text-gray-900">{student.name}</h1>
          <p className="mt-0.5 truncate text-xs text-gray-500">
            {student.email} · {student.phone ?? "—"}
            {student.startDate && <> · Since {formatDate(student.startDate)}</>}
            {teacherGroupManagementEnabled && <> · Groups: {student.groups.map((g) => g.group.name).join(", ") || "—"}</>}
            {" · "}Programs: {student.programEnrollments.map((e) => e.program.name).join(", ") || "—"}
          </p>
        </div>
        <StudentSwitcher students={roster} selectedStudentId={studentId} query={switcherQuery} />
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Hint label="Pick one or more Practice Sets for this student. Sets already pending are updated, completed or overdue ones are reassigned.">
          <Link href={buildProgressHref(`/teacher/students/${studentId}/assign`, filters)} className="inline-flex h-8 items-center justify-center gap-1 rounded-md bg-blue-600 px-3 text-sm font-medium text-white hover:bg-blue-700">
            <Plus size={14} /> Assign practice
          </Link>
        </Hint>
        <Hint label="Assign a Full Practice Test (mock exam) to this student.">
          <Link href={buildProgressHref(`/teacher/students/${studentId}/assign-exam`, filters)} className="inline-flex h-8 items-center justify-center gap-1 rounded-md border border-blue-600 px-3 text-sm font-medium text-blue-700 hover:bg-blue-50">
            <ClipboardList size={14} /> Assign exam
          </Link>
        </Hint>
        <span className="mx-1 hidden h-5 w-px bg-gray-200 sm:inline-block" aria-hidden />
        <GenerateReportDialog
          studentId={studentId}
          studentName={student.name}
          currentArea={area}
          filters={reportFilters}
          filterSummary={filterSummary}
          exams={reportExams}
          parents={reportParents}
        />
        <Hint label="Open the student portal exactly as this student sees it (read-only).">
          <Link href={buildProgressHref(`/teacher/impersonate/${studentId}`, filters)} className={secondaryButton}>
            <Eye size={14} /> Student view
          </Link>
        </Hint>
        <Hint label="Edit name, email, phone and start date.">
          <Link href={`/teacher/students/${studentId}/edit`} className={secondaryButton}>
            <Pencil size={14} /> Edit
          </Link>
        </Hint>
        <StudentDetailActions studentId={studentId} isActive={student.active} />
      </div>

      <PracticeAreaTabs
        basePath={`/teacher/students/${studentId}`}
        active={area}
        preserve={{ difficulty: filters.difficulty, from: filters.from, to: filters.to }}
        className="mb-3"
      />
      <ProgressFilters
        action={`/teacher/students/${studentId}`}
        filters={filters}
        topics={skills.map((skill) => ({ id: skill.id, name: skill.name, group: skill.domain }))}
        showEndDate={showEndDate}
      />
    </>
  );

  // ---------------------------------------------------------------- Full Practice Tests
  if (!practiceArea) {
    const report = await loadMockReport(studentId, reportFilters);
    const examPage = paginate(report.examHistory, pageFromParam(query.examsPage), HISTORY_PAGE_SIZE);
    return (
      <PageShell width="wide">
        {header}
        <KpiStrip
          items={[
            { label: "Exams completed", value: String(report.kpis.exams), hint: "Submitted Full Practice Tests in the selected dates." },
            { label: "Latest total", value: String(report.kpis.latestTotal ?? "—"), className: "text-[var(--sat-area-mocks)]", hint: "SAT total (400–1600) of the most recent exam." },
            { label: "Latest R&W", value: String(report.kpis.latestRw ?? "—"), hint: "Reading & Writing section score (200–800) of the most recent exam." },
            { label: "Latest Math", value: String(report.kpis.latestMath ?? "—"), hint: "Math section score (200–800) of the most recent exam." },
            { label: "Pending exams", value: String(report.kpis.pending), hint: "Assigned Full Practice Tests not submitted yet (pending, in progress or overdue)." },
          ]}
        />
        <div className="grid gap-6 lg:grid-cols-3">
          <div id="performance" className="min-w-0 space-y-6 lg:col-span-2">
            {report.exams.length === 0 ? (
              <Card padding="lg" className="py-12 text-center text-sm text-gray-400">No submitted Full Practice Tests for this student yet.</Card>
            ) : (
              <>
                <MockSectionChart metrics={report.scoreSeries} />
                <PerformanceBreakdown
                  title="Performance by section and module"
                  rowLabel="Section"
                  dimensionLabel="module"
                  dimensions={report.modules}
                  summaryMetrics={report.moduleMetrics}
                  detailMetrics={report.sectionModuleMetrics}
                />
              </>
            )}
          </div>
          <aside className="min-w-0 space-y-6">
            <SidePanel title="Active Full Practice Tests" count={report.activeExams.length} empty="No active Full Practice Tests.">
              {report.activeExams.map((a) => (
                <li key={a.id} className="flex items-start justify-between gap-3 px-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-gray-800">{a.name}</p>
                    <div className="mt-0.5 flex items-center gap-2">
                      <StatusBadge status={a.status} />
                      {a.dueDate && <span className="text-[11px] text-gray-400">Due {formatDate(a.dueDate)}</span>}
                    </div>
                  </div>
                  <Hint label={a.status === "OVERDUE" ? "Open it again for the student with a new due date." : "Change the due date of this exam."}>
                    <Link href={buildProgressHref(`/teacher/students/${studentId}/assign-exam`, filters)} className="shrink-0 text-xs font-medium text-blue-600 hover:underline">
                      {a.status === "OVERDUE" ? "Reassign" : "Due date"}
                    </Link>
                  </Hint>
                </li>
              ))}
            </SidePanel>
            <SidePanel
              id="exam-history"
              title="Exam history"
              count={report.examHistory.length}
              empty="No completed Full Practice Tests yet."
              footer={
                <Pagination
                  basePath={`/teacher/students/${studentId}`}
                  params={pageParams}
                  param="examsPage"
                  anchor="exam-history"
                  pageSize={HISTORY_PAGE_SIZE}
                  {...examPage}
                />
              }
            >
              {examPage.items.map((exam) => (
                <li key={exam.id} className={`flex items-center justify-between gap-3 px-3 py-2 ${invalidatedRowClass(exam.status) ?? ""}`}>
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 truncate text-sm font-medium text-gray-800">
                      <span className="truncate">{exam.name}</span>
                      {isInvalidated(exam.status) ? <AttemptStatusBadge status={exam.status} /> : null}
                    </p>
                    <p className="text-[11px] text-gray-400">
                      {exam.submittedAt ? formatDate(exam.submittedAt) : "—"} ·{" "}
                      <VoidableValue status={exam.status}>R&amp;W {exam.rwScore ?? "—"} · Math {exam.mathScore ?? "—"}</VoidableValue>
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <VoidableValue status={exam.status} className="text-sm font-semibold text-gray-900">
                      {exam.totalScore ?? "—"}
                    </VoidableValue>
                    <Hint label="Open this exam: module and question detail, reopen or invalidate, send the exam report.">
                      <Link href={buildProgressHref(`/teacher/students/${studentId}/full-tests/${exam.id}`, filters)} className="text-xs font-medium text-blue-600 hover:underline">
                        Review
                      </Link>
                    </Hint>
                  </div>
                </li>
              ))}
            </SidePanel>
          </aside>
        </div>
      </PageShell>
    );
  }

  // ---------------------------------------------------------------- Practice (Math / Reading / Writing)
  const report = await loadPracticeReport(studentId, practiceArea, reportFilters);
  const { areaLabel, kpis } = report;
  const attemptPage = paginate(report.attemptHistory, pageFromParam(query.attemptsPage), HISTORY_PAGE_SIZE);
  const assignHref = (overrides: { topic?: string; difficulty?: string }, extra: Record<string, string>) => {
    const href = buildProgressHref(`/teacher/students/${studentId}/assign`, filters, overrides);
    return `${href}${href.includes("?") ? "&" : "?"}${new URLSearchParams(extra).toString()}`;
  };
  const attemptRow = (attempt: ReportAttempt) => (
    <li key={attempt.id} className={`flex items-center justify-between gap-3 px-3 py-2 ${invalidatedRowClass(attempt.status) ?? ""}`}>
      <div className="min-w-0">
        <p className="flex items-center gap-2 truncate text-sm font-medium text-gray-800" title={attempt.name}>
          <span className="truncate">{shortSetName(attempt.name)}</span>
          {isInvalidated(attempt.status) ? <AttemptStatusBadge status={attempt.status} /> : null}
        </p>
        <p className="text-[11px] text-gray-400">
          {attempt.submittedAt ? formatDate(attempt.submittedAt) : "—"} · {formatTime(attempt.totalTime)} spent
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        {attempt.percent !== null ? (
          isInvalidated(attempt.status) ? (
            <VoidableValue status={attempt.status} className="text-sm font-semibold">{attempt.percent}%</VoidableValue>
          ) : (
            <span className={`text-sm font-semibold ${scoreBandTextClass(attempt.percent)}`} title={`${attempt.correct} correct of ${attempt.total} questions`}>
              {attempt.percent}%
            </span>
          )
        ) : (
          <span className="text-sm text-gray-400">—</span>
        )}
        <Hint label="Review this attempt question by question (answers, time and explanations).">
          <Link href={buildProgressHref(`/teacher/students/${studentId}/attempts/${attempt.id}`, filters)} className="text-xs font-medium text-blue-600 hover:underline">
            Review
          </Link>
        </Hint>
      </div>
    </li>
  );

  return (
    <PageShell width="wide">
      {header}
      {report.pendingExamCount > 0 && (
        <div className="mt-3 rounded-md border border-orange-200 bg-orange-50 px-3 py-2 text-sm text-orange-900">
          {report.pendingExamCount} active Full Practice Test{report.pendingExamCount === 1 ? "" : "s"} assigned.{" "}
          <Link href={buildProgressHref(`/teacher/students/${studentId}`, filters, { area: "mocks" })} className="font-medium underline">
            Open Full Practice Tests →
          </Link>
        </div>
      )}
      <KpiStrip
        items={[
          { label: `Attempts · ${areaLabel}`, value: String(kpis.attempts), hint: `Submitted ${areaLabel} practice sets matching the filters.` },
          {
            label: "Average score",
            value: kpis.overall.percent !== null ? `${kpis.overall.percent}%` : "—",
            className: scoreBandTextClass(kpis.overall.percent),
            sub: kpis.overall.total ? `${kpis.overall.correct} of ${kpis.overall.total} correct` : undefined,
            hint: "Correct answers ÷ all questions of the submitted attempts. Blank answers count as incorrect.",
          },
          { label: "Total time", value: formatTime(kpis.totalTime), hint: "Time spent across all submitted attempts." },
          { label: "Avg question time", value: kpis.avgQuestionTime !== null ? formatTime(kpis.avgQuestionTime) : "—", hint: "Average time per answered question." },
          { label: "Pending sets", value: String(kpis.pending), hint: `Assigned ${areaLabel} practice sets not finished yet (pending, in progress or overdue).` },
        ]}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div id="performance" className="min-w-0 space-y-6 lg:col-span-2">
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
              <p className="text-xs text-gray-500">Lowest accuracy first · assign practice from each row</p>
            </div>
            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[36rem] text-sm">
                  <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                    <tr>
                      <th className="px-3 py-2 text-left">Skill · difficulty</th>
                      <th className="px-3 py-2 text-right">Accuracy</th>
                      <th className="px-3 py-2 text-right">
                        <span className="whitespace-nowrap">Avg time <InfoHint label="Average time per answered question in this skill and difficulty." /></span>
                      </th>
                      <th className="px-3 py-2 text-left">
                        Suggested next step <InfoHint label="Rule of thumb from accuracy: below 50% re-teach, 50–74% review mistakes, 75%+ keep a short reinforcement." />
                      </th>
                      <th className="px-3 py-2" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {report.weakSkills.map((bucket) => (
                      <tr key={bucket.key}>
                        <td className="px-3 py-2">
                          <span className="font-medium text-gray-800">{bucket.label}</span>
                          <span className="ml-2 rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-gray-600">{bucket.difficulty}</span>
                        </td>
                        <td className={`whitespace-nowrap px-3 py-2 text-right font-medium ${scoreBandTextClass(bucket.percent)}`}>{bucket.percent}% <span className="text-xs font-normal text-gray-400">({bucket.correct}/{bucket.total})</span></td>
                        <td className="px-3 py-2 text-right text-gray-500">{bucket.avgTime !== null ? formatTime(bucket.avgTime) : "-"}</td>
                        <td className="px-3 py-2 text-xs text-gray-600">{bucket.recommendation}</td>
                        <td className="px-3 py-2 text-right">
                          {bucket.assignableIds.length > 0 ? (
                            <Hint label={`Opens the assign form filtered to ${bucket.label} · ${bucket.difficulty} with the ${bucket.assignableIds.length} available set${bucket.assignableIds.length === 1 ? "" : "s"} preselected (not assigned yet, completed or overdue).`}>
                              <Link
                                href={assignHref({ topic: bucket.topicId, difficulty: bucket.difficulty }, { domain: bucket.domainId, sets: bucket.assignableIds.join(",") })}
                                className="whitespace-nowrap text-xs font-medium text-blue-600 hover:underline"
                              >
                                Assign practice
                              </Link>
                            </Hint>
                          ) : bucket.pendingCount > 0 ? (
                            <Hint label="Every set of this skill and difficulty is already assigned and not finished yet. See it under Active practice sets.">
                              <a href="#active-sets" className="whitespace-nowrap text-xs text-gray-400 hover:underline">
                                Pending ({bucket.pendingCount})
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
                <p className="py-10 text-center text-sm text-gray-500">No submitted {areaLabel.toLowerCase()} answers for this student yet.</p>
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
                <Hint label={a.status === "OVERDUE" ? "Open it again for the student, optionally with a new due date." : "Change due date, unlock date or feedback mode. The student's progress is kept."}>
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

          <SidePanel
            id="recent-attempts"
            title="Recent attempts"
            count={report.attemptHistory.length}
            empty={`No completed ${areaLabel} attempts yet.`}
            footer={
              <Pagination
                basePath={`/teacher/students/${studentId}`}
                params={pageParams}
                param="attemptsPage"
                anchor="recent-attempts"
                pageSize={HISTORY_PAGE_SIZE}
                {...attemptPage}
              />
            }
          >
            {attemptPage.items.map(attemptRow)}
          </SidePanel>

          {report.comments.length > 0 && (
            <SidePanel title="Teacher Comments" count={report.comments.length} empty="">
              {report.comments.map((entry) => (
                <li key={entry.id} className="px-3 py-2">
                  <p className="text-[11px] text-gray-400" title={entry.name}>{shortSetName(entry.name)} · {entry.submittedAt ? formatDate(entry.submittedAt) : "-"}</p>
                  <p className="text-sm text-gray-800">{entry.teacherComment}</p>
                </li>
              ))}
            </SidePanel>
          )}
        </aside>
      </div>
    </PageShell>
  );
}

function KpiStrip({ items }: { items: Array<{ label: string; value: string; className?: string; sub?: string; hint?: string }> }) {
  return (
    <div className="my-4 grid grid-cols-2 divide-gray-100 overflow-hidden rounded-lg border border-gray-200 bg-white sm:grid-cols-3 lg:grid-cols-5 lg:divide-x">
      {items.map((item) => (
        <div key={item.label} className="px-4 py-3">
          <p className="flex items-center gap-1 text-[11px] font-medium uppercase tracking-wide text-gray-500">
            {item.label}
            {item.hint ? <InfoHint label={item.hint} /> : null}
          </p>
          <p className={`mt-1 text-xl font-bold leading-none ${item.className ?? "text-gray-900"}`}>{item.value}</p>
          {item.sub ? <p className="mt-1 text-[11px] text-gray-400">{item.sub}</p> : null}
        </div>
      ))}
    </div>
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
    IN_PROGRESS: "The student started it and has not submitted.",
    OVERDUE: "The due date passed before the student submitted it.",
  };
  return (
    <span title={help[status]}>
      <Badge variant={variant}>{status.replace("_", " ")}</Badge>
    </span>
  );
}
