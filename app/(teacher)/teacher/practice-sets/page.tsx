import prisma from "@/lib/prisma";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil } from "lucide-react";

export default async function TeacherPracticeSetsPage() {
  const practiceSets = await prisma.practiceSet.findMany({
    include: {
      topic: { include: { domain: { include: { section: true } } } },
      questions: { select: { questionId: true } },
      assignments: { select: { id: true, studentId: true, status: true } },
    },
    orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
  });

  const statusVariant = (status: string) => {
    const map: Record<string, "success" | "warning" | "danger" | "default"> = {
      PUBLISHED: "success",
      DRAFT: "warning",
      BLOCKED: "danger",
      ARCHIVED: "default",
    };
    return map[status] ?? "default";
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Practice Sets</h1>
          <p className="mt-1 text-sm text-gray-500">Topic practice assignments, separate from Exams.</p>
        </div>
        <Link href="/teacher/practice-sets/new" className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
          <Plus size={14} /> New Practice Set
        </Link>
      </div>

      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs uppercase text-gray-500">
            <tr>
              <th className="px-4 py-3 text-left">Practice Set</th>
              <th className="px-4 py-3 text-left">Topic</th>
              <th className="px-4 py-3 text-left">Difficulty</th>
              <th className="px-4 py-3 text-right">Questions</th>
              <th className="px-4 py-3 text-right">Assignments</th>
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {practiceSets.map((practiceSet) => (
              <tr key={practiceSet.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-900">{practiceSet.name}</td>
                <td className="px-4 py-3 text-gray-500">
                  {practiceSet.topic.domain.section.label} / {practiceSet.topic.name}
                </td>
                <td className="px-4 py-3">
                  <Badge variant={practiceSet.difficulty === "EASY" ? "easy" : practiceSet.difficulty === "MEDIUM" ? "medium" : "hard"}>
                    {practiceSet.difficulty}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-right text-gray-500">{practiceSet.questions.length}</td>
                <td className="px-4 py-3 text-right text-gray-500">{practiceSet.assignments.length}</td>
                <td className="px-4 py-3">
                  <Badge variant={statusVariant(practiceSet.status)}>{practiceSet.status}</Badge>
                </td>
                <td className="px-4 py-3 text-right">
                  <Link href={`/teacher/practice-sets/${practiceSet.id}/edit`} className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline">
                    <Pencil size={12} /> Edit
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {practiceSets.length === 0 && <div className="p-10 text-center text-sm text-gray-400">No Practice Sets yet.</div>}
      </div>
    </div>
  );
}
