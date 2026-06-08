import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { notFound } from "next/navigation";

interface PageProps { params: Promise<{ attemptId: string }> }

export default async function FullTestResultsPage({ params }: PageProps) {
  const { attemptId } = await params;
  const session = await auth();
  const attempt = await prisma.fullPracticeTestAttempt.findFirst({
    where: { id: attemptId, studentId: session!.user.id },
    include: { test: { include: { modules: { include: { questions: { include: { question: { include: { topic: { include: { domain: true } } } } }, orderBy: { order: "asc" } } }, orderBy: { order: "asc" } } } }, answers: true },
  });
  if (!attempt) notFound();

  const answersByQuestion = new Map(attempt.answers.map((answer) => [answer.questionId, answer]));

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="mb-6 text-xl font-semibold text-gray-900">Results: {attempt.test.name}</h1>
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-lg border border-gray-200 bg-white p-5 text-center"><p className="text-3xl font-bold">{attempt.rwScore ?? "—"}</p><p className="text-xs text-gray-500">Reading & Writing</p></div>
        <div className="rounded-lg border border-gray-200 bg-white p-5 text-center"><p className="text-3xl font-bold">{attempt.mathScore ?? "—"}</p><p className="text-xs text-gray-500">Math</p></div>
        <div className="rounded-lg border border-gray-200 bg-white p-5 text-center"><p className="text-3xl font-bold">{attempt.totalScore ?? "—"}</p><p className="text-xs text-gray-500">Total</p></div>
      </div>
      <div className="mt-6 rounded-lg border border-gray-200 bg-white p-5 text-sm text-gray-600">
        Time expired events: {attempt.timeExpiredEvents} · Extra time used: {attempt.extraTimeUsed}s
      </div>
      {attempt.test.reviewEnabled && (
        <div className="mt-6 space-y-5">
          {attempt.test.modules.map((module) => (
            <div key={module.id} className="rounded-lg border border-gray-200 bg-white p-5">
              <h2 className="mb-3 text-sm font-semibold text-gray-900">{module.name}</h2>
              <div className="space-y-2">
                {module.questions.map((item, index) => {
                  const answer = answersByQuestion.get(item.questionId);
                  return (
                    <div key={item.questionId} className="flex items-center justify-between gap-4 border-b border-gray-100 pb-2 text-sm last:border-b-0">
                      <div>
                        <p className="font-medium text-gray-800">Q{index + 1}. {item.question.stem.slice(0, 120)}</p>
                        <p className="text-xs text-gray-500">{item.question.topic.domain.name} · {item.question.topic.name} · {item.question.difficulty}</p>
                      </div>
                      <div className="text-right">
                        <p className={answer?.isCorrect ? "text-green-600" : "text-red-600"}>{answer?.isCorrect ? "Correct" : "Wrong"}</p>
                        <p className="text-xs text-gray-500">Answer: {answer?.answer ?? "Blank"}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
