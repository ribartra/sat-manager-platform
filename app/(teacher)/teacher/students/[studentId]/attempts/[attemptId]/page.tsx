import Link from "next/link";
import { ContextTag } from "@/components/sat/attempts-table";
import {
  AttemptStatusBadge,
  Breadcrumbs,
  Delta,
  InvalidatedNotice,
  PageHeader,
  PageShell,
  SectionHeader,
  VoidableValue,
} from "@/components/sat";
import { AreaTag } from "@/components/sat/practice-set-row";
import { ReviewQuestionCard } from "@/components/sat/review-question-card";
import { ResultFilterBar, ResultFilterEmpty, ResultFilterRoot, ResultFilterSegments } from "@/components/sat/result-filter";
import { AnswerGrid, AnswerGridLegend } from "@/components/sat/test-ui";
import { Badge } from "@/components/ui/badge";
import { difficultyBadgeVariant, difficultyLabel, explanationsInPlayerLabel } from "@/lib/domain-meta";
import { practiceAreaLabel, tabFromPracticeArea, type PracticeAreaCode } from "@/lib/practice-area";
import { scoreBandTextClass } from "@/lib/score-band";
import prisma from "@/lib/prisma";
import { notFound } from "next/navigation";
import { Card } from "@/components/ui/card";
import { formatClock, formatDate, formatDuration, formatTime, relativeDay } from "@/lib/utils";
import { PAGE_TITLE_CLASS } from "@/components/sat/page-shell";
import { AttemptHeaderActions } from "../../attempt-header-actions";
import { TryNavigator } from "@/components/sat/try-navigator";
import { practiceSetTitle } from "@/lib/attempt-groups";
import { parseSnapshot, PracticeSetSnapshot, QuestionSnapshot } from "@/lib/attempt-snapshots";
import { auth } from "@/lib/auth";
import { teacherProgramEnrollmentScope } from "@/lib/program-scope";
import { summarizeAllQuestionAnswers } from "@/lib/weighted-score";
import { liveImagesOf } from "@/lib/question-media";
import { buildProgressHref, progressFiltersFromParams } from "@/lib/progress-filters";
import { historyHref } from "@/lib/history-params";

interface PageProps {
  params: Promise<{ studentId: string; attemptId: string }>;
  searchParams: Promise<{ area?: string; topic?: string; difficulty?: string; from?: string; to?: string }>;
}

export default async function TeacherAttemptDetailPage({ params, searchParams }: PageProps) {
  const { studentId, attemptId } = await params;
  const filters = progressFiltersFromParams(await searchParams);
  const session = await auth();
  const programScope =
    session?.user.role === "TEACHER"
      ? teacherProgramEnrollmentScope(session.user.id)
      : undefined;

  const attempt = await prisma.attempt.findFirst({
    where: {
      id: attemptId,
      studentId,
      ...(programScope ? { student: { programEnrollments: programScope } } : {}),
    },
    include: {
      student: true,
      answers: { include: { question: { include: { topic: true } } } },
      assignment: { include: { practiceSet: { include: { source: { select: { name: true } }, topic: { include: { domain: true } } } } } },
      pauses: true,
    },
  });

  if (!attempt) notFound();
  const practiceSetSnapshot = parseSnapshot<PracticeSetSnapshot>(attempt.practiceSetSnapshot);

  const psQuestions = await prisma.practiceSetQuestion.findMany({
    where: { practiceSetId: attempt.practiceSetId },
    include: { question: { include: { options: { orderBy: { label: "asc" } }, topic: true } } },
    orderBy: { order: "asc" },
  });
  const answersByQuestion = new Map(attempt.answers.map((a) => [a.questionId, a]));
  const orderedQuestionIds = practiceSetSnapshot?.questions?.length
    ? practiceSetSnapshot.questions.map((question) => question.id)
    : psQuestions.map((item) => item.questionId);
  const liveQuestionsById = new Map(psQuestions.map((item) => [item.questionId, item]));
  const scoreRows = attempt.answers.length >= psQuestions.length
    ? attempt.answers
    : [...attempt.answers, ...Array.from({ length: psQuestions.length - attempt.answers.length }, () => ({ answer: null, isCorrect: false }))];
  const score = summarizeAllQuestionAnswers(scoreRows);
  const correct = score.correct;
  const total = score.total;
  const pct = score.percent ?? 0;
  const pauseSeconds = attempt.pauses.reduce((sum, pause) => sum + (pause.durationSeconds ?? 0), 0);
  const first = attempt.student.name.split(" ")[0];
  const practiceSet = attempt.assignment?.practiceSet;
  const area = (practiceSet?.topic.domain.practiceArea ?? null) as PracticeAreaCode | null;
  const areaTab = area ? tabFromPracticeArea(area) : null;
  const studentHref = (extra?: Record<string, string>) => buildProgressHref(`/teacher/students/${studentId}`, filters, extra);

  // Every try of this assignment (the one being viewed is highlighted).
  const siblings = attempt.assignmentId
    ? await prisma.attempt.findMany({
        where: { assignmentId: attempt.assignmentId, studentId, status: { in: ["SUBMITTED", "INVALIDATED"] } },
        orderBy: { startedAt: "asc" },
        select: { id: true, status: true, submittedAt: true, totalTime: true, attemptNumber: true, answers: { select: { answer: true, isCorrect: true } } },
      })
    : [];
  // Classroom work is never scored (pendiente-p2.md): no %, no correct count; what was answered.
  const classroom = attempt.assignment?.context === "CLASSROOM";
  const tries = siblings.map((t, i) => {
    const rows = t.answers.length >= total ? t.answers : [...t.answers, ...Array.from({ length: total - t.answers.length }, () => ({ answer: null, isCorrect: false }))];
    const sc = summarizeAllQuestionAnswers(rows);
    const answered = t.answers.filter((a) => a.answer && a.answer.trim()).length;
    return { id: t.id, tryNumber: i + 1, submittedAt: t.submittedAt, correct: sc.correct, total: sc.total, pct: classroom ? null : sc.percent, time: t.totalTime, status: t.status, answered };
  });
  const thisTry = tries.find((t) => t.id === attempt.id);
  const tryNumber = thisTry?.tryNumber ?? attempt.attemptNumber;
  const tryCount = Math.max(tries.length, 1);
  const prevTry = thisTry ? [...tries.slice(0, thisTry.tryNumber - 1)].reverse().find((t) => t.status === "SUBMITTED") : undefined;
  const delta = !classroom && prevTry && prevTry.pct !== null && attempt.status === "SUBMITTED" ? pct - prevTry.pct : null;

  const ordered = orderedQuestionIds
    .map((questionId) => {
      const item = liveQuestionsById.get(questionId);
      const ans = answersByQuestion.get(questionId);
      // Historic attempts render the question as it was when answered (questionSnapshot).
      const snapshot = parseSnapshot<QuestionSnapshot>(ans?.questionSnapshot);
      const question = snapshot ?? item?.question;
      if (!question) return null;
      // Text and options as answered (snapshot); images from the live bank question (only referenced).
      const media = liveImagesOf(item?.question, snapshot?.options?.length ? snapshot.options : item?.question.options ?? []);
      const options = media.options;
      const state: "ok" | "bad" | "blank" = !ans?.answer ? "blank" : ans.isCorrect ? "ok" : "bad";
      return { questionId, ans, question: { ...question, imageUrl: media.imageUrl }, options, state, topicName: snapshot?.topic?.name ?? item?.question.topic.name ?? "—" };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);
  const counts = {
    ok: ordered.filter((q) => q.state === "ok").length,
    bad: ordered.filter((q) => q.state === "bad").length,
    blank: ordered.filter((q) => q.state === "blank").length,
  };
  const perQuestion = attempt.totalTime && total ? Math.round(attempt.totalTime / total) : null;

  return (
    <PageShell>
      <Breadcrumbs
        items={[
          { label: "Home", href: "/teacher" },
          { label: "Students", href: "/teacher/students" },
          { label: attempt.student.name, href: studentHref() },
          ...(area && areaTab ? [{ label: practiceAreaLabel(area), href: studentHref({ area: areaTab }) }] : []),
          // Source › <Practice set (Level)> › Try M of N — the same pattern as a Test attempt.
          ...(practiceSet?.source ? [{ label: practiceSet.source.name }] : []),
          {
            label: practiceSetTitle(practiceSet?.name ?? practiceSetSnapshot?.name ?? "Practice set", practiceSet?.difficulty),
            href: practiceSet && areaTab ? `${studentHref({ area: areaTab, topic: practiceSet.topicId, difficulty: practiceSet.difficulty })}#performance` : undefined,
          },
          { label: `Try ${tryNumber} of ${tryCount}` },
        ]}
      />
      {attempt.status === "INVALIDATED" ? <InvalidatedNotice audience="teacher" /> : null}

      {/* Header: title on the left, actions top right (same slot and style as the student profile). */}
      <PageHeader
        eyebrow={
          <>
            <Badge>Practice</Badge>
            {area ? <AreaTag area={area} /> : null}
            {practiceSet ? <Badge variant={difficultyBadgeVariant(practiceSet.difficulty)}>{difficultyLabel(practiceSet.difficulty)}</Badge> : null}
            <AttemptStatusBadge status={attempt.status} />
            {tries.length > 1 ? (
              <Link
                href={historyHref({
                  student: studentId,
                  area: areaTab === "math" || areaTab === "reading" || areaTab === "writing" ? areaTab : undefined,
                  skill: practiceSet?.topicId,
                  difficulty: practiceSet?.difficulty,
                  set: attempt.practiceSetId,
                  // Every try (in progress and not counted too), not only the completed ones.
                  status: "all",
                })}
                className="text-xs font-medium text-[var(--sat-primary)] hover:underline"
              >
                All tries in History →
              </Link>
            ) : null}
          </>
        }
        title={
          <>
            <h1 className={PAGE_TITLE_CLASS}>
              {practiceSet && areaTab ? (
                // The skill opens this student's area tab filtered by the skill and level (performance section).
                <Link
                  href={`${studentHref({ area: areaTab, topic: practiceSet.topicId, difficulty: practiceSet.difficulty })}#performance`}
                  className="hover:text-[var(--sat-primary)] hover:underline"
                  title={`${first}'s ${practiceSet.topic.name} results`}
                >
                  {practiceSet.topic.name}
                </Link>
              ) : (
                practiceSet?.topic.name ?? practiceSetSnapshot?.name ?? "Practice set"
              )}{" "}
              · {first}&apos;s results
            </h1>
            <div className="mt-2">
              <TryNavigator
                current={tryNumber}
                tries={tries.map((t) => ({
                  number: t.tryNumber,
                  href: buildProgressHref(`/teacher/students/${studentId}/attempts/${t.id}`, filters, areaTab ? { area: areaTab } : undefined),
                  detail: [t.submittedAt ? formatDate(t.submittedAt) : null, t.pct !== null ? `${t.pct}%` : classroom ? `${t.answered} of ${t.total} answered` : null].filter(Boolean).join(" · "),
                  invalidated: t.status === "INVALIDATED",
                }))}
              />
            </div>
            {practiceSet ? (
              <p className="mt-0.5 text-xs text-gray-500">
                Practice set:{" "}
                <Link href={`/teacher/practice-sets/${practiceSet.id}/preview`} className="font-medium text-[var(--sat-primary)] hover:underline">
                  {practiceSet.name}
                </Link>
                {practiceSet.source ? <> · Source: <b className="font-medium text-gray-700">{practiceSet.source.name}</b></> : null}
              </p>
            ) : null}
            <p className="mt-1 text-xs text-gray-500">
              {attempt.submittedAt ? (
                <>Completed <b className="font-medium text-gray-700">{formatDate(attempt.submittedAt)}</b> at {formatClock(attempt.submittedAt)} ({relativeDay(attempt.submittedAt)})</>
              ) : "Not finished"}
              {attempt.assignment?.dueDate ? <> · Due {formatDate(attempt.assignment.dueDate)}</> : null}
              {attempt.pauses.length > 0 ? ` · Paused ${attempt.pauses.length} ${attempt.pauses.length === 1 ? "time" : "times"} (${formatTime(pauseSeconds)})` : ""}
              {` · ${explanationsInPlayerLabel(attempt.showExplanations ?? attempt.assignment?.showExplanations)}`}
            </p>
          </>
        }
        actions={
          <AttemptHeaderActions
            studentId={studentId}
            studentName={attempt.student.name}
            backHref={studentHref(areaTab ? { area: areaTab } : undefined)}
            attempt={{ id: attempt.id, kind: "practice", status: attempt.status }}
            report={{ area: (areaTab ?? "math") as "math" | "reading" | "writing" }}
          />
        }
      />

      <ResultFilterRoot>
        <div className="mb-6">
          <Card padding="lg">
            {classroom ? (
              <div>
                <p className="flex flex-wrap items-center gap-2 text-sm text-gray-700">
                  <ContextTag context="CLASSROOM" /> Work done in class: not scored and never counted in results or reports.
                </p>
                <p className="mt-2 text-sm text-gray-700">
                  {first} answered <b>{total - counts.blank} of {total}</b> questions{counts.blank ? <> and left <b>{counts.blank} blank</b></> : null}.
                </p>
                <p className="mt-1 text-xs text-gray-500">
                  {attempt.totalTime ? <>{formatDuration(attempt.totalTime)} total{perQuestion ? ` · ${formatDuration(perQuestion)} per question on average` : ""}</> : null}
                </p>
              </div>
            ) : (
            <div className="grid gap-5 md:grid-cols-[auto_1fr] md:items-center">
              <div>
                <p className={`text-5xl font-bold leading-none ${scoreBandTextClass(pct)}`}>
                  <VoidableValue status={attempt.status}>{pct}%</VoidableValue>
                </p>
                <p className="mt-1 text-sm text-gray-600"><VoidableValue status={attempt.status}>{correct} of {total} correct</VoidableValue></p>
                {delta !== null ? <Delta value={delta} unit="%" suffix={`vs. try ${prevTry!.tryNumber} (${prevTry!.pct}%)`} className="mt-1 block" /> : null}
              </div>
              <div>
                <p className="text-sm text-gray-700">
                  {first} answered <b className="text-green-700">{counts.ok} correctly</b>, <b className="text-red-600">{counts.bad} incorrectly</b> and left{" "}
                  <b className="text-gray-600">{counts.blank} blank</b>.
                </p>
                <div className="mt-1.5"><ResultFilterBar counts={counts} /></div>
                <p className="mt-1 text-xs text-gray-500">
                  Click a colour to see only those questions.{" "}
                  {attempt.totalTime ? <>{formatDuration(attempt.totalTime)} total{perQuestion ? ` · ${formatDuration(perQuestion)} per question on average` : ""}</> : null}
                </p>
              </div>
            </div>
            )}
          </Card>
        </div>

        {attempt.teacherComment && (
          <Card variant="info" padding="md" className="mb-6 text-sm text-blue-900">
            <p className="mb-1 font-medium">Comment for {first}</p>
            <p>{attempt.teacherComment}</p>
          </Card>
        )}

        {ordered.length > 0 ? (
          <Card padding="md" className="mb-6">
            <SectionHeader size="sm" title="Answers at a glance" description="Each square is a question. Click one to see it." action={<ResultFilterSegments counts={counts} hideCounts={classroom} />} />
            <div className="mt-2">
              <AnswerGrid idPrefix="q-" items={ordered.map((q) => ({ state: q.state }))} />
            </div>
            <AnswerGridLegend />
          </Card>
        ) : null}

        <section>
          <h2 className="mb-3 text-base font-semibold text-gray-900">Question by question</h2>
          <ResultFilterEmpty counts={counts} />
          <div className="space-y-4">
            {ordered.map((q, index) => (
              <div key={q.questionId} data-q-state={q.state}>
                <ReviewQuestionCard
                  id={`q-${index + 1}`}
                  number={index + 1}
                  question={{ ...q.question, options: q.options, imageUrl: q.question.imageUrl ?? null }}
                  answer={q.ans?.answer ?? null}
                  isCorrect={Boolean(q.ans?.isCorrect)}
                  timeSpent={q.ans?.timeSpent}
                  blankNote={`${first} left this question blank. Blank answers count as incorrect.`}
                  tags={
                    <>
                      <Badge variant={difficultyBadgeVariant(q.question.difficulty)}>{difficultyLabel(q.question.difficulty)}</Badge>
                      <span>{q.topicName}</span>
                    </>
                  }
                />
              </div>
            ))}
          </div>
        </section>
      </ResultFilterRoot>
    </PageShell>
  );
}
