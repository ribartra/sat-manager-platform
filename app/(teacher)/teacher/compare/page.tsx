import prisma from "@/lib/prisma";
import { scorePercent } from "@/lib/utils";

export default async function TeacherComparePage() {
  const students = await prisma.user.findMany({
    where: { role: "STUDENT" },
    orderBy: { name: "asc" },
    include: {
      groups: { include: { group: true } },
      attempts: {
        where: { status: "SUBMITTED" },
        include: {
          answers: { include: { question: { include: { topic: true } } } },
          assignment: { include: { practiceSet: true } },
        },
      },
    },
  });

  const rows = students.map((student) => {
    const submittedAnswers = student.attempts.flatMap((attempt) => attempt.answers);
    const correct = submittedAnswers.filter((answer) => answer.isCorrect).length;
    const total = submittedAnswers.length;
    const byTopic = new Map<string, { correct: number; total: number }>();

    submittedAnswers.forEach((answer) => {
      const topic = answer.question.topic.name;
      const current = byTopic.get(topic) ?? { correct: 0, total: 0 };
      current.total += 1;
      if (answer.isCorrect) current.correct += 1;
      byTopic.set(topic, current);
    });

    const weakestTopic = Array.from(byTopic.entries())
      .map(([topic, stats]) => ({ topic, pct: scorePercent(stats.correct, stats.total), total: stats.total }))
      .filter((entry) => entry.total > 0)
      .sort((a, b) => a.pct - b.pct)[0];

    return {
      id: student.id,
      name: student.name,
      groups: student.groups.map((membership) => membership.group.name).join(", ") || "No group",
      attempts: student.attempts.length,
      total,
      pct: scorePercent(correct, total),
      weakestTopic,
    };
  });

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="mb-2 text-xl font-semibold text-gray-900">Private Student Comparison</h1>
      <p className="mb-6 text-sm text-gray-500">Teacher-only comparison by student, group, score and weakest topic.</p>

      <div className="rounded-lg border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="px-4 py-3 text-left font-medium text-gray-500">Student</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">Group</th>
              <th className="px-4 py-3 text-right font-medium text-gray-500">Attempts</th>
              <th className="px-4 py-3 text-right font-medium text-gray-500">Answered</th>
              <th className="px-4 py-3 text-right font-medium text-gray-500">Avg score</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">Weakest topic</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.map((row) => (
              <tr key={row.id}>
                <td className="px-4 py-3 font-medium text-gray-900">{row.name}</td>
                <td className="px-4 py-3 text-gray-600">{row.groups}</td>
                <td className="px-4 py-3 text-right text-gray-600">{row.attempts}</td>
                <td className="px-4 py-3 text-right text-gray-600">{row.total}</td>
                <td className="px-4 py-3 text-right font-semibold text-gray-900">{row.pct}%</td>
                <td className="px-4 py-3 text-gray-600">
                  {row.weakestTopic ? `${row.weakestTopic.topic} (${row.weakestTopic.pct}%)` : "No submitted work"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
