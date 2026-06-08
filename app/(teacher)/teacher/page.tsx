import prisma from "@/lib/prisma";
import Link from "next/link";
import { formatDate } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, UserPlus } from "lucide-react";
import { UnlockRequestActions } from "./unlock-request-actions-client";
import { auth } from "@/lib/auth";

export default async function TeacherDashboard() {
  const session = await auth();
  const programScope =
    session?.user.role === "TEACHER"
      ? {
          some: {
            active: true,
            program: {
              teachers: { some: { teacherId: session.user.id, active: true, teacher: { active: true } } },
              active: true,
              OR: [{ contractEndsAt: null }, { contractEndsAt: { gt: new Date() } }],
            },
          },
        }
      : undefined;

  const students = await prisma.user.findMany({
    where: { role: "STUDENT", ...(programScope ? { programEnrollments: programScope } : {}) },
    include: {
      groups: { include: { group: true } },
      programEnrollments: { include: { program: true }, where: { active: true } },
      attempts: {
        where: { status: "SUBMITTED" },
        orderBy: { submittedAt: "desc" },
        take: 1,
        include: { answers: true },
      },
      assignments: {
        where: { status: { in: ["PENDING", "OVERDUE"] } },
      },
    },
    orderBy: { name: "asc" },
  });

  const [overdueAssignments, unlockRequests] = await Promise.all([
    prisma.assignment.findMany({
      where: {
        dueDate: { lt: new Date() },
        status: { in: ["PENDING", "IN_PROGRESS"] },
        ...(programScope ? { student: { programEnrollments: programScope } } : {}),
      },
      include: { student: true, practiceSet: true },
      take: 5,
    }),
    prisma.unlockRequest.findMany({
      where: {
        status: "PENDING",
        ...(programScope ? { assignment: { student: { programEnrollments: programScope } } } : {}),
      },
      include: { assignment: { include: { student: true, practiceSet: true } } },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
  ]);

  // Compute last active from last submitted attempt
  const fiveDaysAgo = new Date();
  fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);
  const inactiveStudents = students.filter((s) => {
    const lastAttempt = s.attempts[0];
    if (!lastAttempt) return true;
    return lastAttempt.submittedAt! < fiveDaysAgo;
  });

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

      {/* Alerts */}
      {(inactiveStudents.length > 0 || overdueAssignments.length > 0 || unlockRequests.length > 0) && (
        <div className="mb-5 flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-200 px-4 py-3">
          <AlertTriangle size={16} className="text-amber-600 shrink-0" />
          <div className="text-sm text-amber-800">
            {inactiveStudents.length > 0 && <p><strong>{inactiveStudents.length} student{inactiveStudents.length > 1 ? "s" : ""}</strong> haven&apos;t practiced in 5+ days: {inactiveStudents.map((s) => s.name).join(", ")}</p>}
            {overdueAssignments.length > 0 && <p><strong>{overdueAssignments.length}</strong> overdue assignment{overdueAssignments.length > 1 ? "s" : ""} need attention.</p>}
            {unlockRequests.length > 0 && <p><strong>{unlockRequests.length}</strong> pending unlock request{unlockRequests.length > 1 ? "s" : ""}.</p>}
          </div>
        </div>
      )}

      {/* Students table */}
      {unlockRequests.length > 0 && (
        <div className="mb-6 rounded-lg border border-gray-200 bg-white p-4">
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
        </div>
      )}

      {/* Students table */}
      <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="px-4 py-3 text-left font-medium text-gray-500">Name</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">Group</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">Last Active</th>
              <th className="px-4 py-3 text-right font-medium text-gray-500">Pending</th>
              <th className="px-4 py-3 text-right font-medium text-gray-500">Avg Score</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {students.map((student) => {
              const lastAttempt = student.attempts[0];
              const inactive = !lastAttempt || lastAttempt.submittedAt! < fiveDaysAgo;
              const groups = student.groups.map((gm) => gm.group.name).join(", ");
              const programs = student.programEnrollments.map((pe) => pe.program.name).join(", ");

              const avgScore = lastAttempt
                ? Math.round(
                    (lastAttempt.answers.filter((a) => a.isCorrect).length /
                      Math.max(lastAttempt.answers.length, 1)) *
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
                  <td className="px-4 py-3 text-gray-500">{groups || "—"}</td>
                  <td className="px-4 py-3 text-gray-500">
                    {lastAttempt?.submittedAt ? (
                      <span className={inactive ? "text-amber-600" : ""}>
                        {formatDate(lastAttempt.submittedAt)}
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
                    <Link href={`/teacher/students/${student.id}`} className="text-xs text-blue-600 hover:underline">
                      View →
                    </Link>
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
      </div>
    </div>
  );
}
