import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { notFound } from "next/navigation";
import { formatTime, scorePercent } from "@/lib/utils";
import { MathContent } from "@/components/math-content";

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
  const topicStats = new Map<string, { correct: number; total: number; time: number }>();
  const difficultyStats = new Map<string, { correct: number; total: number; time: number }>();
  const moduleStats = attempt.test.modules.map((module) => {
    let correct = 0;
    let total = 0;
    let time = 0;
    for (const item of module.questions) {
      const answer = answersByQuestion.get(item.questionId);
      total += 1;
      if (answer?.isCorrect) correct += 1;
      time += answer?.timeSpent ?? 0;

      const topicKey = `${item.question.topic.domain.name} / ${item.question.topic.name}`;
      const topicStat = topicStats.get(topicKey) ?? { correct: 0, total: 0, time: 0 };
      topicStat.total += 1;
      if (answer?.isCorrect) topicStat.correct += 1;
      topicStat.time += answer?.timeSpent ?? 0;
      topicStats.set(topicKey, topicStat);

      const difficultyStat = difficultyStats.get(item.question.difficulty) ?? { correct: 0, total: 0, time: 0 };
      difficultyStat.total += 1;
      if (answer?.isCorrect) difficultyStat.correct += 1;
      difficultyStat.time += answer?.timeSpent ?? 0;
      difficultyStats.set(item.question.difficulty, difficultyStat);
    }
    return { id: module.id, name: module.name, correct, total, time };
  });

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
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <StatsPanel title="By Module" rows={moduleStats.map((stat) => ({ label: stat.name, ...stat }))} />
        <StatsPanel title="By Difficulty" rows={[...difficultyStats.entries()].map(([label, stat]) => ({ label, ...stat }))} />
      </div>
      <div className="mt-6">
        <StatsPanel title="By Topic" rows={[...topicStats.entries()].map(([label, stat]) => ({ label, ...stat }))} />
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
                      <div className="min-w-0">
                        <div className="flex gap-1 font-medium text-gray-800">
                          <span className="shrink-0">Q{index + 1}.</span>
                          <MathContent content={item.question.stem} className="line-clamp-2" />
                        </div>
                        <p className="text-xs text-gray-500">{item.question.topic.domain.name} · {item.question.topic.name} · {item.question.difficulty}</p>
                      </div>
                      <div className="text-right">
                        <p className={answer?.isCorrect ? "text-green-600" : "text-red-600"}>{answer?.isCorrect ? "Correct" : "Wrong"}</p>
                        <p className="text-xs text-gray-500">Answer: {answer?.answer ?? "Blank"}</p>
                        <p className="text-xs text-gray-400">{answer?.timeSpent ? formatTime(answer.timeSpent) : "No time"}</p>
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

function StatsPanel({ title, rows }: { title: string; rows: { label: string; correct: number; total: number; time: number }[] }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-5">
      <h2 className="mb-3 text-sm font-semibold text-gray-900">{title}</h2>
      <div className="space-y-3">
        {rows.map((row) => {
          const pct = scorePercent(row.correct, row.total);
          return (
            <div key={row.label}>
              <div className="mb-1 flex items-center justify-between gap-3 text-sm">
                <span className="font-medium text-gray-800">{row.label}</span>
                <span className="shrink-0 text-gray-600">{row.correct}/{row.total} · {pct}% · {formatTime(row.time)}</span>
              </div>
              <div className="h-2 rounded-full bg-gray-100"><div className="h-2 rounded-full bg-blue-500" style={{ width: `${pct}%` }} /></div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
