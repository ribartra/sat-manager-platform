import {
  AttemptStatusBadge,
  Breadcrumbs,
  Delta,
  InvalidatedNotice,
  PageShell,
  PracticeAttemptsTable,
  SectionHeader,
  VoidableValue,
} from "@/components/sat";
import { AreaTag } from "@/components/sat/practice-set-row";
import { ReviewQuestionCard } from "@/components/sat/review-question-card";
import { ResultFilterBar, ResultFilterEmpty, ResultFilterRoot, ResultFilterSegments } from "@/components/sat/result-filter";
import { AnswerGrid, AnswerGridLegend } from "@/components/sat/test-ui";
import { Badge } from "@/components/ui/badge";
import { difficultyBadgeVariant, difficultyLabel } from "@/lib/domain-meta";
import { practiceAreaLabel, tabFromPracticeArea, type PracticeAreaCode } from "@/lib/practice-area";
import { scoreBandTextClass } from "@/lib/score-band";
import prisma from "@/lib/prisma";
import { notFound } from "next/navigation";
import { Card } from "@/components/ui/card";
import { formatClock, formatDate, formatDuration, formatTime, relativeDay } from "@/lib/utils";
import { AttemptActions } from "./attempt-actions-client";
import { parseSnapshot, PracticeSetSnapshot, QuestionSnapshot } from "@/lib/attempt-snapshots";
import { auth } from "@/lib/auth";
import { teacherProgramEnrollmentScope } from "@/lib/program-scope";
import { summarizeAllQuestionAnswers } from "@/lib/weighted-score";
import { buildProgressHref, progressFiltersFromParams } from "@/lib/progress-filters";

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
      assignment: { include: { practiceSet: { include: { topic: { include: { domain: true } } } } } },
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
  const tries = siblings.map((t, i) => {
    const rows = t.answers.length >= total ? t.answers : [...t.answers, ...Array.from({ length: total - t.answers.length }, () => ({ answer: null, isCorrect: false }))];
    const sc = summarizeAllQuestionAnswers(rows);
    return { id: t.id, tryNumber: i + 1, submittedAt: t.submittedAt, correct: sc.correct, total: sc.total, pct: sc.percent, time: t.totalTime, status: t.status };
  });
  const thisTry = tries.find((t) => t.id === attempt.id);
  const prevTry = thisTry ? [...tries.slice(0, thisTry.tryNumber - 1)].reverse().find((t) => t.status === "SUBMITTED") : undefined;
  const delta = prevTry && prevTry.pct !== null && attempt.status === "SUBMITTED" ? pct - prevTry.pct : null;

  const ordered = orderedQuestionIds
    .map((questionId) => {
      const item = liveQuestionsById.get(questionId);
      const ans = answersByQuestion.get(questionId);
      // Historic attempts render the question as it was when answered (questionSnapshot).
      const snapshot = parseSnapshot<QuestionSnapshot>(ans?.questionSnapshot);
      const question = snapshot ?? item?.question;
      if (!question) return null;
      const options = snapshot?.options?.length ? snapshot.options : item?.question.options ?? [];
      const state: "ok" | "bad" | "blank" = !ans?.answer ? "blank" : ans.isCorrect ? "ok" : "bad";
      return { questionId, ans, question, options, state, topicName: snapshot?.topic?.name ?? item?.question.topic.name ?? "—" };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);
  const counts = {
    ok: ordered.filter((q) => q.state === "ok").length,
    bad: ordered.filter((q) => q.state === "bad").length,
    blank: ordered.filter((q) => q.state === "blank").length,
  };
  const perQuestion = attempt.totalTime && total ? Math.round(attempt.totalTime / total) : null;

  return (
    <PageShell maxWidth={1180}>
      <Breadcrumbs
        items={[
          { label: "Home", href: "/teacher" },
          { label: "Students", href: "/teacher/students" },
          { label: attempt.student.name, href: studentHref() },
          ...(area && areaTab ? [{ label: practiceAreaLabel(area), href: studentHref({ area: areaTab }) }] : []),
          { label: `Try ${thisTry?.tryNumber ?? attempt.attemptNumber}` },
        ]}
      />
      {attempt.status === "INVALIDATED" ? <InvalidatedNotice audience="teacher" /> : null}

      <ResultFilterRoot>
        <div className="mb-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <Card padding="lg">
            <div className="mb-1 flex flex-wrap items-center gap-2">
              <Badge>Practice</Badge>
              {area ? <AreaTag area={area} /> : null}
              {practiceSet ? <Badge variant={difficultyBadgeVariant(practiceSet.difficulty)}>{difficultyLabel(practiceSet.difficulty)}</Badge> : null}
              <Badge>Try {thisTry?.tryNumber ?? attempt.attemptNumber} of {Math.max(tries.length, 1)}</Badge>
              <AttemptStatusBadge status={attempt.status} />
            </div>
            <h1 className="text-xl font-semibold text-gray-900">
              {practiceSet?.topic.name ?? practiceSetSnapshot?.name ?? "Practice set"} · {first}&apos;s results
            </h1>
            <p className="mb-4 mt-1 text-xs text-gray-500">
              {attempt.submittedAt ? (
                <>Completed <b className="font-medium text-gray-700">{formatDate(attempt.submittedAt)}</b> at {formatClock(attempt.submittedAt)} ({relativeDay(attempt.submittedAt)})</>
              ) : "Not finished"}
              {attempt.assignment?.dueDate ? <> · Due {formatDate(attempt.assignment.dueDate)}</> : null}
              {attempt.pauses.length > 0 ? ` · Paused ${attempt.pauses.length} ${attempt.pauses.length === 1 ? "time" : "times"} (${formatTime(pauseSeconds)})` : ""}
            </p>
            <div className="grid gap-5 md:grid-cols-[auto_1fr] md:items-center">
              <div>
                <p className={`text-5xl font-bold leading-none ${scoreBandTextClass(pct)}`}>
                  <VoidableValue status={attempt.status}>{pct}%</VoidableValue>
                </p>
                <p className="mt-1 text-sm text-gray-600"><VoidableValue status={attempt.status}>{correct} of {total} correct</VoidableValue></p>
                {delta !== null ? <Delta value={delta} suffix={`vs. try ${prevTry!.tryNumber} (${prevTry!.pct}%)`} className="mt-1 block" /> : null}
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
          </Card>
          <Card padding="md" className="space-y-3">
            <h2 className="text-sm font-semibold text-gray-900">Teacher actions</h2>
            <p className="text-xs text-gray-500">{tries.length} attempt{tries.length === 1 ? "" : "s"} recorded. Every try is kept, even when you let the student start again.</p>
            <AttemptActions attemptId={attempt.id} initialComment={attempt.teacherComment} status={attempt.status} />
          </Card>
        </div>

        {attempt.teacherComment && (
          <Card variant="info" padding="md" className="mb-6 text-sm text-blue-900">
            <p className="mb-1 font-medium">Comment for {first}</p>
            <p>{attempt.teacherComment}</p>
          </Card>
        )}

        {tries.length > 0 ? (
          <section className="mb-6">
            <SectionHeader title="All attempts for this set" description="Click a try to see it." />
            <PracticeAttemptsTable rows={tries} viewingId={attempt.id} hrefFor={(id) => buildProgressHref(`/teacher/students/${studentId}/attempts/${id}`, filters)} />
          </section>
        ) : null}

        {ordered.length > 0 ? (
          <Card padding="md" className="mb-6">
            <SectionHeader size="sm" title="Answers at a glance" description="Each square is a question. Click one to see it." action={<ResultFilterSegments counts={counts} />} />
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
