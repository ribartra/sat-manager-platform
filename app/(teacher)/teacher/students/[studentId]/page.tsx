import { PageShell, PracticeAreaTabs } from "@/components/sat";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";
import { formatDate, formatTime } from "@/lib/utils";
import { scoreBandTextClass, scoreBandBarClass } from "@/lib/score-band";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody } from "@/components/ui/card";
import { ChevronLeft, Eye } from "lucide-react";
import { StudentDetailActions } from "./actions-client";
import { refreshAssignmentStates } from "@/lib/assignments";
import { getFeatureSetting } from "@/lib/app-settings";
import { studentAccessWhereFor } from "@/lib/program-scope";
import { resolvePracticeSetAttemptScore } from "@/lib/practice-set-scoring";
import {
  activeAreaTab,
  practiceAreaFromTab,
  practiceAreaLabel,
} from "@/lib/practice-area";

interface PageProps {
  params: Promise<{ studentId: string }>;
  searchParams: Promise<{ area?: string }>;
}

export default async function StudentDetailPage({ params, searchParams }: PageProps) {
  const { studentId } = await params;
  const query = await searchParams;
  const area = activeAreaTab(query.area, "math");
  const practiceArea = practiceAreaFromTab(area);
  const isMocks = area === "mocks";

  const session = await auth();
  const now = new Date();
  await refreshAssignmentStates(now);
  const teacherGroupManagementEnabled =
    session?.user.role === "ADMIN" || (await getFeatureSetting("TEACHER_GROUP_MANAGEMENT"));
  const studentWhere = session
    ? studentAccessWhereFor(session.user, now)
    : { role: "STUDENT", active: true, validationStatus: "APPROVED" };

  const student = await prisma.user.findFirst({
    where: { id: studentId, ...studentWhere },
    include: {
      groups: { include: { group: true } },
      programEnrollments: { include: { program: true }, where: { active: true, status: "APPROVED" } },
    },
  });

  if (!student) notFound();

  const attempts = !isMocks
    ? await prisma.attempt.findMany({
        where: {
          studentId,
          status: "SUBMITTED",
          assignment: {
            practiceSet: {
              topic: { domain: { practiceArea: practiceArea! } },
            },
          },
        },
        include: {
          answers: true,
          assignment: {
            include: {
              practiceSet: { include: { topic: { include: { domain: { include: { section: true } } } } } },
            },
          },
        },
        orderBy: { submittedAt: "desc" },
      })
    : [];

  const assignments = !isMocks
    ? await prisma.assignment.findMany({
        where: {
          studentId,
          status: { in: ["PENDING", "IN_PROGRESS", "OVERDUE"] },
          practiceSet: { topic: { domain: { practiceArea: practiceArea! } } },
        },
        include: { practiceSet: { include: { topic: { include: { domain: true } } } } },
        orderBy: { createdAt: "desc" },
      })
    : [];

  const examAssignments = isMocks
    ? await prisma.fullPracticeTestAssignment.findMany({
        where: { studentId, status: { in: ["PENDING", "IN_PROGRESS", "OVERDUE"] } },
        include: { test: { select: { id: true, name: true } } },
        orderBy: { createdAt: "desc" },
      })
    : [];

  const pendingExamCount = isMocks
    ? examAssignments.length
    : await prisma.fullPracticeTestAssignment.count({
        where: { studentId, status: { in: ["PENDING", "IN_PROGRESS", "OVERDUE"] } },
      });

  const examAttempts = isMocks
    ? await prisma.fullPracticeTestAttempt.findMany({
        where: { studentId, status: "SUBMITTED" },
        include: { test: { select: { name: true } } },
        orderBy: { submittedAt: "desc" },
        take: 20,
      })
    : [];

  const totalSets = attempts.length;
  const totalTime = attempts.reduce((s, a) => s + (a.totalTime ?? 0), 0);
  const scoredAttempts = await Promise.all(
    attempts.map(async (a) => {
      const correct = a.answers.filter((ans) => ans.isCorrect).length;
      const total = a.answers.length;
      const sat = await resolvePracticeSetAttemptScore({
        scorePercent: a.scorePercent,
        scaledScore: a.scaledScore,
        scoreSection: a.scoreSection,
        correct,
        total,
        section: a.assignment?.practiceSet.topic.domain.section ?? null,
      });
      return { attempt: a, correct, total, sat };
    }),
  );
  const avgScore =
    scoredAttempts.length > 0
      ? Math.round(scoredAttempts.reduce((sum, row) => sum + row.sat.scorePercent, 0) / scoredAttempts.length)
      : null;

  const topicStats: Record<string, { name: string; correct: number; total: number; count: number }> = {};
  attempts.forEach((a) => {
    const topic = a.assignment?.practiceSet.topic;
    if (!topic) return;
    if (!topicStats[topic.id]) topicStats[topic.id] = { name: topic.name, correct: 0, total: 0, count: 0 };
    topicStats[topic.id].correct += a.answers.filter((ans) => ans.isCorrect).length;
    topicStats[topic.id].total += a.answers.length;
    topicStats[topic.id].count += 1;
  });

  const pendingTasks = isMocks ? examAssignments.length : assignments.length;
  const areaLabel = isMocks ? "Full Practice Tests" : practiceAreaLabel(practiceArea);

  return (
    <PageShell>
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-6">
        <Link href="/teacher" className="hover:text-blue-600 flex items-center gap-1">
          <ChevronLeft size={14} /> Students
        </Link>
        <span>/</span>
        <span className="text-gray-900 font-medium">{student.name}</span>
      </div>

      <div className="mb-6 space-y-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">{student.name}</h1>
          <p className="mt-0.5 text-sm text-gray-500">
            {student.email} · {student.phone ?? "—"}
            {student.startDate && (
              <> · Start date: {formatDate(student.startDate)}</>
            )}
            {teacherGroupManagementEnabled && (
              <> · Groups: {student.groups.map((g) => g.group.name).join(", ") || "—"}</>
            )}
            {" · "}Programs: {student.programEnrollments.map((e) => e.program.name).join(", ") || "—"}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            href={`/teacher/students/${studentId}/assign`}
            className="inline-flex h-9 items-center justify-center rounded-md bg-blue-600 px-3 text-sm font-medium text-white hover:bg-blue-700"
          >
            + Assign Practice
          </Link>
          <Link
            href={`/teacher/students/${studentId}/assign-exam`}
            className="inline-flex h-9 items-center justify-center rounded-md border border-blue-600 px-3 text-sm font-medium text-blue-700 hover:bg-blue-50"
          >
            + Assign Exam
          </Link>
          <Link
            href={`/teacher/analytics?studentId=${studentId}&area=${area}`}
            className="inline-flex h-9 items-center justify-center rounded-md border border-gray-300 bg-white px-3 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Analytics
          </Link>
          <Link
            href={`/teacher/impersonate/${studentId}?area=${area}`}
            className="inline-flex h-9 items-center justify-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <Eye size={14} /> View as Student
          </Link>
          <Link
            href={`/teacher/students/${studentId}/edit`}
            className="inline-flex h-9 items-center justify-center rounded-md border border-gray-300 bg-white px-3 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Edit Student
          </Link>
          <Link
            href={`/teacher/students/${studentId}/report?area=${area}`}
            className="inline-flex h-9 items-center justify-center rounded-md border border-gray-300 bg-white px-3 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Report
          </Link>
          <StudentDetailActions studentId={studentId} isActive={student.active} />
        </div>
      </div>

      <PracticeAreaTabs basePath={`/teacher/students/${studentId}`} active={area} />

      {!isMocks && pendingExamCount > 0 && (
        <div className="mb-4 rounded-md border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-900">
          {pendingExamCount} active Full Practice Test{pendingExamCount === 1 ? "" : "s"} assigned.{" "}
          <Link href={`/teacher/students/${studentId}?area=mocks`} className="font-medium underline">
            Open Full Practice Tests tab →
          </Link>
        </div>
      )}

      {isMocks ? (
        <>
          <div className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-4">
            {[
              { label: "Exams completed", value: examAttempts.length },
              {
                label: "Latest total",
                value: examAttempts[0]?.totalScore ?? "—",
                className: "text-[var(--sat-area-mocks)]",
              },
              {
                label: "Latest R&W",
                value: examAttempts[0]?.rwScore ?? "—",
              },
              {
                label: "Latest Math",
                value: examAttempts[0]?.mathScore ?? "—",
              },
            ].map(({ label, value, className }) => (
              <Card key={label} className="h-full">
                <CardBody className="flex h-full min-h-[88px] flex-col justify-center">
                  <p className={`text-2xl font-bold leading-none ${className ?? "text-gray-900"}`}>{value}</p>
                  <p className="mt-2 text-xs text-gray-500">{label}</p>
                </CardBody>
              </Card>
            ))}
          </div>

          <div className="grid grid-cols-3 gap-6">
            <div className="col-span-2">
              <h2 className="mb-3 text-base font-semibold text-[var(--sat-area-mocks)]">Exam History</h2>
              <Card className="overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50">
                      <th className="px-4 py-2.5 text-left font-medium text-gray-500">Date</th>
                      <th className="px-4 py-2.5 text-left font-medium text-gray-500">Exam</th>
                      <th className="px-4 py-2.5 text-right font-medium text-gray-500">SAT Total</th>
                      <th className="px-4 py-2.5 text-right font-medium text-gray-500">R&amp;W</th>
                      <th className="px-4 py-2.5 text-right font-medium text-gray-500">Math</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {examAttempts.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-10 text-center text-sm text-gray-400">
                          No completed full practice tests yet.
                        </td>
                      </tr>
                    ) : (
                      examAttempts.map((exam) => (
                        <tr key={exam.id} className="hover:bg-gray-50">
                          <td className="whitespace-nowrap px-4 py-3 text-gray-500">
                            {exam.submittedAt ? formatDate(exam.submittedAt) : "—"}
                          </td>
                          <td className="px-4 py-3 font-medium text-gray-900">{exam.test.name}</td>
                          <td className="px-4 py-3 text-right font-semibold text-gray-900">{exam.totalScore ?? "—"}</td>
                          <td className="px-4 py-3 text-right text-gray-700">{exam.rwScore ?? "—"}</td>
                          <td className="px-4 py-3 text-right text-gray-700">{exam.mathScore ?? "—"}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </Card>
            </div>

            <div>
              <h2 className="mb-3 text-base font-semibold text-[var(--sat-area-mocks)]">Active Full Practice Tests</h2>
              <div className="space-y-2">
                {examAssignments.map((a) => (
                  <Card key={a.id} padding="sm">
                    <p className="text-xs font-medium text-gray-800">{a.test.name}</p>
                    <div className="mt-1 flex items-center gap-2">
                      <Badge variant={a.status === "IN_PROGRESS" ? "warning" : "info"}>{a.status}</Badge>
                      {a.dueDate && <span className="text-xs text-gray-400">Due {formatDate(a.dueDate)}</span>}
                    </div>
                  </Card>
                ))}
                {examAssignments.length === 0 && (
                  <p className="text-sm text-gray-400">No active Full Practice Tests.</p>
                )}
                <p className="mt-3 text-xs text-gray-400">Pending tasks in this tab: {pendingTasks}</p>
              </div>
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-4">
            {[
              { label: "Sets completed", value: totalSets },
              { label: "Avg %", value: avgScore !== null ? `${avgScore}%` : "—", className: scoreBandTextClass(avgScore) },
              { label: "Total time", value: totalTime > 0 ? formatTime(totalTime) : "—" },
              { label: "Pending tasks", value: pendingTasks },
            ].map(({ label, value, className }) => (
              <Card key={label} className="h-full">
                <CardBody className="flex h-full min-h-[88px] flex-col justify-center">
                  <p className={`text-2xl font-bold leading-none ${className ?? "text-gray-900"}`}>{value}</p>
                  <p className="mt-2 text-xs text-gray-500">{label} · {areaLabel}</p>
                </CardBody>
              </Card>
            ))}
          </div>

          <div className="grid grid-cols-3 gap-6">
            <div className="col-span-2">
              <h2 className="mb-3 text-base font-semibold text-gray-900">Practice History</h2>
              <Card className="overflow-hidden">
                {attempts.length === 0 ? (
                  <div className="py-10 text-center text-sm text-gray-400">No completed {areaLabel} attempts yet.</div>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 bg-gray-50">
                        <th className="px-4 py-2.5 text-left font-medium text-gray-500">Date</th>
                        <th className="px-4 py-2.5 text-left font-medium text-gray-500">Practice Set</th>
                        <th className="px-4 py-2.5 text-right font-medium text-gray-500">Score</th>
                        <th className="px-4 py-2.5 text-right font-medium text-gray-500">Time</th>
                        <th className="px-4 py-2.5 text-right font-medium text-gray-500">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {scoredAttempts.map(({ attempt: a, correct, total, sat }) => {
                        const pct = sat.scorePercent;
                        return (
                          <tr key={a.id} className="hover:bg-gray-50">
                            <td className="whitespace-nowrap px-4 py-3 text-gray-500">
                              {a.submittedAt ? formatDate(a.submittedAt) : "—"}
                            </td>
                            <td className="px-4 py-3">
                              <p className="font-medium text-gray-900">{a.assignment?.practiceSet.name ?? "—"}</p>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <span className="font-medium">{correct}/{total}</span>
                              <span className={`ml-1 text-xs font-semibold ${scoreBandTextClass(pct)}`}>
                                ({pct}%)
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right text-gray-500">
                              {a.totalTime ? formatTime(a.totalTime) : "—"}
                            </td>
                            <td className="px-4 py-3 text-right">
                              <Link
                                href={`/teacher/students/${studentId}/attempts/${a.id}`}
                                className="mr-2 text-xs text-blue-600 hover:underline"
                              >
                                View
                              </Link>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </Card>
            </div>

            <div>
              <h2 className="mb-3 text-base font-semibold text-gray-900">By Skill</h2>
              <div className="space-y-2">
                {Object.values(topicStats).map((ts) => {
                  const avg = Math.round((ts.correct / ts.total) * 100);
                  return (
                    <Card key={ts.name} padding="sm">
                      <div className="mb-1 flex items-center justify-between">
                        <span className="truncate text-xs font-medium text-gray-700">{ts.name}</span>
                        <span className={`text-xs font-semibold ${scoreBandTextClass(avg)}`}>{avg}%</span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-gray-100">
                        <div className={`h-full rounded-full ${scoreBandBarClass(avg)}`} style={{ width: `${avg}%` }} />
                      </div>
                      <p className="mt-1 text-xs text-gray-400">
                        {ts.count} attempts · {ts.correct}/{ts.total}
                      </p>
                    </Card>
                  );
                })}
                {Object.keys(topicStats).length === 0 && (
                  <p className="text-sm text-gray-400">No {areaLabel} skill data yet.</p>
                )}
              </div>

              {assignments.length > 0 && (
                <div className="mt-5">
                  <h2 className="mb-2 text-sm font-semibold text-gray-900">Active Practice Sets</h2>
                  <div className="space-y-2">
                    {assignments.map((a) => (
                      <Card key={a.id} padding="sm">
                        <p className="text-xs font-medium text-gray-800">{a.practiceSet.name}</p>
                        <p className="mt-0.5 text-[11px] text-gray-400">
                          {practiceAreaLabel(a.practiceSet.topic.domain.practiceArea)} · {a.practiceSet.topic.name}
                        </p>
                        <div className="mt-1 flex items-center gap-2">
                          <Badge variant={a.status === "IN_PROGRESS" ? "warning" : "info"}>{a.status}</Badge>
                          {a.locked && <Badge variant="danger">Locked</Badge>}
                          {a.dueDate && <span className="text-xs text-gray-400">Due {formatDate(a.dueDate)}</span>}
                        </div>
                      </Card>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </PageShell>
  );
}
