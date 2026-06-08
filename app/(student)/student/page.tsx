import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import Link from "next/link";
import { formatDate, scorePercent } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody } from "@/components/ui/card";
import { Clock, BookOpen, TrendingUp, CheckCircle } from "lucide-react";

export default async function StudentDashboard() {
  const session = await auth();
  const userId = session!.user.id;

  const [assignments, recentAttempts, stats] = await Promise.all([
    prisma.assignment.findMany({
      where: {
        studentId: userId,
        locked: false,
        status: { in: ["PENDING", "IN_PROGRESS"] },
        OR: [{ unlockAt: null }, { unlockAt: { lte: new Date() } }],
      },
      include: { practiceSet: { include: { topic: { include: { domain: { include: { section: true } } } } } } },
      orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
      take: 10,
    }),
    prisma.attempt.findMany({
      where: { studentId: userId, status: "SUBMITTED" },
      include: {
        answers: true,
        assignment: { include: { practiceSet: { include: { topic: true } } } },
      },
      orderBy: { submittedAt: "desc" },
      take: 5,
    }),
    prisma.attempt.aggregate({
      where: { studentId: userId, status: "SUBMITTED" },
      _count: { id: true },
    }),
  ]);

  const totalSets = stats._count.id;

  const avgScore =
    recentAttempts.length > 0
      ? Math.round(
          recentAttempts.reduce((sum, a) => {
            const correct = a.answers.filter((ans) => ans.isCorrect).length;
            const total = a.answers.length;
            return sum + (total > 0 ? correct / total : 0);
          }, 0) /
            recentAttempts.length *
            100
        )
      : null;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">
          Hello, {session!.user.name.split(" ")[0]}!
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">Here&apos;s your practice overview</p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <Card>
          <CardBody className="flex items-center gap-3">
            <div className="rounded-full bg-blue-100 p-2">
              <BookOpen size={16} className="text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{totalSets}</p>
              <p className="text-xs text-gray-500">Sets completed</p>
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="flex items-center gap-3">
            <div className="rounded-full bg-green-100 p-2">
              <TrendingUp size={16} className="text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{avgScore !== null ? `${avgScore}%` : "—"}</p>
              <p className="text-xs text-gray-500">Avg score</p>
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="flex items-center gap-3">
            <div className="rounded-full bg-amber-100 p-2">
              <Clock size={16} className="text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{assignments.length}</p>
              <p className="text-xs text-gray-500">Pending tasks</p>
            </div>
          </CardBody>
        </Card>
      </div>

      {/* Pending assignments */}
      {assignments.length > 0 && (
        <section className="mb-8">
          <h2 className="text-base font-semibold text-gray-900 mb-3">Assigned to You</h2>
          <div className="space-y-2">
            {assignments.map((a) => (
              <div
                key={a.id}
                className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-4 py-3"
              >
                <div>
                  <p className="text-sm font-medium text-gray-900">{a.practiceSet.name}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {a.practiceSet.topic.domain.section.label} · {a.practiceSet.topic.name}
                    {a.dueDate && (
                      <span className="ml-2 text-amber-600">Due: {formatDate(a.dueDate)}</span>
                    )}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={a.practiceSet.difficulty === "EASY" ? "easy" : a.practiceSet.difficulty === "MEDIUM" ? "medium" : "hard"}>
                    {a.practiceSet.difficulty}
                  </Badge>
                  <Badge variant={a.status === "IN_PROGRESS" ? "warning" : "info"}>
                    {a.status === "IN_PROGRESS" ? "In Progress" : "Pending"}
                  </Badge>
                  <Link
                    href={`/student/practice/${a.practiceSetId}?assignmentId=${a.id}`}
                    className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
                  >
                    {a.status === "IN_PROGRESS" ? "Continue →" : "Start →"}
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Recent results */}
      {recentAttempts.length > 0 && (
        <section>
          <h2 className="text-base font-semibold text-gray-900 mb-3">Recent Results</h2>
          <div className="space-y-2">
            {recentAttempts.map((a) => {
              const correct = a.answers.filter((ans) => ans.isCorrect).length;
              const total = a.answers.length;
              const pct = scorePercent(correct, total);
              return (
                <div
                  key={a.id}
                  className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-4 py-3"
                >
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {a.assignment?.practiceSet.name ?? "Practice Set"}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {a.submittedAt ? formatDate(a.submittedAt) : "—"}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-gray-900">{correct}/{total}</span>
                    <span
                      className={`text-sm font-semibold ${pct >= 80 ? "text-green-600" : pct >= 60 ? "text-yellow-600" : "text-red-600"}`}
                    >
                      {pct}%
                    </span>
                    <Link
                      href={`/student/results/${a.id}`}
                      className="flex items-center gap-1 text-xs text-blue-600 hover:underline"
                    >
                      <CheckCircle size={12} /> Review
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {assignments.length === 0 && recentAttempts.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <BookOpen size={40} className="mx-auto mb-3" />
          <p className="font-medium">No assignments yet</p>
          <p className="text-sm mt-1">Your teacher will assign practice sets soon.</p>
        </div>
      )}
    </div>
  );
}
