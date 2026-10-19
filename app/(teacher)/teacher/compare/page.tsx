import { Breadcrumbs } from "@/components/sat/breadcrumbs";
import { PageShell } from "@/components/sat";
import Link from "next/link";
import { notFound } from "next/navigation";
import prisma from "@/lib/prisma";
import { getFeatureSetting } from "@/lib/app-settings";
import { requireTeacherOrAdmin } from "@/lib/rbac";
import { studentAccessWhereFor } from "@/lib/program-scope";
import { scorePercent } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { isAnsweredAnswer } from "@/lib/weighted-score";
import { buildProgressHref, progressFiltersFromParams } from "@/lib/progress-filters";
import { applyTimeFilterSetting } from "@/lib/time-filters";

interface PageProps {
  searchParams: Promise<{
    area?: string;
    topic?: string;
    difficulty?: string;
    from?: string;
    to?: string;
  }>;
}

export default async function TeacherComparePage({ searchParams }: PageProps) {
  const session = await requireTeacherOrAdmin();
  if (!session) notFound();
  const { filters } = await applyTimeFilterSetting(progressFiltersFromParams(await searchParams));
  const now = new Date();
  // Groups are optional (Admin → Settings, off by default): hide every Group control while off, for admins too.
  const teacherGroupManagementEnabled = await getFeatureSetting("TEACHER_GROUP_MANAGEMENT");

  const students = await prisma.user.findMany({
    where: studentAccessWhereFor(session.user, now),
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
    const submittedAnswers = student.attempts.flatMap((attempt) => attempt.answers).filter(isAnsweredAnswer);
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
      groups: teacherGroupManagementEnabled
        ? student.groups.map((membership) => membership.group.name).join(", ") || "No group"
        : "",
      attempts: student.attempts.length,
      total,
      pct: scorePercent(correct, total),
      weakestTopic,
    };
  });

  return (
    <PageShell>
      <Breadcrumbs items={[{ label: "Home", href: "/teacher" }, { label: "Students", href: "/teacher/students" }, { label: "Compare" }]} />
      <h1 className="mb-2 text-[26px] font-bold tracking-[-0.3px] text-gray-900">Private Student Comparison</h1>
      <p className="mb-6 text-sm text-gray-500">
        Teacher-only comparison by student, score and weakest skill.
      </p>

      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="px-4 py-3 text-left font-medium text-gray-500">Student</th>
              {teacherGroupManagementEnabled && <th className="px-4 py-3 text-left font-medium text-gray-500">Group</th>}
              <th className="px-4 py-3 text-right font-medium text-gray-500">Finished</th>
              <th className="px-4 py-3 text-right font-medium text-gray-500">Answered</th>
              <th className="px-4 py-3 text-right font-medium text-gray-500">Avg score</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">Weakest skill</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.map((row) => (
              <tr key={row.id}>
                <td className="px-4 py-3 font-medium text-gray-900">
                  <Link href={performanceHref(buildProgressHref(`/teacher/students/${row.id}`, filters))} className="hover:text-blue-700 hover:underline">
                    {row.name}
                  </Link>
                </td>
                {teacherGroupManagementEnabled && <td className="px-4 py-3 text-gray-600">{row.groups}</td>}
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
      </Card>
    </PageShell>
  );
}

/** Student page, scrolled to its performance section. */
function performanceHref(href: string) {
  return `${href}#performance`;
}
