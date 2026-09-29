import { PageShell, PracticeAreaTabs } from "@/components/sat";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";
import type { ReactNode } from "react";
import { formatDate, formatTime, scorePercent } from "@/lib/utils";
import { scoreBandTextClass } from "@/lib/score-band";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ProgressFilters } from "@/components/progress-filters";
import { PerformanceBreakdown } from "@/components/performance-breakdown";
import { TopicDifficultyTrend } from "@/components/topic-difficulty-trend";
import { MockSectionChart } from "@/components/progress-charts";
import { Hint, InfoHint } from "@/components/hint";
import { ChevronLeft, ClipboardList, Eye, FileDown, Pencil, Plus } from "lucide-react";
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

// One page per student (replaces the former Student Analytics and Individual Report views).
// Everything is on a single screen: KPI strip on top; performance + weak skills (with one-click
// "Assign practice") in the main column; active assignments, recent attempts and teacher
// comments in the side column. The printable report is the "Download PDF" action.
// Taxonomy note: the `topic` param / Topic table is the SKILL level (Section → Domain → Skill).

interface PageProps {
  params: Promise<{ studentId: string }>;
  searchParams: Promise<{ area?: string; topic?: string; difficulty?: string; from?: string; to?: string }>;
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

const RECENT_ATTEMPTS = 6;

export default async function StudentPage({ params, searchParams }: PageProps) {
  const { studentId } = await params;
  const query = await searchParams;
  const filters = progressFiltersFromParams(query);
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

  const [student, roster, skills] = await Promise.all([
    prisma.user.findFirst({
      where: { id: studentId, ...studentWhere },
      include: {
        groups: { include: { group: true } },
        programEnrollments: { include: { program: true }, where: { active: true, status: "APPROVED" } },
      },
    }),
    prisma.user.findMany({ where: studentWhere, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    practiceArea
      ? prisma.topic.findMany({
          where: { domain: { practiceArea } },
          select: { id: true, name: true, domain: { select: { name: true } } },
          orderBy: { name: "asc" },
        })
      : Promise.resolve([]),
  ]);
  if (!student) notFound();

  const pdfParams = new URLSearchParams({
    areas: area === "math" ? "mathematics" : area === "reading" || area === "writing" ? area : "mathematics,reading,writing",
  });
  for (const key of ["topic", "difficulty", "from", "to"] as const) {
    if (filters[key]) pdfParams.set(key, filters[key]!);
  }
  const pdfHref = `/api/reports/students/${studentId}/pdf?${pdfParams.toString()}`;
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
        <Hint label="Printable progress report (PDF) for the area and filters currently selected — e.g. to share with the parent.">
          <Link href={pdfHref} className={secondaryButton}>
            <FileDown size={14} /> PDF report
          </Link>
        </Hint>
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
        topics={skills.map((skill) => ({ id: skill.id, name: skill.name, group: skill.domain.name }))}
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
        <KpiStrip
          items={[
            { label: "Exams completed", value: String(examAttempts.length), hint: "Submitted Full Practice Tests in the selected dates." },
            { label: "Latest total", value: String(latest?.totalScore ?? "—"), className: "text-[var(--sat-area-mocks)]", hint: "SAT total (400–1600) of the most recent exam." },
            { label: "Latest R&W", value: String(latest?.rwScore ?? "—"), hint: "Reading & Writing section score (200–800) of the most recent exam." },
            { label: "Latest Math", value: String(latest?.mathScore ?? "—"), hint: "Math section score (200–800) of the most recent exam." },
            { label: "Pending exams", value: String(examAssignments.length), hint: "Assigned Full Practice Tests not submitted yet (pending, in progress or overdue)." },
          ]}
        />
        <div className="grid gap-6 lg:grid-cols-3">
          <div id="performance" className="min-w-0 space-y-6 lg:col-span-2">
            {examAttempts.length === 0 ? (
              <Card padding="lg" className="py-12 text-center text-sm text-gray-400">No submitted Full Practice Tests for this student yet.</Card>
            ) : (
              <>
                <MockSectionChart metrics={mockMetrics} />
                <PerformanceBreakdown
                  title="Performance by section and module"
                  rowLabel="Section"
                  dimensionLabel="module"
                  dimensions={[...new Set(mockRows.map((row) => row.difficulty))]}
                  summaryMetrics={aggregateDifficultyMetrics(mockRows)}
                  detailMetrics={aggregateTopicDifficultyMetrics(mockRows)}
                />
              </>
            )}
          </div>
          <aside className="min-w-0 space-y-6">
            <SidePanel title="Active Full Practice Tests" count={examAssignments.length} empty="No active Full Practice Tests.">
              {examAssignments.map((a) => (
                <li key={a.id} className="flex items-start justify-between gap-3 px-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-gray-800">{a.test.name}</p>
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
            <SidePanel title="Exam history" count={examAttempts.length} empty="No completed Full Practice Tests yet.">
              {examAttempts.map((exam) => (
                <li key={exam.id} className="flex items-center justify-between gap-3 px-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-gray-800">{exam.test.name}</p>
                    <p className="text-[11px] text-gray-400">{exam.submittedAt ? formatDate(exam.submittedAt) : "—"} · R&amp;W {exam.rwScore ?? "—"} · Math {exam.mathScore ?? "—"}</p>
                  </div>
                  <span className="shrink-0 text-sm font-semibold text-gray-900" title="SAT total">{exam.totalScore ?? "—"}</span>
                </li>
              ))}
            </SidePanel>
          </aside>
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

  // Question rows use the attempt snapshot (what the student actually saw), filtered by skill/difficulty.
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
  const setsForWeakSkills = weakTopicIds.length > 0
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
  const attemptRow = (attempt: (typeof scoredAttempts)[number]) => (
    <li key={attempt.id} className="flex items-center justify-between gap-3 px-3 py-2">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-gray-800" title={attempt.name}>{shortSetName(attempt.name)}</p>
        <p className="text-[11px] text-gray-400">
          {attempt.submittedAt ? formatDate(attempt.submittedAt) : "—"} · {formatTime(attempt.totalTime)} spent
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        {attempt.percent !== null ? (
          <span className={`text-sm font-semibold ${scoreBandTextClass(attempt.percent)}`} title={`${attempt.correct} correct of ${attempt.total} questions`}>
            {attempt.percent}%
          </span>
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
      {pendingExamCount > 0 && (
        <div className="mt-3 rounded-md border border-orange-200 bg-orange-50 px-3 py-2 text-sm text-orange-900">
          {pendingExamCount} active Full Practice Test{pendingExamCount === 1 ? "" : "s"} assigned.{" "}
          <Link href={buildProgressHref(`/teacher/students/${studentId}`, filters, { area: "mocks" })} className="font-medium underline">
            Open Full Practice Tests →
          </Link>
        </div>
      )}
      <KpiStrip
        items={[
          { label: `Attempts · ${areaLabel}`, value: String(scoredAttempts.length), hint: `Submitted ${areaLabel} practice sets matching the filters.` },
          {
            label: "Average score",
            value: overall.percent !== null ? `${overall.percent}%` : "—",
            className: scoreBandTextClass(overall.percent),
            sub: overall.total ? `${overall.correct} of ${overall.total} correct` : undefined,
            hint: "Correct answers ÷ all questions of the submitted attempts. Blank answers count as incorrect.",
          },
          { label: "Total time", value: formatTime(sumAttemptElapsedTime(scoredAttempts)), hint: "Time spent across all submitted attempts." },
          { label: "Avg question time", value: avgQuestionTime !== null ? formatTime(avgQuestionTime) : "—", hint: "Average time per answered question." },
          { label: "Pending sets", value: String(assignments.length), hint: `Assigned ${areaLabel} practice sets not finished yet (pending, in progress or overdue).` },
        ]}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div id="performance" className="min-w-0 space-y-6 lg:col-span-2">
          <PerformanceBreakdown
            title="Performance by skill and difficulty"
            rowLabel="Skill"
            dimensionLabel="difficulty"
            dimensions={difficulty ? [difficulty] : ["EASY", "MEDIUM", "HARD"]}
            summaryMetrics={aggregateDifficultyMetrics(progressRows)}
            detailMetrics={aggregateTopicDifficultyMetrics(progressRows)}
          />

          {topicId && difficulty && trendTopics.length > 0 && trendAttempts.length > 0 && (
            <TopicDifficultyTrend
              topics={trendTopics}
              pointsByTopic={topicTrend}
              selectedTopic={skills.find((skill) => skill.id === topicId)?.name ?? trendTopics[0]}
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
                    {weakSkills.map((bucket) => {
                      const pct = scorePercent(bucket.correct, bucket.total);
                      const option = assignOptionFor(bucket);
                      return (
                        <tr key={bucket.key}>
                          <td className="px-3 py-2">
                            <span className="font-medium text-gray-800">{bucket.label}</span>
                            <span className="ml-2 rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-gray-600">{bucket.difficulty}</span>
                          </td>
                          <td className={`whitespace-nowrap px-3 py-2 text-right font-medium ${scoreBandTextClass(pct)}`}>{pct}% <span className="text-xs font-normal text-gray-400">({bucket.correct}/{bucket.total})</span></td>
                          <td className="px-3 py-2 text-right text-gray-500">{bucket.timed ? formatTime(Math.round(bucket.totalTime / bucket.timed)) : "-"}</td>
                          <td className="px-3 py-2 text-xs text-gray-600">{recommendation(pct)}</td>
                          <td className="px-3 py-2 text-right">
                            {option.assignableIds.length > 0 ? (
                              <Hint label={`Opens the assign form filtered to ${bucket.label} · ${bucket.difficulty} with the ${option.assignableIds.length} available set${option.assignableIds.length === 1 ? "" : "s"} preselected (not assigned yet, completed or overdue).`}>
                                <Link
                                  href={assignHref({ topic: bucket.topicId, difficulty: bucket.difficulty }, { domain: bucket.domainId, sets: option.assignableIds.join(",") })}
                                  className="whitespace-nowrap text-xs font-medium text-blue-600 hover:underline"
                                >
                                  Assign practice
                                </Link>
                              </Hint>
                            ) : option.pendingCount > 0 ? (
                              <Hint label="Every set of this skill and difficulty is already assigned and not finished yet. See it under Active practice sets.">
                                <a href="#active-sets" className="whitespace-nowrap text-xs text-gray-400 hover:underline">
                                  Pending ({option.pendingCount})
                                </a>
                              </Hint>
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
        </div>

        <aside className="min-w-0 space-y-6">
          <SidePanel id="active-sets" title="Active practice sets" count={assignments.length} empty={`No active ${areaLabel} practice sets.`}>
            {assignments.map((a) => (
              <li key={a.id} className="flex items-start justify-between gap-3 px-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-gray-800" title={a.practiceSet.name}>{shortSetName(a.practiceSet.name)}</p>
                  <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                    <StatusBadge status={a.status} />
                    {a.locked && <Badge variant="danger">Locked</Badge>}
                    {a.dueDate && <span className="text-[11px] text-gray-400">Due {formatDate(a.dueDate)}</span>}
                  </div>
                </div>
                <Hint label={a.status === "OVERDUE" ? "Open it again for the student, optionally with a new due date." : "Change due date, unlock date or feedback mode. The student's progress is kept."}>
                  <Link
                    href={assignHref({ topic: a.practiceSet.topicId, difficulty: a.practiceSet.difficulty }, { sets: a.practiceSetId })}
                    className="shrink-0 text-xs font-medium text-blue-600 hover:underline"
                  >
                    {a.status === "OVERDUE" ? "Reassign" : "Edit"}
                  </Link>
                </Hint>
              </li>
            ))}
          </SidePanel>

          <SidePanel title="Recent attempts" count={scoredAttempts.length} empty={`No completed ${areaLabel} attempts yet.`}>
            {scoredAttempts.slice(0, RECENT_ATTEMPTS).map(attemptRow)}
            {scoredAttempts.length > RECENT_ATTEMPTS && (
              <li>
                <details className="group">
                  <summary className="cursor-pointer list-none px-3 py-2 text-xs font-medium text-blue-600 hover:underline">
                    Show all {scoredAttempts.length} attempts
                  </summary>
                  <ul className="divide-y divide-gray-100 border-t border-gray-100">
                    {scoredAttempts.slice(RECENT_ATTEMPTS).map(attemptRow)}
                  </ul>
                </details>
              </li>
            )}
          </SidePanel>

          {teacherComments.length > 0 && (
            <SidePanel title="Teacher Comments" count={teacherComments.length} empty="">
              {teacherComments.map((entry) => (
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

function SidePanel({ id, title, count, empty, children }: { id?: string; title: string; count: number; empty: string; children: ReactNode }) {
  return (
    <section id={id}>
      <h2 className="mb-2 flex items-center justify-between text-sm font-semibold text-gray-900">
        {title}
        <span className="text-xs font-normal text-gray-400">{count}</span>
      </h2>
      <Card className="overflow-hidden">
        {count === 0 ? <p className="px-3 py-4 text-sm text-gray-400">{empty}</p> : <ul className="divide-y divide-gray-100">{children}</ul>}
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

function recommendation(pct: number) {
  if (pct < 50) return "Re-teach, then assign Easy targeted practice.";
  if (pct < 75) return "Review mistakes before moving up in difficulty.";
  return "Monitor; a short reinforcement set is enough.";
}

/** "Advanced Math - Nonlinear Functions - EASY" -> "Nonlinear Functions · EASY" (domain is implied by the page). */
function shortSetName(name: string) {
  const parts = name.split(" - ").map((part) => part.trim()).filter(Boolean);
  return parts.length >= 3 ? parts.slice(1).join(" · ") : name;
}
