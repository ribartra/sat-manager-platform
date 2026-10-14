import { PageShell, PracticeAreaTabs } from "@/components/sat";
import prisma from "@/lib/prisma";
import { requireTeacherOrAdmin } from "@/lib/rbac";
import { studentAccessWhereFor } from "@/lib/program-scope";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody } from "@/components/ui/card";
import { formatDate } from "@/lib/utils";
import { assignmentStatusLabel } from "@/lib/domain-meta";
import { BookOpen, CheckCircle, Clock, TrendingUp } from "lucide-react";
import { withSqliteRetry } from "@/lib/sqlite-retry";
import {
  activeAreaTab,
  practiceAreaFromTab,
  practiceAreaLabel,
} from "@/lib/practice-area";
import { isAnsweredAnswer, summarizeAllQuestionAnswers } from "@/lib/weighted-score";
import { buildProgressHref, progressFiltersFromParams } from "@/lib/progress-filters";
import { Alert } from "@/components/sat/alert";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ studentId: string }>;
  searchParams: Promise<{
    area?: string;
    topic?: string;
    difficulty?: string;
    from?: string;
    to?: string;
  }>;
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
      <Alert tone="warning" title={title} role="alert">
        <p>{message}</p>
        <Link href={backHref} className="mt-3 inline-flex text-sm font-medium underline">
          Back to Students
        </Link>
      </Alert>
    </PageShell>
  );
}

export default async function ImpersonateStudentPage({ params, searchParams }: PageProps) {
  const session = await requireTeacherOrAdmin();
  if (!session) redirect("/login");

  const { studentId } = await params;
  const query = await searchParams;
  const filters = progressFiltersFromParams(query);
  const area = activeAreaTab(filters.area, filters.area);
  const practiceArea = practiceAreaFromTab(area);
  const isMocks = area === "tests";

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
    withSqliteRetry(() =>
      prisma.assignment.findMany({
        where: {
          studentId,
          locked: false,
          status: { in: ["PENDING", "IN_PROGRESS"] },
          ...(practiceArea
            ? { practiceSet: { topic: { domain: { practiceArea } } } }
            : { id: "__never__" }),
        },
        include: { practiceSet: { include: { topic: { include: { domain: { include: { section: true } } } } } } },
        orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
        take: 10,
      }),
    ),
    withSqliteRetry(() =>
      prisma.fullPracticeTestAssignment.findMany({
        where: {
          studentId,
          status: { in: ["PENDING", "IN_PROGRESS", "OVERDUE"] },
          ...(isMocks ? {} : { id: "__never__" }),
        },
        include: { test: { select: { id: true, name: true } } },
        orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
        take: 10,
      }),
    ),
    withSqliteRetry(() =>
      prisma.attempt.findMany({
        where: {
          studentId,
          status: "SUBMITTED",
          ...(practiceArea
            ? { assignment: { practiceSet: { topic: { domain: { practiceArea } } } } }
            : { id: "__never__" }),
        },
        include: {
          answers: true,
          assignment: { include: { practiceSet: { include: { topic: { include: { domain: true } } } } } },
        },
        orderBy: { submittedAt: "desc" },
        take: 5,
      }),
    ),
    withSqliteRetry(() =>
      prisma.attemptAnswer.findMany({
        where: {
          attempt: {
            studentId,
            status: "SUBMITTED",
            ...(practiceArea
              ? { assignment: { practiceSet: { topic: { domain: { practiceArea } } } } }
              : { id: "__never__" }),
          },
        },
        select: { answer: true, isCorrect: true },
      }),
    ),
    withSqliteRetry(() =>
      prisma.attempt.aggregate({
        where: {
          studentId,
          status: "SUBMITTED",
          ...(practiceArea
            ? { assignment: { practiceSet: { topic: { domain: { practiceArea } } } } }
            : { id: "__never__" }),
        },
        _count: { id: true },
      }),
    ),
    withSqliteRetry(() =>
      isMocks
        ? prisma.fullPracticeTestAttempt.count({ where: { studentId, status: "SUBMITTED" } })
        : Promise.resolve(0),
    ),
    withSqliteRetry(() =>
      prisma.fullPracticeTestAssignment.count({
        where: { studentId, status: { in: ["PENDING", "IN_PROGRESS", "OVERDUE"] } },
      }),
    ),
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

  const [assignments, examAssignments, recentAttempts, scoreAnswers, stats, examCompletedCount, pendingExamCount] = dashboard;

  const avgScore = summarizeAllQuestionAnswers(scoreAnswers).percent;

  const pendingCount = isMocks ? examAssignments.length : assignments.length;
  const completedCount = isMocks ? examCompletedCount : stats._count.id;
  const areaLabel = isMocks ? "Full Practice Tests" : practiceAreaLabel(practiceArea);

  return (
    <div>
      <Alert
        tone="warning"
        layout="banner"
        hideIcon
        className="py-2 text-sm"
        action={
          <Link href={buildProgressHref(`/teacher/students/${student.id}`, filters)} className="text-sm underline">
            Exit Student View
          </Link>
        }
      >
        <span className="font-medium">You are viewing as: {student.name}</span>
      </Alert>
      <PageShell>
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-gray-900">Hello, {student.name.split(" ")[0]}!</h1>
          <p className="mt-0.5 text-sm text-gray-500">Read-only student dashboard</p>
        </div>

        <PracticeAreaTabs basePath={`/teacher/impersonate/${studentId}`} active={area} preserve={{ difficulty: filters.difficulty, from: filters.from, to: filters.to }} />

        {!isMocks && pendingExamCount > 0 && (
          <div className="mb-4 rounded-md border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-900">
            {pendingExamCount} active Full Practice Test{pendingExamCount === 1 ? "" : "s"} assigned.{" "}
            <Link href={buildProgressHref(`/teacher/impersonate/${studentId}`, { ...filters, area: "tests" })} className="font-medium underline">
              Open Full Practice Tests tab →
            </Link>
          </div>
        )}

        <div className="mb-8 grid grid-cols-3 gap-4">
          <Card>
            <CardBody className="flex items-center gap-3">
              <BookOpen size={16} className="text-blue-600" />
              <div>
                <p className="text-2xl font-bold text-gray-900">{completedCount}</p>
                <p className="text-xs text-gray-500">{isMocks ? "Exams completed" : "Sets completed"} · {areaLabel}</p>
              </div>
            </CardBody>
          </Card>
          <Card>
            <CardBody className="flex items-center gap-3">
              <TrendingUp size={16} className="text-green-600" />
              <div>
                <p className="text-2xl font-bold text-gray-900">
                  {isMocks ? "—" : avgScore !== null ? `${avgScore}%` : "—"}
                </p>
                <p className="text-xs text-gray-500">{isMocks ? "Use R&W / Math on exams" : "Avg score"}</p>
              </div>
            </CardBody>
          </Card>
          <Card>
            <CardBody className="flex items-center gap-3">
              <Clock size={16} className="text-amber-600" />
              <div>
                <p className="text-2xl font-bold text-gray-900">{pendingCount}</p>
                <p className="text-xs text-gray-500">To do · {areaLabel}</p>
              </div>
            </CardBody>
          </Card>
        </div>

        <section className="mb-8">
          <h2 className="mb-3 text-base font-semibold text-gray-900">Assigned to Student</h2>
          {isMocks ? (
            <div className="space-y-2">
              {examAssignments.map((a) => (
                <Card key={a.id} className="flex items-center justify-between px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{a.test.name}</p>
                    <p className="mt-0.5 text-xs text-gray-500">
                      Full Practice Test · R&amp;W + Math
                      {a.dueDate && <span className="ml-2 text-amber-600">Due: {formatDate(a.dueDate)}</span>}
                    </p>
                  </div>
                  <Badge variant={a.status === "IN_PROGRESS" ? "warning" : "info"}>{assignmentStatusLabel(a.status)}</Badge>
                </Card>
              ))}
              {examAssignments.length === 0 && (
                <Card padding="lg" className="text-center text-sm text-gray-400">
                  No active Full Practice Tests.
                </Card>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {assignments.map((a) => (
                <Card key={a.id} className="flex items-center justify-between px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{a.practiceSet.name}</p>
                    <p className="mt-0.5 text-xs text-gray-500">
                      {practiceAreaLabel(a.practiceSet.topic.domain.practiceArea)} · {a.practiceSet.topic.name}
                      {a.dueDate && <span className="ml-2 text-amber-600">Due: {formatDate(a.dueDate)}</span>}
                    </p>
                  </div>
                  <Badge variant={a.status === "IN_PROGRESS" ? "warning" : "info"}>{assignmentStatusLabel(a.status)}</Badge>
                </Card>
              ))}
              {assignments.length === 0 && (
                <Card padding="lg" className="text-center text-sm text-gray-400">
                  No active {areaLabel} practice assignments.
                </Card>
              )}
            </div>
          )}
        </section>

        {!isMocks && (
          <section>
            <h2 className="mb-3 text-base font-semibold text-gray-900">Recent Results · {areaLabel}</h2>
            <div className="space-y-2">
              {recentAttempts.map((a) => {
                const score = summarizeAllQuestionAnswers(a.answers);
                const correct = score.correct;
                const total = score.total;
                const hasAnswered = a.answers.some(isAnsweredAnswer);
                return (
                  <Card key={a.id} className="flex items-center justify-between px-4 py-3">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{a.assignment?.practiceSet.name ?? "Practice Set"}</p>
                      <p className="mt-0.5 text-xs text-gray-500">{a.submittedAt ? formatDate(a.submittedAt) : "—"}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium text-gray-900">{hasAnswered ? `${correct}/${total}` : "—"}</span>
                      <span className="text-sm font-semibold text-blue-700">{hasAnswered ? `${score.percent}%` : "—"}</span>
                      <CheckCircle size={14} className="text-green-600" />
                    </div>
                  </Card>
                );
              })}
              {recentAttempts.length === 0 && (
                <Card padding="lg" className="text-center text-sm text-gray-400">
                  No submitted {areaLabel} attempts.
                </Card>
              )}
            </div>
          </section>
        )}
      </PageShell>
    </div>
  );
}
