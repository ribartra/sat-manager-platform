import { PageShell } from "@/components/sat";
import prisma from "@/lib/prisma";
import { requireTeacherOrAdmin } from "@/lib/rbac";
import { studentAccessWhereFor } from "@/lib/program-scope";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody } from "@/components/ui/card";
import { formatDate, scorePercent } from "@/lib/utils";
import { BookOpen, CheckCircle, Clock, TrendingUp } from "lucide-react";
import { withSqliteRetry } from "@/lib/sqlite-retry";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ studentId: string }>;
}

function StudentViewUnavailable({
  title,
  message,
  backHref = "/teacher/students",
}: {
  title: string;
  message: string;
  backHref?: string;
}) {
  return (
    <PageShell width="narrow">
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-6 text-center">
        <h1 className="text-lg font-semibold text-amber-900">{title}</h1>
        <p className="mt-2 text-sm text-amber-800">{message}</p>
        <Link href={backHref} className="mt-5 inline-flex text-sm font-medium text-amber-900 underline">
          Back to Students
        </Link>
      </div>
    </PageShell>
  );
}

export default async function ImpersonateStudentPage({ params }: PageProps) {
  const session = await requireTeacherOrAdmin();
  if (!session) redirect("/login");

  const { studentId } = await params;
  const student = await withSqliteRetry(() => prisma.user.findUnique({
    where: { id: studentId },
    select: { id: true, name: true, email: true, role: true, active: true, validationStatus: true },
  }));
  if (!student || student.role !== "STUDENT") {
    console.warn("[student-view] student not found or not a student", { studentId, teacherId: session.user.id });
    return (
      <StudentViewUnavailable
        title="Student view is not available"
        message="We could not find an active student for this link. Check the student id or return to the students list."
      />
    );
  }

  const inTeacherScope =
    session.user.role === "ADMIN" ||
    Boolean(
      await withSqliteRetry(() => prisma.user.findFirst({
        where: { id: studentId, ...studentAccessWhereFor(session.user) },
        select: { id: true },
      })),
    );

  if (!inTeacherScope) {
    console.warn("[student-view] student outside teacher program scope", {
      studentId,
      studentEmail: student.email,
      teacherId: session.user.id,
    });
    return (
      <StudentViewUnavailable
        title="Student view is not available"
        message="This student is not currently assigned to one of your active programs."
      />
    );
  }

  try {
    await withSqliteRetry(() => prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "IMPERSONATE_STUDENT_VIEW",
        targetType: "User",
        targetId: student.id,
        metadata: JSON.stringify({ studentEmail: student.email }),
      },
    }));
  } catch (error) {
    console.warn("[student-view] audit write failed", {
      studentId,
      studentEmail: student.email,
      teacherId: session.user.id,
      error: error instanceof Error ? error.message : "unknown_error",
    });
  }

  const dashboard = await Promise.all([
    withSqliteRetry(() => prisma.assignment.findMany({
      where: { studentId, locked: false, status: { in: ["PENDING", "IN_PROGRESS"] } },
      include: { practiceSet: { include: { topic: { include: { domain: { include: { section: true } } } } } } },
      orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
      take: 10,
    })),
    withSqliteRetry(() => prisma.fullPracticeTestAssignment.findMany({
      where: { studentId, status: { in: ["PENDING", "IN_PROGRESS", "OVERDUE"] } },
      include: { test: { select: { id: true, name: true } } },
      orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
      take: 10,
    })),
    withSqliteRetry(() => prisma.attempt.findMany({
      where: { studentId, status: "SUBMITTED" },
      include: { answers: true, assignment: { include: { practiceSet: { include: { topic: true } } } } },
      orderBy: { submittedAt: "desc" },
      take: 5,
    })),
    withSqliteRetry(() => prisma.attempt.aggregate({ where: { studentId, status: "SUBMITTED" }, _count: { id: true } })),
  ]).catch((error) => {
    console.error("[student-view] dashboard query failed", {
      studentId,
      studentEmail: student.email,
      teacherId: session.user.id,
      error: error instanceof Error ? error.message : "unknown_error",
    });
    return null;
  });

  if (!dashboard) {
    return (
      <StudentViewUnavailable
        title="Student view is not available"
        message="Something went wrong loading this student's dashboard. Try again or return to the students list."
        backHref={`/teacher/students/${student.id}`}
      />
    );
  }

  const [assignments, examAssignments, recentAttempts, stats] = dashboard;

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
      <PageShell>
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
              <div><p className="text-2xl font-bold text-gray-900">{assignments.length + examAssignments.length}</p><p className="text-xs text-gray-500">Pending tasks</p></div>
            </CardBody>
          </Card>
        </div>

        <section className="mb-8">
          <h2 className="mb-3 text-base font-semibold text-gray-900">Assigned to Student</h2>
          <div className="space-y-4">
            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Practice Sets</h3>
              <div className="space-y-2">
                {assignments.map((a) => (
                  <Card key={a.id} className="flex items-center justify-between px-4 py-3">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{a.practiceSet.name}</p>
                      <p className="mt-0.5 text-xs text-gray-500">
                        {a.practiceSet.topic.domain.practiceArea ?? a.practiceSet.topic.domain.section.label} · {a.practiceSet.topic.name}
                        {a.dueDate && <span className="ml-2 text-amber-600">Due: {formatDate(a.dueDate)}</span>}
                      </p>
                    </div>
                    <Badge variant={a.status === "IN_PROGRESS" ? "warning" : "info"}>{a.status}</Badge>
                  </Card>
                ))}
                {assignments.length === 0 && (
                  <Card padding="lg" className="text-center text-sm text-gray-400">
                    No active practice assignments.
                  </Card>
                )}
              </div>
            </div>
            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--sat-area-mocks)]">Full Practice Tests</h3>
              <div className="space-y-2">
                {examAssignments.map((a) => (
                  <Card key={a.id} className="flex items-center justify-between px-4 py-3">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{a.test.name}</p>
                      <p className="mt-0.5 text-xs text-gray-500">
                        Mock exam
                        {a.dueDate && <span className="ml-2 text-amber-600">Due: {formatDate(a.dueDate)}</span>}
                      </p>
                    </div>
                    <Badge variant={a.status === "IN_PROGRESS" ? "warning" : "info"}>{a.status}</Badge>
                  </Card>
                ))}
                {examAssignments.length === 0 && (
                  <Card padding="lg" className="text-center text-sm text-gray-400">
                    No active Full Practice Tests.
                  </Card>
                )}
              </div>
            </div>
          </div>
        </section>

        <section>
          <h2 className="mb-3 text-base font-semibold text-gray-900">Recent Results</h2>
          <div className="space-y-2">
            {recentAttempts.map((a) => {
              const correct = a.answers.filter((ans) => ans.isCorrect).length;
              const pct = scorePercent(correct, a.answers.length);
              return (
                <Card key={a.id} className="flex items-center justify-between px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{a.assignment?.practiceSet.name ?? "Practice Set"}</p>
                    <p className="mt-0.5 text-xs text-gray-500">{a.submittedAt ? formatDate(a.submittedAt) : "—"}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-gray-900">{correct}/{a.answers.length}</span>
                    <span className="text-sm font-semibold text-blue-700">{pct}%</span>
                    <CheckCircle size={14} className="text-green-600" />
                  </div>
                </Card>
              );
            })}
            {recentAttempts.length === 0 && <Card padding="lg" className="text-center text-sm text-gray-400">No submitted attempts.</Card>}
          </div>
        </section>
      </PageShell>
    </div>
  );
}
