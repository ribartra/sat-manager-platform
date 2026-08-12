import prisma from "@/lib/prisma";
import Link from "next/link";
import { formatDate } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody } from "@/components/ui/card";
import { AlertTriangle, UserPlus } from "lucide-react";
import { UnlockRequestActions } from "./unlock-request-actions-client";
import { auth } from "@/lib/auth";
import { getFeatureSetting } from "@/lib/app-settings";
import { refreshAssignmentStates } from "@/lib/assignments";
import { studentAccessWhereFor, teacherProgramEnrollmentScope } from "@/lib/program-scope";
import { getStudentLastActiveMap } from "@/lib/activity";
import { academicTopicWhere } from "@/lib/taxonomy";

interface PageProps {
  searchParams: Promise<{
    q?: string;
    group?: string;
    topic?: string;
    difficulty?: string;
    from?: string;
    to?: string;
  }>;
}

function parseDateParam(value?: string, endOfDay = false) {
  if (!value) return undefined;
  const date = new Date(`${value}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}`);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

export default async function TeacherDashboard({ searchParams }: PageProps) {
  const session = await auth();
  const now = new Date();
  await refreshAssignmentStates(now);
  const programScope =
    session?.user.role === "TEACHER"
      ? teacherProgramEnrollmentScope(session.user.id, now)
      : undefined;
  const params = await searchParams;
  const search = params.q?.trim() ?? "";
  const teacherGroupManagementEnabled =
    session?.user.role === "ADMIN" || (await getFeatureSetting("TEACHER_GROUP_MANAGEMENT"));
  const groupId = teacherGroupManagementEnabled ? params.group || "" : "";
  const topicId = params.topic || "";
  const difficulty = params.difficulty || "";
  const fromDate = parseDateParam(params.from);
  const toDate = parseDateParam(params.to, true);
  const practiceSetFilter = {
    ...(topicId ? { topicId } : {}),
    ...(difficulty ? { difficulty } : {}),
  };
  const hasAttemptFilter = topicId || difficulty || fromDate || toDate;

  const studentWhere = {
    ...(session ? studentAccessWhereFor(session.user, now) : { role: "STUDENT", active: true, validationStatus: "APPROVED" }),
    ...(search
      ? {
          OR: [
            { name: { contains: search } },
            { email: { contains: search } },
          ],
        }
      : {}),
    ...(teacherGroupManagementEnabled && groupId ? { groups: { some: { groupId } } } : {}),
  };

  const studentUnlockRequestsEnabled = await getFeatureSetting("STUDENT_UNLOCK_REQUESTS");

  const [students, groups, topics, lastActiveMap] = await Promise.all([
    prisma.user.findMany({
      where: studentWhere,
      include: {
        groups: { include: { group: true } },
        programEnrollments: { include: { program: true }, where: { active: true, status: "APPROVED" } },
        attempts: {
          where: {
            status: "SUBMITTED",
            ...(fromDate || toDate
              ? {
                  submittedAt: {
                    ...(fromDate ? { gte: fromDate } : {}),
                    ...(toDate ? { lte: toDate } : {}),
                  },
                }
              : {}),
            ...(topicId || difficulty
              ? {
                  assignment: {
                    practiceSet: practiceSetFilter,
                  },
                }
              : {}),
          },
          orderBy: { submittedAt: "desc" },
          take: 20,
          include: {
            answers: true,
            assignment: { include: { practiceSet: { include: { topic: true } } } },
          },
        },
        assignments: {
          where: { status: { in: ["PENDING", "OVERDUE"] } },
        },
      },
      orderBy: { name: "asc" },
    }),
    teacherGroupManagementEnabled ? prisma.group.findMany({ orderBy: { name: "asc" } }) : Promise.resolve([]),
    prisma.topic.findMany({
      where: academicTopicWhere,
      include: { domain: { include: { section: true } } },
      orderBy: { name: "asc" },
    }),
    getStudentLastActiveMap(),
  ]);

  const [overdueAssignments, unlockRequests] = await Promise.all([
    prisma.assignment.findMany({
      where: {
        dueDate: { lt: new Date() },
        status: { in: ["PENDING", "IN_PROGRESS"] },
        student: {
          active: true,
          validationStatus: "APPROVED",
          ...(programScope ? { programEnrollments: programScope } : {}),
        },
      },
      include: { student: true, practiceSet: true },
      take: 5,
      orderBy: { dueDate: "asc" },
    }),
    studentUnlockRequestsEnabled
      ? prisma.unlockRequest.findMany({
          where: {
            status: "PENDING",
            assignment: {
              student: {
                active: true,
                validationStatus: "APPROVED",
                ...(programScope ? { programEnrollments: programScope } : {}),
              },
            },
          },
          include: { assignment: { include: { student: true, practiceSet: true } } },
          orderBy: { createdAt: "desc" },
          take: 5,
        })
      : Promise.resolve([]),
  ]);

  const fiveDaysAgo = new Date();
  fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);
  const inactiveStudents = students.filter((s) => {
    const lastActiveAt = lastActiveMap.get(s.id);
    if (!lastActiveAt) return true;
    return lastActiveAt < fiveDaysAgo;
  });
  const performanceBuckets = new Map<string, { label: string; correct: number; total: number; attempts: number }>();
  for (const student of students) {
    for (const attempt of student.attempts) {
      const practiceSet = attempt.assignment?.practiceSet;
      if (!practiceSet) continue;
      const key = `${practiceSet.topicId}:${practiceSet.difficulty}`;
      const bucket =
        performanceBuckets.get(key) ?? {
          label: `${practiceSet.topic.name} · ${practiceSet.difficulty}`,
          correct: 0,
          total: 0,
          attempts: 0,
        };
      bucket.correct += attempt.answers.filter((answer) => answer.isCorrect).length;
      bucket.total += attempt.answers.length;
      bucket.attempts += 1;
      performanceBuckets.set(key, bucket);
    }
  }
  const lowPerformance = Array.from(performanceBuckets.values())
    .filter((bucket) => bucket.total > 0)
    .map((bucket) => ({ ...bucket, score: Math.round((bucket.correct / bucket.total) * 100) }))
    .sort((a, b) => a.score - b.score)
    .slice(0, 3);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Students</h1>
        <Link
          href="/teacher/students/invite"
          className="flex items-center gap-1.5 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          <UserPlus size={14} /> Invite Student
        </Link>
      </div>

      <Card as="form" padding="md" className="mb-5 grid gap-3 md:grid-cols-6">
        <label className="text-xs font-medium text-gray-600 md:col-span-2">
          Search
          <input
            name="q"
            defaultValue={search}
            placeholder="Name or email"
            className="mt-1 w-full rounded-md border border-gray-300 px-2 py-2 text-sm text-gray-900"
          />
        </label>
        {teacherGroupManagementEnabled && (
          <label className="text-xs font-medium text-gray-600">
            Group
            <select name="group" defaultValue={groupId} className="mt-1 w-full rounded-md border border-gray-300 px-2 py-2 text-sm text-gray-900">
              <option value="">All</option>
              {groups.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="text-xs font-medium text-gray-600">
          Topic
          <select name="topic" defaultValue={topicId} className="mt-1 w-full rounded-md border border-gray-300 px-2 py-2 text-sm text-gray-900">
            <option value="">All</option>
            {topics.map((topic) => (
              <option key={topic.id} value={topic.id}>
                {topic.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-medium text-gray-600">
          Difficulty
          <select name="difficulty" defaultValue={difficulty} className="mt-1 w-full rounded-md border border-gray-300 px-2 py-2 text-sm text-gray-900">
            <option value="">All</option>
            <option value="EASY">Easy</option>
            <option value="MEDIUM">Medium</option>
            <option value="HARD">Hard</option>
          </select>
        </label>
        <label className="text-xs font-medium text-gray-600">
          From
          <input name="from" type="date" defaultValue={params.from || ""} className="mt-1 w-full rounded-md border border-gray-300 px-2 py-2 text-sm text-gray-900" />
        </label>
        <label className="text-xs font-medium text-gray-600">
          To
          <input name="to" type="date" defaultValue={params.to || ""} className="mt-1 w-full rounded-md border border-gray-300 px-2 py-2 text-sm text-gray-900" />
        </label>
        <div className="flex items-center gap-2 md:col-span-6">
          <button type="submit" className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700">
            Apply filters
          </button>
          <Link href="/teacher" className="rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
            Clear
          </Link>
        </div>
      </Card>

      {/* Alerts */}
      {(inactiveStudents.length > 0 || overdueAssignments.length > 0 || unlockRequests.length > 0) && (
        <Card variant="warning" padding="sm" className="mb-5">
          <div className="flex items-center gap-2">
            <AlertTriangle size={16} className="shrink-0 text-amber-600" />
            <div className="text-sm text-amber-800">
              {inactiveStudents.length > 0 && <p><strong>{inactiveStudents.length} student{inactiveStudents.length > 1 ? "s" : ""}</strong> haven&apos;t practiced in 5+ days: {inactiveStudents.map((s) => s.name).join(", ")}</p>}
              {overdueAssignments.length > 0 && <p><strong>{overdueAssignments.length}</strong> overdue assignment{overdueAssignments.length > 1 ? "s" : ""} need attention.</p>}
              {unlockRequests.length > 0 && <p><strong>{unlockRequests.length}</strong> pending unlock request{unlockRequests.length > 1 ? "s" : ""}.</p>}
            </div>
          </div>
        </Card>
      )}

      {lowPerformance.length > 0 && (
        <div className="mb-5 grid gap-3 md:grid-cols-3">
          {lowPerformance.map((bucket) => (
            <Card key={bucket.label} variant="danger" padding="sm">
              <p className="text-xs font-medium text-red-700">Low performance</p>
              <p className="mt-1 truncate text-sm font-semibold text-gray-900">{bucket.label}</p>
              <p className="mt-1 text-xs text-gray-600">
                {bucket.score}% avg · {bucket.attempts} attempt{bucket.attempts !== 1 ? "s" : ""}
              </p>
            </Card>
          ))}
        </div>
      )}

      {/* Students table */}
      {unlockRequests.length > 0 && (
        <Card className="mb-6">
          <CardBody className="p-4">
            <h2 className="mb-3 text-sm font-semibold text-gray-900">Unlock Requests</h2>
            <div className="space-y-2">
              {unlockRequests.map((request) => (
                <div key={request.id} className="flex items-center justify-between border-b border-gray-100 pb-2 last:border-b-0 last:pb-0">
                  <p className="text-sm text-gray-700">
                    <strong>{request.assignment.student.name}</strong> requested <strong>{request.assignment.practiceSet.name}</strong>
                  </p>
                  <UnlockRequestActions requestId={request.id} />
                </div>
              ))}
            </div>
          </CardBody>
        </Card>
      )}

      {/* Students table */}
      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="px-4 py-3 text-left font-medium text-gray-500">Name</th>
              {teacherGroupManagementEnabled && <th className="px-4 py-3 text-left font-medium text-gray-500">Group</th>}
              <th className="px-4 py-3 text-left font-medium text-gray-500">Last Active</th>
              <th className="px-4 py-3 text-right font-medium text-gray-500">Pending</th>
              <th className="px-4 py-3 text-right font-medium text-gray-500">Avg Score</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {students.map((student) => {
              const lastActiveAt = lastActiveMap.get(student.id);
              const inactive = !lastActiveAt || lastActiveAt < fiveDaysAgo;
              const studentGroups = teacherGroupManagementEnabled
                ? student.groups.map((gm) => gm.group.name).join(", ")
                : "";
              const programs = student.programEnrollments.map((pe) => pe.program.name).join(", ");

              const avgScore = student.attempts.length
                ? Math.round(
                    (student.attempts.reduce((sum, attempt) => {
                      const correct = attempt.answers.filter((a) => a.isCorrect).length;
                      return sum + correct / Math.max(attempt.answers.length, 1);
                    }, 0) /
                      student.attempts.length) *
                      100
                  )
                : null;

              return (
                <tr key={student.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900">{student.name}</p>
                    <p className="text-xs text-gray-400">{student.email}</p>
                    <p className="text-xs text-gray-400">Programs: {programs || "—"}</p>
                  </td>
                  {teacherGroupManagementEnabled && <td className="px-4 py-3 text-gray-500">{studentGroups || "—"}</td>}
                  <td className="px-4 py-3 text-gray-500">
                    {lastActiveAt ? (
                      <span className={inactive ? "text-amber-600" : ""}>
                        {formatDate(lastActiveAt)}
                        {inactive && " ⚠"}
                      </span>
                    ) : (
                      <span className="text-red-400">Never</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {student.assignments.length > 0 ? (
                      <Badge variant="warning">{student.assignments.length}</Badge>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {avgScore !== null ? (
                      <span className={`font-medium ${avgScore >= 80 ? "text-green-600" : avgScore >= 60 ? "text-yellow-600" : "text-red-500"}`}>
                        {avgScore}%
                        {hasAttemptFilter && <span className="ml-1 text-xs font-normal text-gray-400">filtered</span>}
                      </span>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={student.active ? "success" : "danger"}>
                      {student.active ? "Active" : "Inactive"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-3">
                      <Link href={`/teacher/analytics?studentId=${student.id}`} className="text-xs text-blue-600 hover:underline">
                        Analytics
                      </Link>
                      <Link href={`/teacher/students/${student.id}`} className="text-xs text-blue-600 hover:underline">
                        View →
                      </Link>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {students.length === 0 && (
          <div className="text-center py-12 text-gray-400">
            <p>No students yet. Invite your first student.</p>
          </div>
        )}
      </Card>
    </div>
  );
}
