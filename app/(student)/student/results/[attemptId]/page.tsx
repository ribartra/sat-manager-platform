import { Delta, InvalidatedNotice, PageHeader, PageShell, SectionHeader, VoidableValue } from "@/components/sat";
import { ContextTag } from "@/components/sat/context-tag";
import { PAGE_TITLE_CLASS } from "@/components/sat/page-shell";
import { HEADER_ACTION_CLASS, HeaderActions } from "@/components/sat/header-actions";
import { ReviewQuestionCard } from "@/components/sat/review-question-card";
import { ResultFilterBar, ResultFilterEmpty, ResultFilterRoot, ResultFilterSegments } from "@/components/sat/result-filter";
import { parseEliminatedOptions } from "@/lib/answer-review-meta";
import { getStudentViewer } from "@/lib/student-viewer";
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
import { difficultyBadgeVariant, difficultyLabel, explanationsInPlayerLabel } from "@/lib/domain-meta";
import { isAnsweredAnswer, summarizeAllQuestionAnswers } from "@/lib/weighted-score";
import { Alert } from "@/components/sat/alert";
import { Breadcrumbs } from "@/components/sat/breadcrumbs";
import { TryNavigator } from "@/components/sat/try-navigator";
import { practiceSetTitle } from "@/lib/attempt-groups";
import { AreaTag } from "@/components/sat/practice-set-row";
import { AnswerGrid, AnswerGridLegend } from "@/components/sat/test-ui";
import { tabFromPracticeArea, type PracticeAreaCode } from "@/lib/practice-area";
import { loadStudentPractice, sortPracticeSets } from "@/lib/student-practice";
import { relativeDay } from "@/lib/utils";
import { liveImagesOf } from "@/lib/question-media";

interface PageProps {
  params: Promise<{ attemptId: string }>;
  searchParams: Promise<{ area?: string; topic?: string; difficulty?: string; from?: string; to?: string; new?: string }>;
}

export default async function ResultsPage({ params, searchParams }: PageProps) {
  const { attemptId } = await params;
  // The student shown: the signed-in student, or the teacher's Student view (nothing is saved as the student).
  const viewer = await getStudentViewer();
  if (!viewer) redirect("/login");
  const userId = viewer.studentId;
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
          practiceSet: { include: { source: { select: { name: true } }, topic: { include: { domain: { include: { section: true } } } } } },
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
  // Each answer keeps its question number in the set.
  const numberedAnswers = orderedQuestionIds
    .map((questionId, index) => ({ ans: answersMap[questionId], number: index + 1 }))
    .filter((row) => Boolean(row.ans));

  const displayPct = pct;
  // Classroom work is never scored (pendiente-p2.md): no %, no correct count; what was answered.
  const classroom = attempt.assignment?.context === "CLASSROOM";
  // Classroom work shows the student only what they answered (and its solution): the questions left
  // blank are not revealed, so the set's Homework stays unseen (no leakage). Teachers see every question.
  const orderedAnswers = classroom ? numberedAnswers.filter((row) => isAnsweredAnswer(row.ans)) : numberedAnswers;
  const practiceArea = (practiceSet?.topic.domain.practiceArea ?? null) as PracticeAreaCode | null;
  const areaTab = practiceArea ? tabFromPracticeArea(practiceArea) : null;
  const allPractice = await loadStudentPractice(userId);
  const thisSet = attempt.assignmentId ? allPractice.find((p) => p.assignmentId === attempt.assignmentId) : undefined;
  const tries = thisSet?.tries ?? [];
  const thisTry = tries.find((t) => t.id === attempt.id);
  const prevTry = thisTry ? tries[thisTry.tryNumber - 2] : undefined;
  const delta = !classroom && prevTry && prevTry.pct !== null ? displayPct - prevTry.pct : null;
  const nextAssignment = sortPracticeSets(allPractice.filter((p) => p.state !== "done" && p.assignmentId !== attempt.assignmentId && !p.locked))[0];
  const perQuestion = attempt.totalTime && totalQuestions ? Math.round(attempt.totalTime / totalQuestions) : null;
  const tryAgainHref = attempt.assignmentId ? `/student/practice/assignment/${attempt.assignmentId}?start=1` : "/student/practice";

  const counts = {
    ok: canRevealSolutions ? correct : 0,
    bad: canRevealSolutions ? incorrect : 0,
    blank: classroom ? 0 : unanswered,
  };

  return (
    <PageShell>
      <Breadcrumbs
        items={[
          { label: "Home", href: "/student" },
          { label: "Practice", href: areaTab ? `/student/practice?area=${areaTab}` : "/student/practice" },
          // Back to the same History list the student came from (area, skill, level and dates kept).
          { label: "History", href: query.area || !areaTab ? historyHref : `/student/history?area=${areaTab}` },
          // Source › <Practice set (Level)> › Try M of N — the same pattern as a Test attempt.
          ...(practiceSet?.source ? [{ label: practiceSet.source.name }] : []),
          { label: practiceSetTitle(practiceSet?.name ?? practiceSetSnapshot?.name ?? "Practice set", practiceSet?.difficulty) },
          { label: `Try ${thisTry?.tryNumber ?? attempt.attemptNumber} of ${Math.max(tries.length, 1)}` },
        ]}
      />
      {query.new === "1" ? <Alert tone="success" className="mb-4">Practice submitted. Here are your results.</Alert> : null}

      {attempt.status === "INVALIDATED" ? <InvalidatedNotice audience="student" /> : null}
      {/* Header: title on the left, actions top right (same slot and style for every role). */}
      <PageHeader
        eyebrow={
          practiceArea || practiceSet ? (
            <>
              {practiceArea ? <AreaTag area={practiceArea} /> : null}
              {practiceSet ? <Badge variant={difficultyBadgeVariant(practiceSet.difficulty)}>{difficultyLabel(practiceSet.difficulty)}</Badge> : null}
            </>
          ) : undefined
        }
        title={
          <>
            <h1 className={PAGE_TITLE_CLASS}>{practiceSet?.topic.name ?? shortSetName(practiceSetSnapshot?.name ?? "Practice set")}</h1>
            <div className="mt-2">
              <TryNavigator
                current={thisTry?.tryNumber ?? attempt.attemptNumber}
                tries={tries.map((t) => ({
                  number: t.tryNumber,
                  href: `/student/results/${t.id}${returnQuery.toString() ? `?${returnQuery.toString()}` : ""}`,
                  detail: [t.submittedAt ? formatDate(t.submittedAt) : null, t.pct !== null ? `${t.pct}%` : `${t.answered} of ${t.total} answered`].filter(Boolean).join(" · "),
                }))}
              />
            </div>
          </>
        }
        description={
          <span className="text-xs">
            {attempt.submittedAt ? (
              <>
                Completed <b className="font-medium text-gray-700">{formatDate(attempt.submittedAt)}</b> at {formatClock(attempt.submittedAt)} ({relativeDay(attempt.submittedAt)})
              </>
            ) : null}
            {practiceSet?.source ? <> · Source: <b className="font-medium text-gray-700">{practiceSet.source.name}</b></> : null}
            {attempt.assignment?.createdAt ? <> · Assigned {formatDate(attempt.assignment.createdAt)}</> : null}
            {` · ${explanationsInPlayerLabel(attempt.showExplanations ?? attempt.assignment?.showExplanations)}`}
          </span>
        }
        actions={
          <HeaderActions>
            {/* Class work closed by its Homework: no retry here (the set goes on as Homework). */}
            {thisSet?.closedByHomework ? null : <Link href={tryAgainHref} className={HEADER_ACTION_CLASS}><RotateCcw size={14} aria-hidden /> Try Again</Link>}
            {nextAssignment ? (
              <Link href={`/student/practice/assignment/${nextAssignment.assignmentId}`} className={`${HEADER_ACTION_CLASS} max-w-full`}>
                <span className="truncate">Next: {nextAssignment.skill} · {difficultyLabel(nextAssignment.difficulty)}</span>
              </Link>
            ) : null}
            <Link href="/student" className={HEADER_ACTION_CLASS}>Summary</Link>
          </HeaderActions>
        }
      />

      <ResultFilterRoot>
        {/* Score */}
        <Card padding="lg" className="mb-6">

          {classroom ? (
            <div>
              <p className="flex flex-wrap items-center gap-2 text-sm text-gray-700">
                <ContextTag context="CLASSROOM" /> Work done in class: not scored.
              </p>
              <p className="mt-2 text-sm text-gray-700">
                You answered <b>{answeredTotal} of {totalQuestions}</b> questions{unanswered ? <> and left <b>{unanswered} blank</b></> : null}.
              </p>
              <p className="mt-1 text-xs text-gray-500">
                {attempt.totalTime ? <>{formatDuration(attempt.totalTime)} total{perQuestion ? ` · ${formatDuration(perQuestion)} per question on average` : ""}</> : null}
              </p>
            </div>
          ) : (
          <div className="grid gap-5 md:grid-cols-[auto_1fr] md:items-center">
            <div>
              <p className={`text-5xl font-bold leading-none ${scoreBandTextClass(displayPct)}`}>
                <VoidableValue status={attempt.status}>{displayPct}%</VoidableValue>
              </p>
              <p className="mt-1 text-sm text-gray-600">
                <VoidableValue status={attempt.status}>{correct} of {totalQuestions} correct</VoidableValue>
              </p>
              {delta !== null ? <Delta value={delta} unit="%" suffix={`vs. try ${prevTry!.tryNumber} (${prevTry!.pct}%)`} className="mt-1 block" /> : null}
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
          )}

          {attempt.pauses.length > 0 && (
            <Alert tone="note" className="mt-4 text-xs">
              Paused {attempt.pauses.length} time{attempt.pauses.length === 1 ? "" : "s"}
              {pauseSeconds > 0 ? ` (${formatDuration(pauseSeconds)})` : ""}
            </Alert>
          )}
        </Card>

        {attempt.teacherComment && (
          <Card variant="info" padding="md" className="mb-6 text-sm text-blue-900">
            <p className="mb-1 font-medium">Note from your teacher</p>
            <p>{attempt.teacherComment}</p>
          </Card>
        )}

        {canRevealSolutions && orderedAnswers.length > 0 ? (
          <Card padding="md" className="mb-6">
            <SectionHeader
              size="sm"
              title="Your answers at a glance"
              description="Each square is a question. Click one to see it."
              action={<ResultFilterSegments counts={counts} hideCounts={classroom} />}
            />
            <div className="mt-2">
              <AnswerGrid
                idPrefix="q-"
                // Every question keeps its square; in Classroom work the ones left blank aren't opened ("na").
                items={numberedAnswers.map(({ ans: a }) => ({
                  state: !a?.answer ? (classroom ? ("na" as const) : ("blank" as const)) : a.isCorrect ? ("ok" as const) : ("bad" as const),
                }))}
              />
            </div>
            <AnswerGridLegend />
          </Card>
        ) : null}

        {/* Per-question review */}
        <section>
          <h2 className="mb-3 text-base font-semibold text-gray-900">Your answers, question by question</h2>
          {classroom ? (
            <p className="mb-3 rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-500">
              Only the questions you answered in class are shown.
            </p>
          ) : null}
          {!canRevealSolutions && (
            <p className="mb-3 rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-500">
              Your teacher has hidden the answers for this set.
            </p>
          )}
          <ResultFilterEmpty counts={counts} />
          <div className="space-y-4">
            {orderedAnswers.map(({ ans, number }) => {
              if (!ans) return null;
              // Historic attempts render the question as it was when answered (questionSnapshot).
              const snapshot = parseSnapshot<QuestionSnapshot>(ans.questionSnapshot);
              const question = snapshot ?? ans.question;
              // Text and options as answered (snapshot); images from the live bank question (only referenced).
              const media = liveImagesOf(ans.question, snapshot?.options?.length ? snapshot.options : ans.question.options);
              const options = media.options;
              const topicName = snapshot?.topic?.name ?? ans.question.topic.name;
              const state = !ans.answer ? "blank" : ans.isCorrect ? "ok" : "bad";
              return (
                <div key={ans.id} data-q-state={canRevealSolutions ? state : state === "blank" ? "blank" : "answered"}>
                  <ReviewQuestionCard
                    id={`q-${number}`}
                    number={number}
                    question={{ ...question, options, imageUrl: media.imageUrl }}
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
