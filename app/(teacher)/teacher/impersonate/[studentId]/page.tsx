import prisma from "@/lib/prisma";
import { requireTeacherOrAdmin } from "@/lib/rbac";
import { studentAccessWhereFor } from "@/lib/program-scope";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody } from "@/components/ui/card";
import { formatDate, scorePercent } from "@/lib/utils";
import { BookOpen, CheckCircle, Clock, TrendingUp } from "lucide-react";

interface PageProps {
  params: Promise<{ studentId: string }>;
}

export default async function ImpersonateStudentPage({ params }: PageProps) {
  const session = await requireTeacherOrAdmin();
  if (!session) notFound();

  const { studentId } = await params;
  const student = await prisma.user.findFirst({
    where: { id: studentId, ...studentAccessWhereFor(session.user) },
  });
  if (!student) notFound();

  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: "IMPERSONATE_STUDENT_VIEW",
      targetType: "User",
      targetId: student.id,
      metadata: JSON.stringify({ studentEmail: student.email }),
    },
  });

  const [assignments, recentAttempts, stats] = await Promise.all([
    prisma.assignment.findMany({
      where: { studentId, locked: false, status: { in: ["PENDING", "IN_PROGRESS"] } },
      include: { practiceSet: { include: { topic: { include: { domain: { include: { section: true } } } } } } },
      orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
      take: 10,
    }),
    prisma.attempt.findMany({
      where: { studentId, status: "SUBMITTED" },
      include: { answers: true, assignment: { include: { practiceSet: { include: { topic: true } } } } },
      orderBy: { submittedAt: "desc" },
      take: 5,
    }),
    prisma.attempt.aggregate({ where: { studentId, status: "SUBMITTED" }, _count: { id: true } }),
  ]);

  const avgScore =
    recentAttempts.length > 0
      ? Math.round(
          (recentAttempts.reduce((sum, a) => {
            const correct = a.answers.filter((ans) => ans.isCorrect).length;
            return sum + (a.answers.length ? correct / a.answers.length : 0);
          }, 0) /
            recentAttempts.length) *
            100
        )
      : null;

  return (
    <div>
      <div className="border-b border-amber-200 bg-amber-50 px-4 py-2">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <span className="text-sm font-medium text-amber-800">You are viewing as: {student.name}</span>
          <Link href={`/teacher/students/${student.id}`} className="text-sm text-amber-800 underline">
            Exit Student View
          </Link>
        </div>
      </div>
      <div className="mx-auto max-w-4xl px-4 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-gray-900">Hello, {student.name.split(" ")[0]}!</h1>
          <p className="mt-0.5 text-sm text-gray-500">Read-only student dashboard</p>
        </div>

        <div className="mb-8 grid grid-cols-3 gap-4">
          <Card>
            <CardBody className="flex items-center gap-3">
              <BookOpen size={16} className="text-blue-600" />
              <div><p className="text-2xl font-bold text-gray-900">{stats._count.id}</p><p className="text-xs text-gray-500">Sets completed</p></div>
            </CardBody>
          </Card>
          <Card>
            <CardBody className="flex items-center gap-3">
              <TrendingUp size={16} className="text-green-600" />
              <div><p className="text-2xl font-bold text-gray-900">{avgScore !== null ? `${avgScore}%` : "—"}</p><p className="text-xs text-gray-500">Avg score</p></div>
            </CardBody>
          </Card>
          <Card>
            <CardBody className="flex items-center gap-3">
              <Clock size={16} className="text-amber-600" />
              <div><p className="text-2xl font-bold text-gray-900">{assignments.length}</p><p className="text-xs text-gray-500">Pending tasks</p></div>
            </CardBody>
          </Card>
        </div>

        <section className="mb-8">
          <h2 className="mb-3 text-base font-semibold text-gray-900">Assigned to Student</h2>
          <div className="space-y-2">
            {assignments.map((a) => (
              <div key={a.id} className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-gray-900">{a.practiceSet.name}</p>
                  <p className="mt-0.5 text-xs text-gray-500">
                    {a.practiceSet.topic.domain.section.label} · {a.practiceSet.topic.name}
                    {a.dueDate && <span className="ml-2 text-amber-600">Due: {formatDate(a.dueDate)}</span>}
                  </p>
                </div>
                <Badge variant={a.status === "IN_PROGRESS" ? "warning" : "info"}>{a.status}</Badge>
              </div>
            ))}
            {assignments.length === 0 && <div className="rounded-lg border border-gray-200 bg-white p-8 text-center text-sm text-gray-400">No active assignments.</div>}
          </div>
        </section>

        <section>
          <h2 className="mb-3 text-base font-semibold text-gray-900">Recent Results</h2>
          <div className="space-y-2">
            {recentAttempts.map((a) => {
              const correct = a.answers.filter((ans) => ans.isCorrect).length;
              const pct = scorePercent(correct, a.answers.length);
              return (
                <div key={a.id} className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{a.assignment?.practiceSet.name ?? "Practice Set"}</p>
                    <p className="mt-0.5 text-xs text-gray-500">{a.submittedAt ? formatDate(a.submittedAt) : "—"}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-gray-900">{correct}/{a.answers.length}</span>
                    <span className="text-sm font-semibold text-blue-700">{pct}%</span>
                    <CheckCircle size={14} className="text-green-600" />
                  </div>
                </div>
              );
            })}
            {recentAttempts.length === 0 && <div className="rounded-lg border border-gray-200 bg-white p-8 text-center text-sm text-gray-400">No submitted attempts.</div>}
          </div>
        </section>
      </div>
    </div>
  );
}
