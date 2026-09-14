import { PageShell } from "@/components/sat";
import prisma from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { MathContent } from "@/components/math-content";
import { QuestionMedia } from "@/components/question-media";
import { formatDate, formatTime, scorePercent } from "@/lib/utils";
import { ChevronLeft } from "lucide-react";
import { AttemptActions } from "./attempt-actions-client";
import { parseSnapshot, PracticeSetSnapshot, QuestionSnapshot } from "@/lib/attempt-snapshots";
import { formatCorrectAnswer } from "@/lib/answer-grading";
import { auth } from "@/lib/auth";
import { teacherProgramEnrollmentScope } from "@/lib/program-scope";

interface PageProps {
  params: Promise<{ studentId: string; attemptId: string }>;
}

export default async function TeacherAttemptDetailPage({ params }: PageProps) {
  const { studentId, attemptId } = await params;
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
  const correct = attempt.answers.filter((a) => a.isCorrect).length;
  const total = orderedQuestionIds.length;
  const pct = scorePercent(correct, total);
  const pauseSeconds = attempt.pauses.reduce((sum, pause) => sum + (pause.durationSeconds ?? 0), 0);

  return (
    <PageShell>
      <div className="mb-6 flex items-center gap-2 text-sm text-gray-500">
        <Link href={`/teacher/students/${studentId}`} className="flex items-center gap-1 hover:text-blue-600">
          <ChevronLeft size={14} /> {attempt.student.name}
        </Link>
        <span>/</span>
        <span className="font-medium text-gray-900">{practiceSetSnapshot?.name ?? attempt.assignment?.practiceSet.name ?? "Practice Set"}</span>
      </div>

      <Card padding="md" className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Attempt #{attempt.attemptNumber}</h1>
          <p className="mt-1 text-sm text-gray-500">
            {attempt.submittedAt ? formatDate(attempt.submittedAt) : "Not submitted"} · {attempt.totalTime ? formatTime(attempt.totalTime) : "No time"}
            {attempt.pauses.length > 0 ? ` · Paused ${attempt.pauses.length}x (${formatTime(pauseSeconds)})` : ""}
          </p>
          <div className="mt-3 flex items-center gap-2">
            <Badge variant={attempt.status === "SUBMITTED" ? "success" : attempt.status === "INVALIDATED" ? "danger" : "warning"}>
              {attempt.status}
            </Badge>
            <span className="text-sm font-semibold text-gray-900">
              {correct}/{total} ({pct}%)
            </span>
          </div>
        </div>
        <AttemptActions attemptId={attempt.id} initialComment={attempt.teacherComment} />
      </Card>

      {attempt.teacherComment && (
        <Card variant="info" padding="md" className="mb-6 text-sm text-blue-900">
          <p className="mb-1 font-medium">Teacher comment</p>
          <p>{attempt.teacherComment}</p>
        </Card>
      )}

      <Card>
        <table className="w-full text-sm">
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
                      <span className="text-gray-400">Unanswered</span>
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
