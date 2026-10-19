import { Delta, InvalidatedNotice, PageShell, PracticeAttemptsTable, SectionHeader, VoidableValue } from "@/components/sat";
import { ReviewQuestionCard } from "@/components/sat/review-question-card";
import { ResultFilterBar, ResultFilterEmpty, ResultFilterRoot, ResultFilterSegments } from "@/components/sat/result-filter";
import { Button } from "@/components/ui/button";
import { parseEliminatedOptions } from "@/lib/answer-review-meta";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { formatClock, formatDate, formatDuration } from "@/lib/utils";
import { shortSetName } from "@/lib/student-report";
import { scoreBandTextClass } from "@/lib/score-band";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { RotateCcw } from "lucide-react";
import { parseSnapshot, PracticeSetSnapshot, QuestionSnapshot } from "@/lib/attempt-snapshots";
import { difficultyBadgeVariant, difficultyLabel } from "@/lib/domain-meta";
import { isAnsweredAnswer, summarizeAllQuestionAnswers } from "@/lib/weighted-score";
import { Alert } from "@/components/sat/alert";
import { Breadcrumbs } from "@/components/sat/breadcrumbs";
import { AreaTag } from "@/components/sat/practice-set-row";
import { AnswerGrid, AnswerGridLegend } from "@/components/sat/test-ui";
import { tabFromPracticeArea, type PracticeAreaCode } from "@/lib/practice-area";
import { loadStudentPractice, sortPracticeSets } from "@/lib/student-practice";
import { relativeDay } from "@/lib/utils";

interface PageProps {
  params: Promise<{ attemptId: string }>;
  searchParams: Promise<{ area?: string; topic?: string; difficulty?: string; from?: string; to?: string; new?: string }>;
}

export default async function ResultsPage({ params, searchParams }: PageProps) {
  const { attemptId } = await params;
  const session = await auth();
  if (!session) redirect("/login");
  const userId = session.user.id;
  const query = await searchParams;
  const returnQuery = new URLSearchParams();
  for (const key of ["area", "topic", "difficulty", "from", "to"] as const) {
    if (query[key]) returnQuery.set(key, query[key]!);
  }
  const historyHref = returnQuery.toString() ? `/student/history?${returnQuery.toString()}` : "/student/history";

  const attempt = await prisma.attempt.findFirst({
    where: { id: attemptId, studentId: userId, status: { in: ["SUBMITTED", "INVALIDATED"] } },
    include: {
      answers: {
        include: {
          question: {
            include: {
              options: { orderBy: { label: "asc" } },
              topic: { include: { domain: true } },
            },
          },
        },
      },
      assignment: {
        include: {
          practiceSet: { include: { topic: { include: { domain: { include: { section: true } } } } } },
        },
      },
      pauses: true,
    },
  });

  if (!attempt) notFound();

  const practiceSet = attempt.assignment?.practiceSet;
  const practiceSetSnapshot = parseSnapshot<PracticeSetSnapshot>(attempt.practiceSetSnapshot);
  const psQuestions = await prisma.practiceSetQuestion.findMany({
    where: { practiceSetId: attempt.practiceSetId },
    orderBy: { order: "asc" },
  });

  const snapshotQuestionOrder = practiceSetSnapshot?.questions?.map((question) => question.id) ?? [];
  const totalQuestions = snapshotQuestionOrder.length || psQuestions.length;
  const scoreRows = attempt.answers.length >= totalQuestions
    ? attempt.answers
    : [...attempt.answers, ...Array.from({ length: totalQuestions - attempt.answers.length }, () => ({ answer: null, isCorrect: false }))];
  const score = summarizeAllQuestionAnswers(scoreRows);
  const correct = score.correct;
  const answeredTotal = attempt.answers.filter(isAnsweredAnswer).length;
  const incorrect = attempt.answers.filter((a) => a.answer?.trim() && !a.isCorrect).length;
  const unanswered = Math.max(0, totalQuestions - answeredTotal);
  const pct = score.percent ?? 0;
  const completedPauses = attempt.pauses.filter((pause) => pause.durationSeconds !== null);
  const pauseSeconds = completedPauses.reduce((sum, pause) => sum + (pause.durationSeconds ?? 0), 0);

  const explanationVisibility =
    practiceSetSnapshot?.explanationVisibility ?? practiceSet?.explanationVisibility ?? "HIDDEN";
  const canRevealSolutions =
    explanationVisibility === "IMMEDIATE" ||
    (explanationVisibility === "AFTER_FINISH" && attempt.status === "SUBMITTED");

  const answersMap: Record<string, typeof attempt.answers[0]> = {};
  attempt.answers.forEach((a) => { answersMap[a.questionId] = a; });

  const orderedQuestionIds = snapshotQuestionOrder.length
    ? snapshotQuestionOrder
    : psQuestions.map((psq) => psq.questionId);
  const orderedAnswers = orderedQuestionIds.map((questionId) => answersMap[questionId]).filter(Boolean);

  const displayPct = pct;
  const practiceArea = (practiceSet?.topic.domain.practiceArea ?? null) as PracticeAreaCode | null;
  const areaTab = practiceArea ? tabFromPracticeArea(practiceArea) : null;
  const allPractice = await loadStudentPractice(userId);
  const thisSet = attempt.assignmentId ? allPractice.find((p) => p.assignmentId === attempt.assignmentId) : undefined;
  const tries = thisSet?.tries ?? [];
  const thisTry = tries.find((t) => t.id === attempt.id);
  const prevTry = thisTry ? tries[thisTry.tryNumber - 2] : undefined;
  const delta = prevTry && prevTry.pct !== null ? displayPct - prevTry.pct : null;
  const nextAssignment = sortPracticeSets(allPractice.filter((p) => p.state !== "done" && p.assignmentId !== attempt.assignmentId && !p.locked))[0];
  const perQuestion = attempt.totalTime && totalQuestions ? Math.round(attempt.totalTime / totalQuestions) : null;
  const tryAgainHref = attempt.assignmentId ? `/student/practice/assignment/${attempt.assignmentId}?start=1` : "/student/practice";

  const counts = {
    ok: canRevealSolutions ? correct : 0,
    bad: canRevealSolutions ? incorrect : 0,
    blank: unanswered,
  };
  const attemptRows = tries.map((t) => ({ ...t, status: "SUBMITTED" }));

  return (
    <PageShell maxWidth={920}>
      <Breadcrumbs
        items={[
          { label: "Home", href: "/student" },
          { label: "Practice", href: areaTab ? `/student/practice?area=${areaTab}` : "/student/practice" },
          // Back to the same History list the student came from (area, skill, level and dates kept).
          { label: "History", href: query.area || !areaTab ? historyHref : `/student/history?area=${areaTab}` },
          { label: `Try ${thisTry?.tryNumber ?? attempt.attemptNumber} results` },
        ]}
      />
      {query.new === "1" ? <Alert tone="success" className="mb-4">Practice submitted. Here are your results.</Alert> : null}

      {attempt.status === "INVALIDATED" ? <InvalidatedNotice audience="student" /> : null}
      <ResultFilterRoot>
        {/* Score header */}
        <Card padding="lg" className="mb-6">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            {practiceArea ? <AreaTag area={practiceArea} /> : null}
            {practiceSet ? <Badge variant={difficultyBadgeVariant(practiceSet.difficulty)}>{difficultyLabel(practiceSet.difficulty)}</Badge> : null}
            <Badge>Try {thisTry?.tryNumber ?? attempt.attemptNumber} of {Math.max(tries.length, 1)}</Badge>
          </div>
          <h1 className="mb-1 text-xl font-semibold text-gray-900">
            {practiceSet?.topic.name ?? shortSetName(practiceSetSnapshot?.name ?? "Practice set")}
          </h1>
          <p className="mb-4 text-xs text-gray-500">
            {attempt.submittedAt ? (
              <>
                Completed <b className="font-medium text-gray-700">{formatDate(attempt.submittedAt)}</b> at {formatClock(attempt.submittedAt)} ({relativeDay(attempt.submittedAt)})
              </>
            ) : null}
            {attempt.assignment?.createdAt ? <> · Assigned {formatDate(attempt.assignment.createdAt)}</> : null}
          </p>

          <div className="grid gap-5 md:grid-cols-[auto_1fr] md:items-center">
            <div>
              <p className={`text-5xl font-bold leading-none ${scoreBandTextClass(displayPct)}`}>
                <VoidableValue status={attempt.status}>{displayPct}%</VoidableValue>
              </p>
              <p className="mt-1 text-sm text-gray-600">
                <VoidableValue status={attempt.status}>{correct} of {totalQuestions} correct</VoidableValue>
              </p>
              {delta !== null ? <Delta value={delta} suffix={`vs. try ${prevTry!.tryNumber} (${prevTry!.pct}%)`} className="mt-1 block" /> : null}
            </div>
            <div>
              <p className="text-sm text-gray-700">
                You answered <b className="text-green-700">{correct} correctly</b>, <b className="text-red-600">{incorrect} incorrectly</b> and left{" "}
                <b className="text-gray-600">{unanswered} blank</b>.
              </p>
              <div className="mt-1.5">
                <ResultFilterBar counts={{ ok: correct, bad: incorrect, blank: unanswered }} interactive={canRevealSolutions} />
              </div>
              <p className="mt-1 text-xs text-gray-500">
                {canRevealSolutions ? "Click a colour to see only those questions. " : ""}
                {attempt.totalTime ? <>{formatDuration(attempt.totalTime)} total{perQuestion ? ` · ${formatDuration(perQuestion)} per question on average` : ""}</> : null}
              </p>
            </div>
          </div>

          {attempt.pauses.length > 0 && (
            <Alert tone="note" className="mt-4 text-xs">
              Paused {attempt.pauses.length} time{attempt.pauses.length === 1 ? "" : "s"}
              {pauseSeconds > 0 ? ` (${formatDuration(pauseSeconds)})` : ""}
            </Alert>
          )}

          <div className="mt-5 flex flex-wrap items-center gap-2">
            <Button asChild>
              <Link href={tryAgainHref}><RotateCcw size={14} /> Try Again</Link>
            </Button>
            {nextAssignment ? (
              <Button asChild variant="secondary" className="max-w-full">
                <Link href={`/student/practice/assignment/${nextAssignment.assignmentId}`}>
                  <span className="truncate">Next assignment: {nextAssignment.skill} · {difficultyLabel(nextAssignment.difficulty)}</span>
                </Link>
              </Button>
            ) : null}
            <Button asChild variant="ghost">
              <Link href="/student">Summary</Link>
            </Button>
          </div>
        </Card>

        {attempt.teacherComment && (
          <Card variant="info" padding="md" className="mb-6 text-sm text-blue-900">
            <p className="mb-1 font-medium">Note from your teacher</p>
            <p>{attempt.teacherComment}</p>
          </Card>
        )}

        {attemptRows.length > 0 ? (
          <section className="mb-6">
            <SectionHeader title="All attempts for this set" description="Every time you try again, a new attempt is recorded here." />
            <PracticeAttemptsTable rows={attemptRows} hrefFor={(id) => `/student/results/${id}`} viewingId={attempt.id} />
          </section>
        ) : null}

        {canRevealSolutions && orderedAnswers.length > 0 ? (
          <Card padding="md" className="mb-6">
            <SectionHeader
              size="sm"
              title="Your answers at a glance"
              description="Each square is a question. Click one to see it."
              action={<ResultFilterSegments counts={counts} />}
            />
            <div className="mt-2">
              <AnswerGrid
                idPrefix="q-"
                items={orderedAnswers.map((a) => ({ state: !a?.answer ? ("blank" as const) : a.isCorrect ? ("ok" as const) : ("bad" as const) }))}
              />
            </div>
            <AnswerGridLegend />
          </Card>
        ) : null}

        {/* Per-question review */}
        <section>
          <h2 className="mb-3 text-base font-semibold text-gray-900">Your answers, question by question</h2>
          {!canRevealSolutions && (
            <p className="mb-3 rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-500">
              Your teacher has hidden the answers for this set.
            </p>
          )}
          <ResultFilterEmpty counts={counts} />
          <div className="space-y-4">
            {orderedAnswers.map((ans, i) => {
              if (!ans) return null;
              // Historic attempts render the question as it was when answered (questionSnapshot).
              const snapshot = parseSnapshot<QuestionSnapshot>(ans.questionSnapshot);
              const question = snapshot ?? ans.question;
              const options = snapshot?.options?.length ? snapshot.options : ans.question.options;
              const topicName = snapshot?.topic?.name ?? ans.question.topic.name;
              const state = !ans.answer ? "blank" : ans.isCorrect ? "ok" : "bad";
              return (
                <div key={ans.id} data-q-state={canRevealSolutions ? state : state === "blank" ? "blank" : "answered"}>
                  <ReviewQuestionCard
                    id={`q-${i + 1}`}
                    number={i + 1}
                    question={{ ...question, options, imageUrl: question.imageUrl ?? null }}
                    answer={ans.answer}
                    isCorrect={Boolean(ans.isCorrect)}
                    timeSpent={ans.timeSpent}
                    reveal={canRevealSolutions}
                    blankNote="You left this blank."
                    tags={
                      <>
                        <Badge variant={difficultyBadgeVariant(question.difficulty)}>{difficultyLabel(question.difficulty)}</Badge>
                        <span>{topicName}</span>
                      </>
                    }
                  >
                    <ReviewTools marked={Boolean(ans.markedForReview)} note={ans.note} eliminated={parseEliminatedOptions(ans.eliminatedOptions)} />
                  </ReviewQuestionCard>
                </div>
              );
            })}
          </div>
        </section>
      </ResultFilterRoot>
    </PageShell>
  );
}

function ReviewTools({ marked, note, eliminated }: { marked: boolean; note: string | null; eliminated: string[] }) {
  if (!marked && !note && eliminated.length === 0) return null;
  return (
    <div className="mb-2 rounded border border-gray-200 bg-white p-2 text-xs text-gray-600">
      {marked ? <p className="font-medium text-amber-700">Marked for review</p> : null}
      {note ? <p className="mt-1">Your note: {note}</p> : null}
      {eliminated.length > 0 ? <p className="mt-1">Crossed out: {eliminated.join(", ")}</p> : null}
    </div>
  );
}
