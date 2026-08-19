import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import { formatDate, scorePercent } from "@/lib/utils";
import { scoreBandTextClass } from "@/lib/score-band";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody } from "@/components/ui/card";
import { Clock, BookOpen, TrendingUp, CheckCircle } from "lucide-react";
import { ParentApprovalCard } from "./parent-approval-card";
import { refreshAssignmentStates } from "@/lib/assignments";

export default async function StudentDashboard() {
  const session = await auth();
  const userId = session!.user.id;
  await refreshAssignmentStates();

  // Parents see their own dashboard with children's enrollment requests
  if (session!.user.role === "PARENT") {
    return <ParentDashboard parentId={userId} parentName={session!.user.name} />;
  }

  // Guard: only students without an active enrollment land on /student/program
  if (session!.user.role === "STUDENT") {
    const now = new Date();
    const activeEnrollment = await prisma.programEnrollment.findFirst({
      where: {
        studentId: userId,
        status: "APPROVED",
        active: true,
        program: {
          active: true,
          startDate: { lte: now },
          OR: [{ endDate: null }, { endDate: { gt: now } }],
        },
      },
    });
    if (!activeEnrollment) redirect("/student/program");
  }

  const [assignments, recentAttempts, stats] = await Promise.all([
    prisma.assignment.findMany({
      where: {
        studentId: userId,
        locked: false,
        status: { in: ["PENDING", "IN_PROGRESS", "OVERDUE"] },
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
              <p className="text-xs text-gray-500">Pending Practice Sets</p>
            </div>
          </CardBody>
        </Card>
      </div>

      {/* Pending assignments */}
      {assignments.length > 0 && (
        <section className="mb-8">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-base font-semibold text-gray-900">Assigned Practice Sets</h2>
            <Link href="/student/practice-sets" className="text-sm text-blue-600 hover:underline">View all</Link>
          </div>
          <div className="space-y-2">
            {assignments.map((a) => (
              <Card
                key={a.id}
                className="flex items-center justify-between px-4 py-3"
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
                    href={`/student/practice/assignment/${a.id}`}
                    className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
                  >
                    {a.status === "IN_PROGRESS" ? "Continue →" : "Start →"}
                  </Link>
                </div>
              </Card>
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
                <Card
                  key={a.id}
                  className="flex items-center justify-between px-4 py-3"
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
      className={`text-sm font-semibold ${scoreBandTextClass(pct)}`}
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
                </Card>
              );
            })}
          </div>
        </section>
      )}

      {assignments.length === 0 && recentAttempts.length === 0 && (
        <Card padding="lg" className="py-16 text-center text-gray-400">
          <BookOpen size={40} className="mx-auto mb-3" />
          <p className="font-medium">No assignments yet</p>
          <p className="text-sm mt-1">Your teacher will assign practice sets soon.</p>
        </Card>
      )}
    </div>
  );
}

// ─── Parent Dashboard ─────────────────────────────────────────────────────────

async function ParentDashboard({ parentId, parentName }: { parentId: string; parentName: string }) {
  const children = await prisma.parentStudent.findMany({
    where: { parentId },
    include: {
      student: {
        select: {
          id: true,
          name: true,
          email: true,
          active: true,
          programEnrollments: {
            include: { program: { select: { id: true, name: true } } },
            orderBy: { enrolledAt: "desc" },
          },
        },
      },
    },
  });

  const pendingApprovals = children.flatMap((link) =>
    link.student.programEnrollments
      .filter((e) => e.parentApprovalStatus === "PENDING")
      .map((e) => ({ student: link.student, enrollment: e }))
  );

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">
          Hello, {parentName.split(" ")[0]}!
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">Parent dashboard</p>
      </div>

      {/* Pending consent requests */}
      {pendingApprovals.length > 0 && (
        <section className="mb-8">
          <h2 className="text-base font-semibold text-gray-900 mb-3">
            Enrollment requests awaiting your approval
          </h2>
          <div className="space-y-3">
            {pendingApprovals.map(({ student, enrollment }) => (
              <ParentApprovalCard
                key={`${enrollment.programId}-${student.id}`}
                student={student}
                enrollment={enrollment}
              />
            ))}
          </div>
        </section>
      )}

      {/* Children overview */}
      <section>
        <h2 className="text-base font-semibold text-gray-900 mb-3">Your children</h2>
        {children.length === 0 ? (
          <p className="text-sm text-gray-400">No linked students yet.</p>
        ) : (
          <div className="space-y-3">
            {children.map((link) => (
              <Card
                key={link.student.id}
                className="px-4 py-3"
              >
                <p className="text-sm font-medium text-gray-900">{link.student.name}</p>
                <p className="text-xs text-gray-500 mt-0.5">{link.student.email}</p>
                {link.student.programEnrollments.length > 0 ? (
                  <div className="mt-2 space-y-1">
                    {link.student.programEnrollments.map((e) => (
                      <div key={e.programId} className="flex items-center gap-2 text-xs">
                        <span className="text-gray-600">{e.program.name}</span>
                        <span
                          className={`font-medium ${
                            e.status === "APPROVED"
                              ? "text-green-600"
                              : e.status === "PENDING"
                              ? "text-amber-600"
                              : "text-red-500"
                          }`}
                        >
                          {e.status}
                        </span>
                        {e.parentApprovalStatus === "PENDING" && (
                          <span className="text-amber-500">· awaiting your approval</span>
                        )}
                        {e.parentApprovalStatus === "APPROVED" && (
                          <span className="text-green-500">· you approved</span>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-gray-400 mt-1">No enrollments yet.</p>
                )}
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
