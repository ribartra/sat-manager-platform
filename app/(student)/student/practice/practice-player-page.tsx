import { auth } from "@/lib/auth";
import { getStudentViewer } from "@/lib/student-viewer";
import prisma from "@/lib/prisma";
import { notFound, redirect } from "next/navigation";
import { PracticeSetPlayer } from "./player-client";
import {
  buildPracticeSetSnapshot,
  stringifySnapshot,
} from "@/lib/attempt-snapshots";
import { getPublicCalculatorConfig } from "@/lib/calculator-config";
import { getFeatureSetting } from "@/lib/app-settings";
import { extractQuestionGraphArtifacts } from "@/lib/question-graph";
import { writeAudit } from "@/lib/audit";
import { claimWriteSlot, RESUME_AUDIT_INTERVAL_MS } from "@/lib/write-throttle";
import { withSqliteRetry } from "@/lib/sqlite-retry";
import { isUniqueConstraintError } from "@/lib/db-errors";
import { gradeCheck, type CheckResult } from "@/lib/immediate-check";

interface PracticePlayerInput {
  setId: string;
  assignmentId?: string;
  feedbackMode?: "IMMEDIATE" | "AFTER_SET";
  /** The assignment's "Show explanations in the player" (recorded on the attempt). */
  showExplanations?: boolean;
  previewMode?: boolean;
  exitHref?: string;
  resultQuery?: string;
}

export async function renderPracticePlayer({
  setId,
  assignmentId,
  feedbackMode = "AFTER_SET",
  showExplanations = true,
  previewMode = false,
  exitHref,
  resultQuery,
}: PracticePlayerInput) {
  // Teacher preview: the teacher's own (nothing is scored or saved). Otherwise the student shown: the
  // signed-in student, or the teacher's Student view, where the try is simulated (a preview of the
  // student's assignment: nothing is created, saved or scored).
  const previewSession = previewMode ? await auth() : null;
  if (previewMode && !previewSession) redirect("/login");
  const viewer = previewMode ? null : await getStudentViewer();
  if (!previewMode && !viewer) redirect("/login");
  const simulated = Boolean(viewer?.readOnly);
  const session = (previewSession ?? viewer!.session)!;
  const userId = viewer?.studentId ?? session.user.id;

  const practiceSet = await withSqliteRetry(() => prisma.practiceSet.findUnique({
    where: { id: setId },
    include: {
      topic: { include: { domain: { include: { section: true } } } },
      questions: {
        include: {
          question: {
            include: {
              options: { orderBy: { label: "asc" } },
              topic: { include: { domain: { include: { section: true } } } },
            },
          },
        },
        orderBy: { order: "asc" },
      },
    },
  }));

  if (!practiceSet) notFound();
  // Teacher preview may open drafts; students only get published sets.
  if (!previewMode && practiceSet.status !== "PUBLISHED") notFound();

  if (!previewMode && (session.user.role === "STUDENT" || simulated)) {
    if (!assignmentId) redirect("/student");
    const assignment = await withSqliteRetry(() => prisma.assignment.findFirst({
      where: { id: assignmentId, studentId: userId, practiceSetId: setId, locked: false },
    }));
    if (!assignment || (assignment.unlockAt && assignment.unlockAt > new Date())) redirect("/student");
    // Class work closed by its Homework can't be continued or retried: the set goes on as Homework.
    if (assignment.context === "CLASSROOM") {
      const homework = await withSqliteRetry(() => prisma.assignment.findFirst({
        where: { studentId: userId, practiceSetId: setId, context: "HOMEWORK" },
        select: { id: true },
      }));
      if (homework) redirect(`/student/practice/assignment/${homework.id}`);
    }
  }

  const questions = practiceSet.questions.map((item) => ({
    id: item.question.id,
    stem: item.question.stem,
    stimulus: item.question.stimulus,
    imageUrl: item.question.imageUrl,
    type: item.question.type,
    difficulty: item.question.difficulty,
    options: item.question.options,
    graphArtifacts: item.question.supportsGraph ? extractQuestionGraphArtifacts(item.question) : [],
    // The answer key only reaches the browser in the teacher preview. Immediate feedback is
    // graded on the server (/api/attempts/[id]/check) and returned per checked question.
    ...(previewMode
      ? {
          correctAnswer: item.question.correctAnswer,
          explanation: item.question.explanation,
        }
      : {}),
  }));

  const calculatorEnabled =
    practiceSet.topic.domain.section.name === "MATH" &&
    (await getFeatureSetting("CALCULATOR_PRACTICE_SETS"));

  if (previewMode || simulated) {
    // Student view: start where the student is (their open try, read only); nothing is written.
    const open = simulated
      ? await withSqliteRetry(() => prisma.attempt.findFirst({
          where: { studentId: userId, practiceSetId: setId, assignmentId: assignmentId ?? null, status: "IN_PROGRESS" },
          include: { answers: true },
          orderBy: { startedAt: "desc" },
        }))
      : null;
    const openAnswers = open?.answers ?? [];
    return (
      <PracticeSetPlayer
        practiceSetId={setId}
        assignmentId={null}
        attemptId="preview"
        questions={questions}
        savedAnswers={Object.fromEntries(openAnswers.filter((a) => a.answer).map((a) => [a.questionId, a.answer ?? ""]))}
        savedMarked={openAnswers.filter((a) => a.markedForReview).map((a) => a.questionId)}
        savedNotes={Object.fromEntries(openAnswers.filter((a) => a.note).map((a) => [a.questionId, a.note ?? ""]))}
        savedEliminated={{}}
        savedQuestion={open?.currentQuestion ?? 0}
        savedTime={open?.totalTime ?? 0}
        savedTimeSpent={Object.fromEntries(openAnswers.map((a) => [a.questionId, a.timeSpent ?? 0]))}
        setName={practiceSet.name}
        skillName={practiceSet.topic.name}
        isMath={practiceSet.topic.domain.section.name === "MATH"}
        showCalculator={calculatorEnabled}
        calculatorConfig={getPublicCalculatorConfig()}
        feedbackMode={feedbackMode}
        previewMode
        previewNotice={simulated ? `Student view of ${viewer!.studentName}: this try is simulated — nothing is saved or scored.` : undefined}
        exitHref={simulated ? (assignmentId ? `/student/practice/assignment/${assignmentId}` : "/student/practice") : exitHref ?? `/teacher/practice-sets/${setId}`}
      />
    );
  }

  const practiceSetSnapshot = stringifySnapshot(
    buildPracticeSetSnapshot({
      ...practiceSet,
      questions: practiceSet.questions.map((item) => ({
        questionId: item.questionId,
        order: item.order,
      })),
    })
  );

  const findOpenAttempt = () =>
    withSqliteRetry(() => prisma.attempt.findFirst({
      where: { studentId: userId, practiceSetId: setId, assignmentId: assignmentId ?? null, status: "IN_PROGRESS" },
      include: { answers: true },
      orderBy: { startedAt: "desc" },
    }));
  let attempt = await findOpenAttempt();

  let createdAttemptId: string | null = null;
  if (!attempt) {
    const prevAttempts = await withSqliteRetry(() => prisma.attempt.count({
      // Tries are numbered per assignment: Classroom and Homework of a set each start at Try 1.
      where: { studentId: userId, practiceSetId: setId, assignmentId: assignmentId ?? null },
    }));
    try {
      const created = await withSqliteRetry(() => prisma.attempt.create({
        data: {
          studentId: userId,
          practiceSetId: setId,
          practiceSetSnapshot,
          assignmentId: assignmentId ?? null,
          attemptNumber: prevAttempts + 1,
          showExplanations,
          status: "IN_PROGRESS",
          currentQuestion: 0,
        },
        select: { id: true },
      }));
      createdAttemptId = created.id;
    } catch (error) {
      // Another request (second tab, double click) opened it first: the partial unique index allows
      // one IN_PROGRESS attempt per assignment, so reuse that one.
      if (!isUniqueConstraintError(error)) throw error;
      attempt = await findOpenAttempt();
    }
  }

  if (createdAttemptId) {
    const newAttemptId = createdAttemptId;
    if (assignmentId) {
      // A set finished at least once stays COMPLETED while the student retries it (the open try shows
      // as "Retry in progress"); only a set not done yet moves to IN_PROGRESS.
      await withSqliteRetry(() => prisma.assignment.updateMany({
        where: { id: assignmentId, status: { in: ["PENDING", "OVERDUE"] } },
        data: { status: "IN_PROGRESS" },
      }));
    }
    attempt = await withSqliteRetry(() => prisma.attempt.findUniqueOrThrow({
      where: { id: newAttemptId },
      include: { answers: true },
    }));
    await writeAudit({
      userId,
      action: "ATTEMPT_STARTED",
      targetType: "Attempt",
      targetId: attempt.id,
      outcome: "success",
      metadata: { practiceSetId: setId, assignmentId: assignmentId ?? null, attemptNumber: attempt.attemptNumber },
    });
    claimWriteSlot(`resumed:${attempt.id}`, RESUME_AUDIT_INTERVAL_MS);
  } else if (attempt && claimWriteSlot(`resumed:${attempt.id}`, RESUME_AUDIT_INTERVAL_MS)) {
    // Logged once per sitting, not on every page load.
    await writeAudit({
      userId,
      action: "ATTEMPT_RESUMED",
      targetType: "Attempt",
      targetId: attempt.id,
      outcome: "info",
      metadata: { practiceSetId: setId, assignmentId: assignmentId ?? null },
    });
  }

  if (!attempt) throw new Error("Practice attempt could not be initialized.");

  if (!attempt.practiceSetSnapshot) {
    const activeAttemptId = attempt.id;
    await withSqliteRetry(() => prisma.attempt.update({
      where: { id: activeAttemptId },
      data: { practiceSetSnapshot },
    }));
    attempt = await withSqliteRetry(() => prisma.attempt.findUniqueOrThrow({
      where: { id: activeAttemptId },
      include: { answers: true },
    }));
  }

  const savedAnswers: Record<string, string> = {};
  const savedTimeSpent: Record<string, number> = {};
  const savedMarked: string[] = [];
  const savedNotes: Record<string, string> = {};
  const savedEliminated: Record<string, string[]> = {};
  const savedChecks: Record<string, CheckResult> = {};
  const questionById = new Map(practiceSet.questions.map((item) => [item.questionId, item.question]));
  attempt.answers.forEach((answer) => {
    const checkedQuestion = questionById.get(answer.questionId);
    if (feedbackMode === "IMMEDIATE" && answer.checkedAt && answer.answer && checkedQuestion) {
      savedChecks[answer.questionId] = gradeCheck(answer.answer, checkedQuestion, {
        showExplanation: attempt.showExplanations ?? showExplanations,
      });
    }
    if (answer.answer) savedAnswers[answer.questionId] = answer.answer;
    if (answer.timeSpent) savedTimeSpent[answer.questionId] = answer.timeSpent;
    if (answer.markedForReview) savedMarked.push(answer.questionId);
    if (answer.note) savedNotes[answer.questionId] = answer.note;
    if (answer.eliminatedOptions) {
      try {
        savedEliminated[answer.questionId] = JSON.parse(answer.eliminatedOptions) as string[];
      } catch {
        savedEliminated[answer.questionId] = [];
      }
    }
  });

  return (
    <PracticeSetPlayer
      practiceSetId={setId}
      assignmentId={assignmentId ?? null}
      attemptId={attempt.id}
      questions={questions}
      savedAnswers={savedAnswers}
      savedMarked={savedMarked}
      savedNotes={savedNotes}
      savedEliminated={savedEliminated}
      savedChecks={savedChecks}
      savedQuestion={attempt.currentQuestion}
      savedTime={attempt.totalTime ?? 0}
      savedTimeSpent={savedTimeSpent}
      setName={practiceSet.name}
      skillName={practiceSet.topic.name}
      isMath={practiceSet.topic.domain.section.name === "MATH"}
      showCalculator={calculatorEnabled}
      calculatorConfig={getPublicCalculatorConfig()}
      feedbackMode={feedbackMode}
      exitHref={exitHref ?? "/student/practice"}
      resultHref={`/student/results/${attempt.id}?new=1${resultQuery ? `&${resultQuery}` : ""}`}
    />
  );
}
