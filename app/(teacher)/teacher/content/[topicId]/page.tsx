import prisma from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, Plus, Pencil } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

interface PageProps {
  params: Promise<{ topicId: string }>;
}

export default async function TopicContentPage({ params }: PageProps) {
  const { topicId } = await params;

  const topic = await prisma.topic.findUnique({
    where: { id: topicId },
    include: {
      domain: { include: { section: true } },
      practiceSets: {
        include: {
          questions: { select: { questionId: true } },
          assignments: { select: { id: true, studentId: true } },
        },
        orderBy: [{ difficulty: "asc" }, { createdAt: "asc" }],
      },
    },
  });

  if (!topic) notFound();

  const statusBadge = (status: string) => {
    const map: Record<string, "success" | "warning" | "danger" | "default"> = {
      PUBLISHED: "success",
      DRAFT: "warning",
      BLOCKED: "danger",
      ARCHIVED: "default",
    };
    return map[status] ?? "default";
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-6">
        <Link href="/teacher/content" className="hover:text-blue-600 flex items-center gap-1">
          <ChevronLeft size={14} /> Content
        </Link>
        <span>/</span>
        <span>{topic.domain.section.label}</span>
        <span>/</span>
        <span>{topic.domain.name}</span>
        <span>/</span>
        <span className="text-gray-900 font-medium">{topic.name}</span>
      </div>

      <div className="flex items-center justify-between mb-5">
        <h1 className="text-xl font-semibold text-gray-900">{topic.name}</h1>
        <Link
          href={`/teacher/practice-sets/new?topicId=${topicId}`}
          className="flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          <Plus size={14} /> New Practice Set
        </Link>
      </div>

      {topic.practiceSets.length === 0 ? (
        <Card padding="lg" className="py-12 text-center text-gray-400">
          <p>No practice sets for this topic yet.</p>
          <Link href={`/teacher/practice-sets/new?topicId=${topicId}`} className="mt-2 inline-block text-sm text-blue-600 hover:underline">
            Create the first one →
          </Link>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-4 py-3 text-left font-medium text-gray-500">Name</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Difficulty</th>
                <th className="px-4 py-3 text-right font-medium text-gray-500">Questions</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Status</th>
                <th className="px-4 py-3 text-right font-medium text-gray-500">Assigned to</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {topic.practiceSets.map((ps) => (
                <tr key={ps.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{ps.name}</td>
                  <td className="px-4 py-3">
                    <Badge variant={ps.difficulty === "EASY" ? "easy" : ps.difficulty === "MEDIUM" ? "medium" : "hard"}>
                      {ps.difficulty}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right text-gray-500">{ps.questions.length}</td>
                  <td className="px-4 py-3">
                    <Badge variant={statusBadge(ps.status)}>{ps.status}</Badge>
                  </td>
                  <td className="px-4 py-3 text-right text-gray-500">
                    {new Set(ps.assignments.map((a) => a.studentId)).size} students
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/teacher/practice-sets/${ps.id}/edit`} className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline">
                      <Pencil size={12} /> Edit
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
