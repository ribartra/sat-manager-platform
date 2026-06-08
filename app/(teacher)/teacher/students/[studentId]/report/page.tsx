import prisma from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";
import { formatTime, scorePercent } from "@/lib/utils";

interface PageProps {
  params: Promise<{ studentId: string }>;
}

export default async function StudentReportPage({ params }: PageProps) {
  const { studentId } = await params;
  const student = await prisma.user.findFirst({ where: { id: studentId, role: "STUDENT" } });
  if (!student) notFound();

  const attempts = await prisma.attempt.findMany({
    where: { studentId, status: "SUBMITTED" },
    include: { answers: { include: { question: { include: { topic: true } } } }, assignment: { include: { practiceSet: true } } },
    orderBy: { submittedAt: "desc" },
  });

  const totalTime = attempts.reduce((sum, a) => sum + (a.totalTime ?? 0), 0);
  const topicStats = new Map<string, { correct: number; total: number; time: number }>();
  for (const attempt of attempts) {
    for (const answer of attempt.answers) {
      const key = answer.question.topic.name;
      const stat = topicStats.get(key) ?? { correct: 0, total: 0, time: 0 };
      stat.total += 1;
      if (answer.isCorrect) stat.correct += 1;
      stat.time += answer.timeSpent ?? 0;
      topicStats.set(key, stat);
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <Link href={`/teacher/students/${studentId}`} className="text-sm text-blue-600 hover:underline">← Student</Link>
          <h1 className="mt-2 text-xl font-semibold text-gray-900">Individual Report: {student.name}</h1>
        </div>
        <Link href={`/api/reports/students/${studentId}/pdf`} className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
          Download PDF
        </Link>
      </div>

      <div className="mb-6 grid grid-cols-3 gap-4">
        <div className="rounded-lg border border-gray-200 bg-white p-4"><p className="text-2xl font-bold">{attempts.length}</p><p className="text-xs text-gray-500">Completed attempts</p></div>
        <div className="rounded-lg border border-gray-200 bg-white p-4"><p className="text-2xl font-bold">{formatTime(totalTime)}</p><p className="text-xs text-gray-500">Practice time</p></div>
        <div className="rounded-lg border border-gray-200 bg-white p-4"><p className="text-2xl font-bold">{topicStats.size}</p><p className="text-xs text-gray-500">Topics practiced</p></div>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold text-gray-900">Progress by Topic</h2>
        <div className="space-y-3">
          {[...topicStats.entries()].map(([topic, stat]) => {
            const pct = scorePercent(stat.correct, stat.total);
            return (
              <div key={topic}>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span className="font-medium text-gray-800">{topic}</span>
                  <span>{stat.correct}/{stat.total} · {pct}% · {formatTime(stat.time)}</span>
                </div>
                <div className="h-2 rounded-full bg-gray-100"><div className="h-2 rounded-full bg-blue-500" style={{ width: `${pct}%` }} /></div>
              </div>
            );
          })}
          {topicStats.size === 0 && <p className="text-sm text-gray-400">No submitted attempts yet.</p>}
        </div>
      </div>
    </div>
  );
}
