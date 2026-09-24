import { PageShell, PracticeAreaTabs } from "@/components/sat";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import { formatDate, scorePercent } from "@/lib/utils";
import { scoreBandTextClass } from "@/lib/score-band";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody } from "@/components/ui/card";
import { Clock, BookOpen, TrendingUp, CheckCircle, ClipboardList } from "lucide-react";
import { ParentApprovalCard } from "./parent-approval-card";
import { refreshAssignmentStates } from "@/lib/assignments";
import { difficultyBadgeVariant, difficultyLabel } from "@/lib/domain-meta";
import {
  activeAreaTab,
  practiceAreaFromTab,
  practiceAreaLabel,
} from "@/lib/practice-area";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ area?: string }>;
}

export default async function StudentDashboard({ searchParams }: PageProps) {
  const session = await auth();
  const userId = session!.user.id;
  await refreshAssignmentStates();

  // Parents see their own dashboard with children's enrollment requests
  if (session!.user.role === "PARENT") {
    return <ParentDashboard parentId={userId} parentName={session!.user.name} />;
  }

  const query = await searchParams;
  const area = activeAreaTab(query.area, "math");
  const practiceArea = practiceAreaFromTab(area);
  const isMocks = area === "mocks";
  const areaLabel = isMocks ? "Full Practice Tests" : practiceAreaLabel(practiceArea);

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

  const [assignments, examAssignments, recentAttempts, stats, examCompletedCount, pendingExamCount] =
    await Promise.all([
      !isMocks && practiceArea
        ? prisma.assignment.findMany({
            where: {
              studentId: userId,
              locked: false,
              status: { in: ["PENDING", "IN_PROGRESS", "OVERDUE"] },
              OR: [{ unlockAt: null }, { unlockAt: { lte: new Date() } }],
              practiceSet: { topic: { domain: { practiceArea } } },
            },
            include: {
              practiceSet: { include: { topic: { include: { domain: { include: { section: true } } } } } },
            },
            orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
            take: 10,
          })
        : Promise.resolve([]),
      isMocks
        ? prisma.fullPracticeTestAssignment.findMany({
            where: {
              studentId: userId,
              status: { in: ["PENDING", "IN_PROGRESS", "OVERDUE"] },
            },
            include: {
              test: { select: { id: true, name: true, breakMinutes: true } },
              attempts: { orderBy: { startedAt: "desc" }, take: 1 },
            },
            orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
            take: 10,
          })
        : Promise.resolve([]),
      !isMocks && practiceArea
        ? prisma.attempt.findMany({
            where: {
              studentId: userId,
              status: "SUBMITTED",
              assignment: { practiceSet: { topic: { domain: { practiceArea } } } },
            },
            include: {
              answers: true,
              assignment: { include: { practiceSet: { include: { topic: true } } } },
            },
            orderBy: { submittedAt: "desc" },
            take: 5,
          })
        : Promise.resolve([]),
      !isMocks && practiceArea
        ? prisma.attempt.aggregate({
            where: {
              studentId: userId,
              status: "SUBMITTED",
              assignment: { practiceSet: { topic: { domain: { practiceArea } } } },
            },
            _count: { id: true },
          })
        : Promise.resolve({ _count: { id: 0 } }),
      isMocks
        ? prisma.fullPracticeTestAttempt.count({ where: { studentId: userId, status: "SUBMITTED" } })
        : Promise.resolve(0),
      prisma.fullPracticeTestAssignment.count({
        where: { studentId: userId, status: { in: ["PENDING", "IN_PROGRESS", "OVERDUE"] } },
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
    <PageShell>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">
          Hello, {session!.user.name.split(" ")[0]}!
        </h1>
        <p className="mt-0.5 text-sm text-gray-500">Here&apos;s your practice overview</p>
      </div>

      <PracticeAreaTabs basePath="/student" active={area} />

      {!isMocks && pendingExamCount > 0 && (
        <div className="mb-4 rounded-md border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-900">
          {pendingExamCount} active Full Practice Test{pendingExamCount === 1 ? "" : "s"} assigned.{" "}
          <Link href="/student?area=mocks" className="font-medium underline">
            Open Full Practice Tests tab →
          </Link>
        </div>
      )}

      {isMocks ? (
        <>
          <div className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-2">
            <Card>
              <CardBody className="flex items-center gap-3">
                <div className="rounded-full bg-violet-100 p-2">
                  <ClipboardList size={16} className="text-violet-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">{examAssignments.length}</p>
                  <p className="text-xs text-gray-500">Pending exams</p>
                </div>
              </CardBody>
            </Card>
            <Card>
              <CardBody className="flex items-center gap-3">
                <div className="rounded-full bg-blue-100 p-2">
                  <BookOpen size={16} className="text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">{examCompletedCount}</p>
                  <p className="text-xs text-gray-500">Exams completed</p>
                </div>
              </CardBody>
            </Card>
          </div>

          <section className="mb-8">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-semibold text-gray-900">Assigned Exams</h2>
              <Link href="/student/content-map?area=mocks" className="text-sm text-blue-600 hover:underline">
                View all
              </Link>
            </div>
            {examAssignments.length === 0 ? (
              <Card padding="lg" className="text-center text-sm text-gray-400">
                No Full Practice Tests assigned yet.
              </Card>
            ) : (
              <div className="space-y-2">
                {examAssignments.map((assignment) => {
                  const attempt = assignment.attempts[0];
                  const inProgress = attempt?.status === "IN_PROGRESS";
                  return (
                    <Card key={assignment.id} className="flex items-center justify-between px-4 py-3">
                      <div>
                        <p className="text-sm font-medium text-gray-900">{assignment.test.name}</p>
                        <p className="mt-0.5 text-xs text-gray-500">
                          Full Practice Test ·{" "}
                          {assignment.test.breakMinutes > 0 ? "Optional break" : "No break"}
                          {assignment.dueDate && (
                            <span className="ml-2 text-amber-600">Due: {formatDate(assignment.dueDate)}</span>
                          )}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={inProgress ? "warning" : "info"}>
                          {inProgress ? "In Progress" : "Pending"}
                        </Badge>
                        <Link
                          href={`/student/full-tests/${assignment.id}`}
                          className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
                        >
                          {inProgress ? "Continue →" : "Start →"}
                        </Link>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </section>
        </>
      ) : (
        <>
          <div className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-3">
            <Card>
              <CardBody className="flex items-center gap-3">
                <div className="rounded-full bg-blue-100 p-2">
                  <BookOpen size={16} className="text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">{totalSets}</p>
                  <p className="text-xs text-gray-500">Sets completed · {areaLabel}</p>
                </div>
              </CardBody>
            </Card>
            <Card>
              <CardBody className="flex items-center gap-3">
                <div className="rounded-full bg-green-100 p-2">
                  <TrendingUp size={16} className="text-green-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">
                    {avgScore !== null ? `${avgScore}%` : "—"}
                  </p>
                  <p className="text-xs text-gray-500">Avg score · {areaLabel}</p>
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
                  <p className="text-xs text-gray-500">Pending · {areaLabel}</p>
                </div>
              </CardBody>
            </Card>
          </div>

          <section className="mb-8">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-semibold text-gray-900">Assigned Practice Sets</h2>
              <Link href={`/student/content-map?area=${area}`} className="text-sm text-blue-600 hover:underline">
                View all
              </Link>
            </div>
            {assignments.length === 0 ? (
              <Card padding="lg" className="text-center text-sm text-gray-400">
                No {areaLabel} practice sets assigned yet.
              </Card>
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
                    <div className="flex items-center gap-2">
                      <Badge variant={difficultyBadgeVariant(a.practiceSet.difficulty)}>
                        {difficultyLabel(a.practiceSet.difficulty)}
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
            )}
          </section>

          <section>
            <h2 className="mb-3 text-base font-semibold text-gray-900">Recent Results · {areaLabel}</h2>
            {recentAttempts.length === 0 ? (
              <Card padding="lg" className="text-center text-sm text-gray-400">
                No submitted {areaLabel} attempts yet.
              </Card>
            ) : (
              <div className="space-y-2">
                {recentAttempts.map((a) => {
                  const correct = a.answers.filter((ans) => ans.isCorrect).length;
                  const total = a.answers.length;
                  const pct = scorePercent(correct, total);
                  return (
                    <Card key={a.id} className="flex items-center justify-between px-4 py-3">
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {a.assignment?.practiceSet.name ?? "Practice Set"}
                        </p>
                        <p className="mt-0.5 text-xs text-gray-500">
                          {a.submittedAt ? formatDate(a.submittedAt) : "—"}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-medium text-gray-900">
                          {correct}/{total}
                        </span>
                        <span className={`text-sm font-semibold ${scoreBandTextClass(pct)}`}>{pct}%</span>
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
            )}
          </section>
        </>
      )}
    </PageShell>
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
    <PageShell width="narrow">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">
          Hello, {parentName.split(" ")[0]}!
        </h1>
        <p className="mt-0.5 text-sm text-gray-500">Parent dashboard</p>
      </div>

      {pendingApprovals.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 text-base font-semibold text-gray-900">
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

      <section>
        <h2 className="mb-3 text-base font-semibold text-gray-900">Your children</h2>
        {children.length === 0 ? (
          <p className="text-sm text-gray-400">No linked students yet.</p>
        ) : (
          <div className="space-y-3">
            {children.map((link) => (
              <Card key={link.student.id} className="px-4 py-3">
                <p className="text-sm font-medium text-gray-900">{link.student.name}</p>
                <p className="mt-0.5 text-xs text-gray-500">{link.student.email}</p>
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
                  <p className="mt-1 text-xs text-gray-400">No enrollments yet.</p>
                )}
              </Card>
            ))}
          </div>
        )}
      </section>
    </PageShell>
  );
}
