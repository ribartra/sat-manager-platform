import Link from "next/link";
import { notFound } from "next/navigation";
import prisma from "@/lib/prisma";
import { requireTeacherOrAdmin } from "@/lib/rbac";
import { teacherProgramEnrollmentScope } from "@/lib/program-scope";
import { formatTime } from "@/lib/utils";
import { MathContent } from "@/components/math-content";

interface Bucket {
  label: string;
  correct: number;
  total: number;
  totalTime: number;
  timed: number;
}

export default async function TeacherAnalyticsPage() {
  const session = await requireTeacherOrAdmin();
  if (!session) notFound();

  const answerWhere =
    session.user.role === "ADMIN"
      ? { attempt: { status: "SUBMITTED" } }
      : {
          attempt: {
            status: "SUBMITTED",
            student: { programEnrollments: teacherProgramEnrollmentScope(session.user.id) },
          },
        };

  const answers = await prisma.attemptAnswer.findMany({
    where: answerWhere,
    include: {
      question: {
        include: {
          topic: { include: { domain: { include: { section: true } } } },
        },
      },
      attempt: {
        select: {
          id: true,
          studentId: true,
          submittedAt: true,
        },
      },
    },
    orderBy: { attempt: { submittedAt: "desc" } },
  });

  const byQuestion = new Map<string, Bucket & { id: string; topic: string; difficulty: string }>();
  const byTopic = new Map<string, Bucket>();
  const byDifficulty = new Map<string, Bucket>();

  for (const answer of answers) {
    const isCorrect = answer.isCorrect === true;
    const timeSpent = answer.timeSpent ?? 0;
    const questionLabel = answer.question.stem;
    const topicLabel = `${answer.question.topic.domain.section.label} / ${answer.question.topic.name}`;

    const questionBucket =
      byQuestion.get(answer.questionId) ??
      {
        id: answer.questionId,
        label: questionLabel,
        topic: topicLabel,
        difficulty: answer.question.difficulty,
        correct: 0,
        total: 0,
        totalTime: 0,
        timed: 0,
      };
    questionBucket.total += 1;
    if (isCorrect) questionBucket.correct += 1;
    if (timeSpent > 0) {
      questionBucket.totalTime += timeSpent;
      questionBucket.timed += 1;
    }
    byQuestion.set(answer.questionId, questionBucket);

    for (const [map, key] of [
      [byTopic, topicLabel],
      [byDifficulty, answer.question.difficulty],
    ] as const) {
      const bucket = map.get(key) ?? { label: key, correct: 0, total: 0, totalTime: 0, timed: 0 };
      bucket.total += 1;
      if (isCorrect) bucket.correct += 1;
      if (timeSpent > 0) {
        bucket.totalTime += timeSpent;
        bucket.timed += 1;
      }
      map.set(key, bucket);
    }
  }

  const hardestQuestions = Array.from(byQuestion.values())
    .filter((bucket) => bucket.total >= 1)
    .sort((a, b) => {
      const aMiss = (a.total - a.correct) / a.total;
      const bMiss = (b.total - b.correct) / b.total;
      return bMiss - aMiss || b.total - a.total;
    })
    .slice(0, 20);
  const topicRows = Array.from(byTopic.values()).sort((a, b) => a.correct / a.total - b.correct / b.total);
  const difficultyRows = Array.from(byDifficulty.values()).sort((a, b) => a.label.localeCompare(b.label));

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-900">Question Analytics</h1>
        <p className="mt-1 text-sm text-gray-500">
          Submitted Practice Set answers by question, topic and difficulty.
        </p>
      </div>

      <div className="mb-6 grid grid-cols-3 gap-4">
        <Metric label="Answers" value={answers.length.toString()} />
        <Metric label="Questions Seen" value={byQuestion.size.toString()} />
        <Metric
          label="Average Accuracy"
          value={
            answers.length
              ? `${Math.round((answers.filter((answer) => answer.isCorrect).length / answers.length) * 100)}%`
              : "-"
          }
        />
      </div>

      <section className="mb-8">
        <h2 className="mb-3 text-base font-semibold text-gray-900">Most Missed Questions</h2>
        <div className="overflow-hidden rounded-md border border-gray-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-4 py-3 text-left">Question</th>
                <th className="px-4 py-3 text-left">Topic</th>
                <th className="px-4 py-3 text-left">Difficulty</th>
                <th className="px-4 py-3 text-right">Accuracy</th>
                <th className="px-4 py-3 text-right">Avg Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {hardestQuestions.map((bucket) => (
                <tr key={bucket.id}>
                  <td className="px-4 py-3">
                    <Link href={`/teacher/questions/${bucket.id}/edit`} className="font-medium text-gray-800 hover:text-blue-700">
                      <MathContent content={bucket.label} className="line-clamp-2" />
                    </Link>
                    <p className="mt-0.5 text-xs text-gray-400">{bucket.total - bucket.correct} missed of {bucket.total}</p>
                  </td>
                  <td className="px-4 py-3 text-gray-500">{bucket.topic}</td>
                  <td className="px-4 py-3 text-gray-500">{bucket.difficulty}</td>
                  <td className="px-4 py-3 text-right font-medium text-gray-800">{Math.round((bucket.correct / bucket.total) * 100)}%</td>
                  <td className="px-4 py-3 text-right text-gray-500">{bucket.timed ? formatTime(Math.round(bucket.totalTime / bucket.timed)) : "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {hardestQuestions.length === 0 && <p className="py-10 text-center text-sm text-gray-400">No submitted answers yet.</p>}
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Breakdown title="By Topic" rows={topicRows} />
        <Breakdown title="By Difficulty" rows={difficultyRows} />
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-gray-200 bg-white p-4">
      <p className="text-xs font-medium uppercase text-gray-400">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-gray-900">{value}</p>
    </div>
  );
}

function Breakdown({ title, rows }: { title: string; rows: Bucket[] }) {
  return (
    <section>
      <h2 className="mb-3 text-base font-semibold text-gray-900">{title}</h2>
      <div className="overflow-hidden rounded-md border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs uppercase text-gray-500">
            <tr>
              <th className="px-4 py-3 text-left">Segment</th>
              <th className="px-4 py-3 text-right">Accuracy</th>
              <th className="px-4 py-3 text-right">Answers</th>
              <th className="px-4 py-3 text-right">Avg Time</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.map((row) => (
              <tr key={row.label}>
                <td className="px-4 py-3 font-medium text-gray-800">{row.label}</td>
                <td className="px-4 py-3 text-right text-gray-700">{Math.round((row.correct / row.total) * 100)}%</td>
                <td className="px-4 py-3 text-right text-gray-500">{row.total}</td>
                <td className="px-4 py-3 text-right text-gray-500">{row.timed ? formatTime(Math.round(row.totalTime / row.timed)) : "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && <p className="py-10 text-center text-sm text-gray-400">No data yet.</p>}
      </div>
    </section>
  );
}
