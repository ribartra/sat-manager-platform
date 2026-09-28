import { PageShell, PracticeAreaTabs } from "@/components/sat";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";
import { formatDate, formatTime, scorePercent } from "@/lib/utils";
import { scoreBandTextClass } from "@/lib/score-band";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ProgressFilters } from "@/components/progress-filters";
import { PerformanceBreakdown } from "@/components/performance-breakdown";
import { TopicDifficultyTrend } from "@/components/topic-difficulty-trend";
import { MockSectionChart } from "@/components/progress-charts";
import { ChevronLeft, Eye, FileDown } from "lucide-react";
import { StudentDetailActions } from "./actions-client";
import { StudentSwitcher } from "./student-switcher";
import { refreshAssignmentStates } from "@/lib/assignments";
import { getFeatureSetting } from "@/lib/app-settings";
import { studentAccessWhereFor } from "@/lib/program-scope";
import { parseSnapshot, type PracticeSetSnapshot, type QuestionSnapshot } from "@/lib/attempt-snapshots";
import { isAnsweredAnswer, sumAttemptElapsedTime, summarizeAllQuestionAnswers } from "@/lib/weighted-score";
import { aggregateDifficultyMetrics, aggregateTopicDifficultyMetrics, aggregateTopicDifficultyTrend, type MockSectionMetric } from "@/lib/progress-analytics";
import { activeAreaTab, practiceAreaFromTab, practiceAreaLabel } from "@/lib/practice-area";
import { buildProgressHref, progressDateWhere, progressFiltersFromParams } from "@/lib/progress-filters";

// One page per student (replaces the former Student Analytics and Individual Report views):
//   Overview    -> KPIs + active assignments (edit / reassign in one click)
//   Performance -> skill x difficulty breakdown, trend, weak skills with "Assign practice"
//   History     -> submitted attempts (with review) and teacher comments
// The printable report is the "Download PDF" action (/api/reports/students/[id]/pdf).

const VIEWS = [
  { key: "overview", label: "Overview" },
  { key: "performance", label: "Performance" },
  { key: "history", label: "History" },
] as const;
type ViewKey = (typeof VIEWS)[number]["key"];

interface PageProps {
  params: Promise<{ studentId: string }>;
  searchParams: Promise<{ area?: string; topic?: string; difficulty?: string; from?: string; to?: string; view?: string }>;
}

type QuestionRow = {
  topicId: string;
  topicName: string;
  domainId: string;
  difficulty: string;
  answer: string | null;
  isCorrect: boolean;
  timeSeconds: number;
  attemptId: string;
};

type WeakSkill = {
  key: string;
  topicId: string;
  domainId: string;
  label: string;
  difficulty: string;
  correct: number;
  total: number;
  totalTime: number;
  timed: number;
};

export default async function StudentPage({ params, searchParams }: PageProps) {
  const { studentId } = await params;
  const query = await searchParams;
  const filters = progressFiltersFromParams(query);
  const view: ViewKey = VIEWS.some((v) => v.key === query.view) ? (query.view as ViewKey) : "overview";
  const area = activeAreaTab(filters.area, filters.area);
  const practiceArea = practiceAreaFromTab(area);
  const isMocks = area === "mocks";
  const topicId = filters.topic ?? "";
  const difficulty = filters.difficulty ?? "";
  const dateFilter = progressDateWhere(filters);

  const session = await auth();
  const now = new Date();
  await refreshAssignmentStates(now);
  const teacherGroupManagementEnabled =
    session?.user.role === "ADMIN" || (await getFeatureSetting("TEACHER_GROUP_MANAGEMENT"));
  const studentWhere = session
    ? studentAccessWhereFor(session.user, now)
    : { role: "STUDENT", active: true, validationStatus: "APPROVED" };

  const [student, roster] = await Promise.all([
    prisma.user.findFirst({
      where: { id: studentId, ...studentWhere },
      include: {
        groups: { include: { group: true } },
        programEnrollments: { include: { program: true }, where: { active: true, status: "APPROVED" } },
      },
    }),
    prisma.user.findMany({ where: studentWhere, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  if (!student) notFound();

  const withView = (href: string, nextView: ViewKey = view) =>
    nextView === "overview" ? href : `${href}${href.includes("?") ? "&" : "?"}view=${nextView}`;
  const pageHref = (overrides: Parameters<typeof buildProgressHref>[2] = {}, nextView: ViewKey = view) =>
    withView(buildProgressHref(`/teacher/students/${studentId}`, filters, overrides), nextView);

  const pdfParams = new URLSearchParams({
    areas: area === "math" ? "mathematics" : area === "reading" || area === "writing" ? area : "mathematics,reading,writing",
  });
  for (const key of ["topic", "difficulty", "from", "to"] as const) {
    if (filters[key]) pdfParams.set(key, filters[key]!);
  }
  const pdfHref = `/api/reports/students/${studentId}/pdf?${pdfParams.toString()}`;
  const switcherQuery = pageHref().split("?")[1] ?? "";

  const topics = practiceArea
    ? await prisma.topic.findMany({ where: { domain: { practiceArea } }, select: { id: true, name: true }, orderBy: { name: "asc" } })
    : [];

  const header = (
    <>
      <div className="mb-4 flex items-center gap-2 text-sm text-gray-500">
        <Link href={buildProgressHref("/teacher", filters)} className="flex items-center gap-1 hover:text-blue-600">
          <ChevronLeft size={14} /> Students
        </Link>
        <span>/</span>
        <span className="font-medium text-gray-900">{student.name}</span>
      </div>

      <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold text-gray-900">{student.name}</h1>
          <p className="mt-0.5 text-sm text-gray-500">
            {student.email} · {student.phone ?? "—"}
            {student.startDate && <> · Start date: {formatDate(student.startDate)}</>}
            {teacherGroupManagementEnabled && <> · Groups: {student.groups.map((g) => g.group.name).join(", ") || "—"}</>}
            {" · "}Programs: {student.programEnrollments.map((e) => e.program.name).join(", ") || "—"}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link href={buildProgressHref(`/teacher/students/${studentId}/assign`, filters)} className="inline-flex h-9 items-center justify-center rounded-md bg-blue-600 px-3 text-sm font-medium text-white hover:bg-blue-700">
              + Assign Practice
            </Link>
            <Link href={buildProgressHref(`/teacher/students/${studentId}/assign-exam`, filters)} className="inline-flex h-9 items-center justify-center rounded-md border border-blue-600 px-3 text-sm font-medium text-blue-700 hover:bg-blue-50">
              + Assign Exam
            </Link>
            <Link href={pdfHref} className="inline-flex h-9 items-center justify-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 text-sm font-medium text-gray-700 hover:bg-gray-50">
              <FileDown size={14} /> Download PDF
            </Link>
            <Link href={buildProgressHref(`/teacher/impersonate/${studentId}`, filters)} className="inline-flex h-9 items-center justify-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 text-sm font-medium text-gray-700 hover:bg-gray-50">
              <Eye size={14} /> View as Student
            </Link>
            <Link href={`/teacher/students/${studentId}/edit`} className="inline-flex h-9 items-center justify-center rounded-md border border-gray-300 bg-white px-3 text-sm font-medium text-gray-700 hover:bg-gray-50">
              Edit Student
            </Link>
            <StudentDetailActions studentId={studentId} isActive={student.active} />
          </div>
        </div>
        <StudentSwitcher students={roster} selectedStudentId={studentId} query={switcherQuery} />
      </div>

      <PracticeAreaTabs
        basePath={`/teacher/students/${studentId}`}
        active={area}
        preserve={{ difficulty: filters.difficulty, from: filters.from, to: filters.to, view: view === "overview" ? undefined : view }}
      />
      <nav aria-label="Student sections" className="mb-4 inline-flex rounded-lg border border-gray-200 bg-gray-50 p-1">
        {VIEWS.map((item) => (
          <Link
            key={item.key}
            href={pageHref({}, item.key)}
            aria-current={view === item.key ? "page" : undefined}
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${view === item.key ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-800"}`}
          >
            {item.label}
          </Link>
        ))}
      </nav>
      <ProgressFilters
        action={`/teacher/students/${studentId}`}
        filters={filters}
        topics={topics}
        preserve={{ view: view === "overview" ? undefined : view }}
      />
    </>
  );

  // ---------------------------------------------------------------- Full Practice Tests
  if (isMocks) {
    const [examAttempts, examAssignments] = await Promise.all([
      prisma.fullPracticeTestAttempt.findMany({
        where: { studentId, status: "SUBMITTED", ...dateFilter },
        include: {
          answers: true,
          test: {
            include: {
              modules: { include: { questions: { select: { questionId: true } } }, orderBy: { order: "asc" } },
            },
          },
        },
        orderBy: { submittedAt: "desc" },
      }),
      prisma.fullPracticeTestAssignment.findMany({
        where: { studentId, status: { in: ["PENDING", "IN_PROGRESS", "OVERDUE"] } },
        include: { test: { select: { id: true, name: true } } },
        orderBy: { createdAt: "desc" },
      }),
    ]);
    const latest = examAttempts[0];
    const mockMetrics: MockSectionMetric[] = [...examAttempts].reverse().map((exam) => ({
      attempts: 1,
      label: exam.test.name,
      submittedAt: exam.submittedAt?.toISOString() ?? null,
      mathScore: exam.mathScore,
      rwScore: exam.rwScore,
      totalScore: exam.totalScore,
    }));
    const mockRows = examAttempts.flatMap((exam) => {
      const answersByQuestion = new Map(exam.answers.map((answer) => [answer.questionId, answer]));
      return exam.test.modules.flatMap((module) =>
        module.questions.map((item) => {
          const answer = answersByQuestion.get(item.questionId);
          return {
            topic: module.section === "RW" ? "Reading & Writing" : "Math",
            difficulty: module.name,
            correct: answer?.isCorrect === true,
            timeSeconds: answer?.timeSpent ?? 0,
            attemptId: exam.id,
            attemptLabel: exam.test.name,
            submittedAt: exam.submittedAt,
          };
        }),
      );
    });

    return (
      <PageShell width="wide">
        {header}
        <div className="mt-6">
          {view === "overview" && (
            <>
              <KpiGrid
                items={[
                  { label: "Exams completed", value: String(examAttempts.length) },
                  { label: "Latest total", value: String(latest?.totalScore ?? "—"), className: "text-[var(--sat-area-mocks)]" },
                  { label: "Latest R&W", value: String(latest?.rwScore ?? "—") },
                  { label: "Latest Math", value: String(latest?.mathScore ?? "—") },
                  { label: "Pending exams", value: String(examAssignments.length) },
                ]}
              />
              <h2 className="mb-3 text-base font-semibold text-[var(--sat-area-mocks)]">Active Full Practice Tests</h2>
              {examAssignments.length === 0 ? (
                <p className="text-sm text-gray-400">No active Full Practice Tests.</p>
              ) : (
                <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                  {examAssignments.map((a) => (
                    <Card key={a.id} padding="sm" className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-gray-800">{a.test.name}</p>
                        <div className="mt-1 flex items-center gap-2">
                          <StatusBadge status={a.status} />
                          {a.dueDate && <span className="text-xs text-gray-400">Due {formatDate(a.dueDate)}</span>}
                        </div>
                      </div>
                      <Link href={buildProgressHref(`/teacher/students/${studentId}/assign-exam`, filters)} className="shrink-0 text-xs font-medium text-blue-600 hover:underline">
                        {a.status === "OVERDUE" ? "Reassign" : "Change due date"}
                      </Link>
                    </Card>
                  ))}
                </div>
              )}
            </>
          )}

          {view === "performance" && (
            examAttempts.length === 0 ? (
              <Card padding="lg" className="py-12 text-center text-sm text-gray-400">No submitted Full Practice Tests for this student yet.</Card>
            ) : (
              <>
                <div className="mb-8">
                  <MockSectionChart metrics={mockMetrics} />
                </div>
                <PerformanceBreakdown
                  title="Performance by section and module"
                  rowLabel="Section"
                  dimensionLabel="module"
                  dimensions={[...new Set(mockRows.map((row) => row.difficulty))]}
                  summaryMetrics={aggregateDifficultyMetrics(mockRows)}
                  detailMetrics={aggregateTopicDifficultyMetrics(mockRows)}
                />
              </>
            )
          )}

          {view === "history" && (
            <Card className="overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="px-4 py-2.5 text-left font-medium text-gray-500">Date</th>
                    <th className="px-4 py-2.5 text-left font-medium text-gray-500">Exam</th>
                    <th className="px-4 py-2.5 text-right font-medium text-gray-500">SAT Total</th>
                    <th className="px-4 py-2.5 text-right font-medium text-gray-500">R&amp;W</th>
                    <th className="px-4 py-2.5 text-right font-medium text-gray-500">Math</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {examAttempts.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-10 text-center text-sm text-gray-400">No completed Full Practice Tests yet.</td>
                    </tr>
                  ) : (
                    examAttempts.map((exam) => (
                      <tr key={exam.id} className="hover:bg-gray-50">
                        <td className="whitespace-nowrap px-4 py-3 text-gray-500">{exam.submittedAt ? formatDate(exam.submittedAt) : "—"}</td>
                        <td className="px-4 py-3 font-medium text-gray-900">{exam.test.name}</td>
                        <td className="px-4 py-3 text-right font-semibold text-gray-900">{exam.totalScore ?? "—"}</td>
                        <td className="px-4 py-3 text-right text-gray-700">{exam.rwScore ?? "—"}</td>
                        <td className="px-4 py-3 text-right text-gray-700">{exam.mathScore ?? "—"}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </Card>
          )}
        </div>
      </PageShell>
    );
  }

  // ---------------------------------------------------------------- Practice (Math / Reading / Writing)
  const [attempts, assignments, pendingExamCount] = await Promise.all([
    prisma.attempt.findMany({
      where: {
        studentId,
        status: "SUBMITTED",
        ...dateFilter,
        assignment: { practiceSet: { topic: { domain: { practiceArea: practiceArea! } } } },
      },
      include: {
        answers: { include: { question: { include: { topic: true } } } },
        assignment: {
          include: {
            practiceSet: { include: { questions: { include: { question: { include: { topic: true } } } } } },
          },
        },
      },
      orderBy: { submittedAt: "desc" },
    }),
    prisma.assignment.findMany({
      where: {
        studentId,
        status: { in: ["PENDING", "IN_PROGRESS", "OVERDUE"] },
        practiceSet: {
          topic: { domain: { practiceArea: practiceArea! } },
          ...(topicId ? { topicId } : {}),
          ...(difficulty ? { difficulty } : {}),
        },
      },
      include: { practiceSet: { include: { topic: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.fullPracticeTestAssignment.count({
      where: { studentId, status: { in: ["PENDING", "IN_PROGRESS", "OVERDUE"] } },
    }),
  ]);

  // Question rows use the attempt snapshot (what the student actually saw), filtered by topic/difficulty.
  const rowsByAttempt: QuestionRow[][] = attempts.map((attempt) => {
    const answersByQuestion = new Map(attempt.answers.map((answer) => [answer.questionId, answer]));
    const setQuestions = attempt.assignment?.practiceSet.questions ?? [];
    const sources = setQuestions.length
      ? setQuestions.map((item) => ({ question: item.question, answer: answersByQuestion.get(item.questionId) }))
      : attempt.answers.map((answer) => ({ question: answer.question, answer }));
    return sources
      .map(({ question, answer }) => {
        const snapshot = parseSnapshot<QuestionSnapshot>(answer?.questionSnapshot);
        return {
          topicId: snapshot?.topic?.id ?? question.topicId,
          topicName: snapshot?.topic?.name ?? question.topic.name,
          domainId: question.topic.domainId,
          difficulty: snapshot?.difficulty ?? question.difficulty,
          answer: answer?.answer ?? null,
          isCorrect: answer?.isCorrect === true,
          timeSeconds: answer?.timeSpent ?? 0,
          attemptId: attempt.id,
        };
      })
      .filter((row) => (!topicId || row.topicId === topicId) && (!difficulty || row.difficulty === difficulty));
  });
  const allRows = rowsByAttempt.flat();
  const scoredAttempts = attempts.map((attempt, index) => {
    const rows = rowsByAttempt[index] ?? [];
    const score = summarizeAllQuestionAnswers(rows);
    const snapshot = parseSnapshot<PracticeSetSnapshot>(attempt.practiceSetSnapshot);
    return {
      id: attempt.id,
      name: snapshot?.name ?? attempt.assignment?.practiceSet.name ?? "Practice Set",
      submittedAt: attempt.submittedAt,
      totalTime: attempt.totalTime ?? 0,
      correct: score.correct,
      total: score.total,
      percent: rows.some(isAnsweredAnswer) ? score.percent : null,
      teacherComment: attempt.teacherComment,
    };
  });
  const attemptById = new Map(scoredAttempts.map((attempt) => [attempt.id, attempt]));
  const overall = summarizeAllQuestionAnswers(allRows);
  const timedRows = allRows.filter((row) => row.timeSeconds);
  const avgQuestionTime = timedRows.length
    ? Math.round(timedRows.reduce((sum, row) => sum + row.timeSeconds, 0) / timedRows.length)
    : null;
  const areaLabel = practiceAreaLabel(practiceArea);

  const progressRows = allRows.map((row) => ({
    topic: row.topicName,
    difficulty: row.difficulty,
    correct: row.isCorrect,
    timeSeconds: row.timeSeconds,
    attemptId: row.attemptId,
    attemptLabel: attemptById.get(row.attemptId)?.name ?? "Practice set",
    submittedAt: attemptById.get(row.attemptId)?.submittedAt ?? null,
  }));

  // Weakest skill x difficulty buckets, with the one-click "Assign practice" when it makes sense.
  const weakMap = new Map<string, WeakSkill>();
  for (const row of allRows) {
    const key = `${row.topicId}:${row.difficulty}`;
    const bucket = weakMap.get(key) ?? {
      key, topicId: row.topicId, domainId: row.domainId, label: row.topicName, difficulty: row.difficulty,
      correct: 0, total: 0, totalTime: 0, timed: 0,
    };
    bucket.total += 1;
    if (row.isCorrect) bucket.correct += 1;
    if (row.timeSeconds) {
      bucket.totalTime += row.timeSeconds;
      bucket.timed += 1;
    }
    weakMap.set(key, bucket);
  }
  const weakSkills = [...weakMap.values()]
    .sort((a, b) => scorePercent(a.correct, a.total) - scorePercent(b.correct, b.total) || b.total - a.total)
    .slice(0, 12);
  const weakTopicIds = [...new Set(weakSkills.map((bucket) => bucket.topicId))];
  const setsForWeakSkills = view === "performance" && weakTopicIds.length > 0
    ? await prisma.practiceSet.findMany({
        where: { topicId: { in: weakTopicIds }, status: "PUBLISHED" },
        select: { id: true, topicId: true, difficulty: true, assignments: { where: { studentId }, select: { status: true } } },
        orderBy: { createdAt: "asc" },
      })
    : [];
  // Assignable = published set of that skill + difficulty that is unassigned, completed (retake) or overdue.
  const assignOptionFor = (bucket: WeakSkill) => {
    const sets = setsForWeakSkills.filter((set) => set.topicId === bucket.topicId && set.difficulty === bucket.difficulty);
    const assignable = sets.filter((set) => !set.assignments[0] || ["COMPLETED", "OVERDUE"].includes(set.assignments[0].status));
    return { assignableIds: assignable.map((set) => set.id), pendingCount: sets.length - assignable.length };
  };
  const assignHref = (overrides: { topic?: string; difficulty?: string }, extra: Record<string, string>) => {
    const href = buildProgressHref(`/teacher/students/${studentId}/assign`, filters, overrides);
    return `${href}${href.includes("?") ? "&" : "?"}${new URLSearchParams(extra).toString()}`;
  };

  const trendAttempts = scoredAttempts
    .filter((attempt) => attempt.total > 0)
    .map((attempt) => ({ id: attempt.id, label: attempt.name, submittedAt: attempt.submittedAt }));
  const topicTrend = aggregateTopicDifficultyTrend(
    progressRows.map((row) => ({ topic: row.topic, difficulty: row.difficulty, correct: row.correct, attemptId: row.attemptId })),
    trendAttempts,
  );
  const trendTopics = Object.keys(topicTrend);
  const teacherComments = scoredAttempts.filter((attempt) => attempt.teacherComment);

  return (
    <PageShell width="wide">
      {header}
      <div className="mt-6">
        {pendingExamCount > 0 && view === "overview" && (
          <div className="mb-4 rounded-md border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-900">
            {pendingExamCount} active Full Practice Test{pendingExamCount === 1 ? "" : "s"} assigned.{" "}
            <Link href={pageHref({ area: "mocks" })} className="font-medium underline">Open Full Practice Tests →</Link>
          </div>
        )}

        {view === "overview" && (
          <>
            <KpiGrid
              items={[
                { label: `Attempts submitted · ${areaLabel}`, value: String(scoredAttempts.length) },
                {
                  label: "Average score",
                  value: overall.percent !== null ? `${overall.percent}%` : "—",
                  className: scoreBandTextClass(overall.percent),
                  sub: overall.total ? `${overall.correct} correct of ${overall.total} questions` : undefined,
                },
                { label: "Total time", value: formatTime(sumAttemptElapsedTime(scoredAttempts)) },
                { label: "Avg question time", value: avgQuestionTime !== null ? formatTime(avgQuestionTime) : "—" },
                { label: "Pending tasks", value: String(assignments.length) },
              ]}
            />
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-base font-semibold text-gray-900">Active Practice Sets</h2>
              {weakSkills.length > 0 && (
                <Link href={pageHref({}, "performance")} className="text-xs font-medium text-blue-600 hover:underline">
                  See weak skills →
                </Link>
              )}
            </div>
            {assignments.length === 0 ? (
              <p className="text-sm text-gray-400">No active {areaLabel} practice sets.</p>
            ) : (
              <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                {assignments.map((a) => (
                  <Card key={a.id} padding="sm" className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-gray-800">{a.practiceSet.name}</p>
                      <p className="mt-0.5 text-[11px] text-gray-400">{a.practiceSet.topic.name}</p>
                      <div className="mt-1 flex items-center gap-2">
                        <StatusBadge status={a.status} />
                        {a.locked && <Badge variant="danger">Locked</Badge>}
                        {a.dueDate && <span className="text-xs text-gray-400">Due {formatDate(a.dueDate)}</span>}
                      </div>
                    </div>
                    <Link
                      href={assignHref({ topic: a.practiceSet.topicId, difficulty: a.practiceSet.difficulty }, { sets: a.practiceSetId })}
                      className="shrink-0 text-xs font-medium text-blue-600 hover:underline"
                    >
                      {a.status === "OVERDUE" ? "Reassign" : "Edit"}
                    </Link>
                  </Card>
                ))}
              </div>
            )}
          </>
        )}

        {view === "performance" && (
          <>
            <div className="mb-8">
              <PerformanceBreakdown
                title="Performance by skill and difficulty"
                rowLabel="Skill"
                dimensionLabel="difficulty"
                dimensions={difficulty ? [difficulty] : ["EASY", "MEDIUM", "HARD"]}
                summaryMetrics={aggregateDifficultyMetrics(progressRows)}
                detailMetrics={aggregateTopicDifficultyMetrics(progressRows)}
              />
            </div>

            {topicId && difficulty && trendTopics.length > 0 && trendAttempts.length > 0 && (
              <div className="mb-8">
                <TopicDifficultyTrend
                  topics={trendTopics}
                  pointsByTopic={topicTrend}
                  selectedTopic={topics.find((topic) => topic.id === topicId)?.name ?? trendTopics[0]}
                  selectedDifficulty={difficulty}
                />
              </div>
            )}

            <section className="mb-8">
              <div className="mb-3">
                <h2 className="text-base font-semibold text-gray-900">Skill performance by difficulty</h2>
                <p className="mt-0.5 text-xs text-gray-500">Lowest-accuracy skills for this student. Assign practice straight from each row.</p>
              </div>
              <Card className="overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[44rem] text-sm">
                    <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                      <tr>
                        <th className="px-4 py-3 text-left">Skill</th>
                        <th className="px-4 py-3 text-left">Difficulty</th>
                        <th className="px-4 py-3 text-right">Accuracy</th>
                        <th className="px-4 py-3 text-right">Avg question time</th>
                        <th className="px-4 py-3 text-left">Reinforcement</th>
                        <th className="px-4 py-3" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {weakSkills.map((bucket) => {
                        const pct = scorePercent(bucket.correct, bucket.total);
                        const option = assignOptionFor(bucket);
                        return (
                          <tr key={bucket.key}>
                            <td className="px-4 py-3 font-medium text-gray-800">{bucket.label}</td>
                            <td className="px-4 py-3 text-gray-500">{bucket.difficulty}</td>
                            <td className={`px-4 py-3 text-right font-medium ${scoreBandTextClass(pct)}`}>{pct}% ({bucket.correct}/{bucket.total})</td>
                            <td className="px-4 py-3 text-right text-gray-500">{bucket.timed ? formatTime(Math.round(bucket.totalTime / bucket.timed)) : "-"}</td>
                            <td className="px-4 py-3 text-gray-600">{recommendation(bucket.label, pct)}</td>
                            <td className="px-4 py-3 text-right">
                              {option.assignableIds.length > 0 ? (
                                <Link
                                  href={assignHref({ topic: bucket.topicId, difficulty: bucket.difficulty }, { domain: bucket.domainId, sets: option.assignableIds.join(",") })}
                                  className="whitespace-nowrap text-xs font-medium text-blue-600 hover:underline"
                                >
                                  Assign practice
                                </Link>
                              ) : option.pendingCount > 0 ? (
                                <Link href={pageHref({}, "overview")} className="whitespace-nowrap text-xs text-gray-400 hover:underline" title="Already assigned and not finished yet">
                                  Pending ({option.pendingCount})
                                </Link>
                              ) : null}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {weakSkills.length === 0 && (
                  <p className="py-10 text-center text-sm text-gray-500">No submitted {areaLabel.toLowerCase()} answers for this student yet.</p>
                )}
              </Card>
            </section>
          </>
        )}

        {view === "history" && (
          <>
            <Card className="mb-6 overflow-hidden">
              {scoredAttempts.length === 0 ? (
                <div className="py-10 text-center text-sm text-gray-400">No completed {areaLabel} attempts yet.</div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50">
                      <th className="px-4 py-2.5 text-left font-medium text-gray-500">Date</th>
                      <th className="px-4 py-2.5 text-left font-medium text-gray-500">Practice Set</th>
                      <th className="px-4 py-2.5 text-right font-medium text-gray-500">Score</th>
                      <th className="px-4 py-2.5 text-right font-medium text-gray-500">Elapsed</th>
                      <th className="px-4 py-2.5 text-right font-medium text-gray-500">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {scoredAttempts.map((attempt) => (
                      <tr key={attempt.id} className="hover:bg-gray-50">
                        <td className="whitespace-nowrap px-4 py-3 text-gray-500">{attempt.submittedAt ? formatDate(attempt.submittedAt) : "—"}</td>
                        <td className="px-4 py-3 font-medium text-gray-900">{attempt.name}</td>
                        <td className="px-4 py-3 text-right">
                          {attempt.percent !== null ? (
                            <>
                              <span className="font-medium">{attempt.correct}/{attempt.total}</span>
                              <span className={`ml-1 text-xs font-semibold ${scoreBandTextClass(attempt.percent)}`}>({attempt.percent}%)</span>
                            </>
                          ) : (
                            <span className="text-gray-500">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right text-gray-500">{formatTime(attempt.totalTime)}</td>
                        <td className="px-4 py-3 text-right">
                          <Link href={buildProgressHref(`/teacher/students/${studentId}/attempts/${attempt.id}`, filters)} className="text-xs text-blue-600 hover:underline">
                            View
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Card>

            {teacherComments.length > 0 && (
              <Card padding="md">
                <h3 className="mb-3 text-sm font-semibold text-gray-900">Teacher Comments</h3>
                <div className="space-y-3">
                  {teacherComments.map((entry) => (
                    <div key={entry.id} className="rounded-md border border-gray-100 bg-gray-50 px-3 py-2">
                      <div className="mb-1 flex items-center justify-between gap-3 text-xs text-gray-500">
                        <span className="font-medium text-gray-700">{entry.name}</span>
                        <span>{entry.submittedAt ? formatDate(entry.submittedAt) : "-"}</span>
                      </div>
                      <p className="text-sm text-gray-800">{entry.teacherComment}</p>
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </>
        )}
      </div>
    </PageShell>
  );
}

function KpiGrid({ items }: { items: Array<{ label: string; value: string; className?: string; sub?: string }> }) {
  return (
    <div className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
      {items.map((item) => (
        <Card key={item.label} padding="md" className="h-full">
          <p className={`text-2xl font-bold leading-none ${item.className ?? "text-gray-900"}`}>{item.value}</p>
          <p className="mt-2 text-xs text-gray-500">{item.label}</p>
          {item.sub ? <p className="mt-0.5 text-[11px] text-gray-400">{item.sub}</p> : null}
        </Card>
      ))}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const variant = status === "IN_PROGRESS" ? "warning" : status === "OVERDUE" ? "danger" : "info";
  return <Badge variant={variant}>{status.replace("_", " ")}</Badge>;
}

function recommendation(label: string, pct: number) {
  if (pct < 50) return `Re-teach ${label} and assign Easy targeted practice.`;
  if (pct < 75) return `Review mistakes in ${label} before moving difficulty.`;
  return `Monitor ${label}; assign a short reinforcement set.`;
}
