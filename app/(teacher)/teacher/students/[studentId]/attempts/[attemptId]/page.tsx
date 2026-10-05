import { AttemptStatusBadge, InvalidatedNotice, VoidableValue } from "@/components/sat";
import { PageShell } from "@/components/sat";
import prisma from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { MathContent } from "@/components/math-content";
import { QuestionMedia } from "@/components/question-media";
import { formatDate, formatTime } from "@/lib/utils";
import { ChevronLeft } from "lucide-react";
import { AttemptActions } from "./attempt-actions-client";
import { parseSnapshot, PracticeSetSnapshot, QuestionSnapshot } from "@/lib/attempt-snapshots";
import { formatCorrectAnswer } from "@/lib/answer-grading";
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
      assignment: { include: { practiceSet: true } },
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

  return (
    <PageShell>
      <div className="mb-6 flex items-center gap-2 text-sm text-gray-500">
        <Link href={buildProgressHref(`/teacher/students/${studentId}`, filters)} className="flex items-center gap-1 hover:text-blue-600">
          <ChevronLeft size={14} /> {attempt.student.name}
        </Link>
        <span>/</span>
        <span className="font-medium text-gray-900">{practiceSetSnapshot?.name ?? attempt.assignment?.practiceSet.name ?? "Practice Set"}</span>
      </div>

      <Card padding="md" className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Try {attempt.attemptNumber}</h1>
          <p className="mt-1 text-sm text-gray-500">
            {attempt.submittedAt ? formatDate(attempt.submittedAt) : "Not finished"} · {attempt.totalTime ? formatTime(attempt.totalTime) : "No time"}
            {attempt.pauses.length > 0 ? ` · Paused ${attempt.pauses.length} ${attempt.pauses.length === 1 ? "time" : "times"} (${formatTime(pauseSeconds)})` : ""}
          </p>
          <div className="mt-3 flex items-center gap-2">
            <AttemptStatusBadge status={attempt.status} />
            <VoidableValue status={attempt.status} className="text-sm font-semibold text-gray-900">
              {correct}/{total} ({pct}%)
            </VoidableValue>
          </div>
        </div>
        <AttemptActions attemptId={attempt.id} initialComment={attempt.teacherComment} status={attempt.status} />
      </Card>
      {attempt.status === "INVALIDATED" ? <InvalidatedNotice audience="teacher" /> : null}

      {attempt.teacherComment && (
        <Card variant="info" padding="md" className="mb-6 text-sm text-blue-900">
          <p className="mb-1 font-medium">Teacher comment</p>
          <p>{attempt.teacherComment}</p>
        </Card>
      )}

      <Card className="overflow-x-auto">
        <table className="w-full min-w-[34rem] text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="px-4 py-3 text-left font-medium text-gray-500">Q</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">Question</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">Answer</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">Correct</th>
              <th className="px-4 py-3 text-right font-medium text-gray-500">Time</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {orderedQuestionIds.map((questionId, index) => {
              const item = liveQuestionsById.get(questionId);
              const ans = answersByQuestion.get(questionId);
              const snapshot = parseSnapshot<QuestionSnapshot>(ans?.questionSnapshot);
              const question = snapshot ?? item?.question;
              if (!question) return null;
              const topicName = snapshot?.topic?.name ?? item?.question.topic.name ?? "—";
              return (
                <tr key={questionId}>
                  <td className="px-4 py-3 text-gray-500">{index + 1}</td>
                  <td className="max-w-md px-4 py-3">
                    <MathContent content={question.stem} className="text-sm text-gray-800" />
                    <QuestionMedia imageUrl={question.imageUrl} alt={`Question ${index + 1} image`} className="mt-2" />
                    <p className="mt-1 text-xs text-gray-400">{topicName} · {question.difficulty}</p>
                  </td>
                  <td className="px-4 py-3 text-gray-700">{ans?.answer ?? "Blank"}</td>
                  <td className="px-4 py-3">
                    {ans?.answer ? (
                      ans.isCorrect ? <span className="text-green-600">Correct</span> : <span className="text-red-600">Wrong ({formatCorrectAnswer(question.correctAnswer)})</span>
                    ) : (
                      <span className="text-gray-400">Blank</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-500">{ans?.timeSpent ? formatTime(ans.timeSpent) : "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </PageShell>
  );
}
