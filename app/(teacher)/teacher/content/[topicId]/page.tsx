import { PageShell } from "@/components/sat";
import prisma from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, Plus, Pencil } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { difficultyBadgeVariant, difficultyLabel } from "@/lib/domain-meta";
import { practiceAreaLabel, resolvePracticeArea, tabFromPracticeArea } from "@/lib/practice-area";

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

  const area = resolvePracticeArea({
    practiceArea: topic.domain.practiceArea,
    sectionName: topic.domain.section.name,
    sectionLabel: topic.domain.section.label,
    domainName: topic.domain.name,
  });
  const areaKey = tabFromPracticeArea(area) ?? "math";
  const areaLabel = practiceAreaLabel(area);
  const sectionHref = `/teacher/content?area=${areaKey}`;
  const domainHref = `${sectionHref}&domain=${encodeURIComponent(topic.domain.name)}`;

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
    <PageShell>
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-6">
        <Link href={sectionHref} className="flex items-center gap-1 hover:text-blue-600">
          <ChevronLeft size={14} /> Content
        </Link>
        <span>/</span>
        <Link href={sectionHref} className="hover:text-blue-600">
          {areaLabel}
        </Link>
        <span>/</span>
        <Link href={domainHref} className="hover:text-blue-600">
          {topic.domain.name}
        </Link>
        <span>/</span>
        <span className="font-medium text-gray-900">{topic.name}</span>
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
                    <Badge variant={difficultyBadgeVariant(ps.difficulty)}>
                      {difficultyLabel(ps.difficulty)}
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
    </PageShell>
  );
}
