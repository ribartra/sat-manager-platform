import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { redirect } from "next/navigation";
import { formatDate } from "@/lib/utils";

const ACTION_LABELS: Record<string, string> = {
  CREATE_PROGRAM: "Created program",
  UPDATE_PROGRAM: "Updated program",
  APPROVE_ENROLLMENT: "Approved enrollment",
  REJECT_ENROLLMENT: "Rejected enrollment",
  REMOVE_ENROLLMENT: "Removed student",
  REQUEST_ENROLLMENT: "Requested enrollment",
  ADD_PROGRAM_TEACHER: "Added teacher to program",
  REMOVE_PROGRAM_TEACHER: "Removed teacher from program",
  INVALIDATE_ATTEMPT: "Invalidated attempt",
  REOPEN_ATTEMPT: "Reopened attempt",
  COMMENT_ATTEMPT: "Commented attempt",
  CREATE_QUESTION: "Created question",
  UPDATE_QUESTION: "Updated question",
  PUBLISH_QUESTION: "Published question",
  ARCHIVE_QUESTION: "Archived question",
  CREATE_PRACTICE_SET: "Created Practice Set",
  UPDATE_PRACTICE_SET: "Updated Practice Set",
  PUBLISH_PRACTICE_SET: "Published Practice Set",
  ARCHIVE_PRACTICE_SET: "Archived Practice Set",
  IMPORT_QUESTIONS: "Imported questions",
  IMPERSONATE_STUDENT_VIEW: "Viewed as student",
  ASSIGN_PRACTICE_SET: "Assigned Practice Set",
  ASSIGN_FULL_PRACTICE_TEST: "Assigned Exam",
  APPROVE_UNLOCK_REQUEST: "Approved unlock request",
  DENY_UNLOCK_REQUEST: "Denied unlock request",
};

export default async function AdminLogsPage() {
  const session = await auth();
  if (!session) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/teacher");

  const logs = await prisma.auditLog.findMany({
    include: { user: { select: { name: true, email: true, role: true } } },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="mb-1 text-xl font-semibold text-gray-900">Audit Log</h1>
      <p className="mb-6 text-sm text-gray-500">Last 200 system events, newest first.</p>

      <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="px-4 py-3 text-left font-medium text-gray-500">When</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">Who</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">Action</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">Target</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {logs.map((log) => (
              <tr key={log.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{formatDate(log.createdAt)}</td>
                <td className="px-4 py-3">
                  <p className="font-medium text-gray-800">{log.user.name}</p>
                  <p className="text-xs text-gray-400">{log.user.role}</p>
                </td>
                <td className="px-4 py-3 text-gray-700">
                  {ACTION_LABELS[log.action] ?? log.action}
                </td>
                <td className="px-4 py-3 text-gray-500 text-xs">
                  {log.targetType && <span className="font-medium">{log.targetType}</span>}
                  {log.targetId && <span className="ml-1 text-gray-400 font-mono">{log.targetId.slice(0, 20)}</span>}
                  {log.metadata && (
                    <pre className="mt-0.5 text-gray-400 text-[10px] overflow-hidden max-w-xs truncate">
                      {log.metadata}
                    </pre>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {logs.length === 0 && (
          <p className="py-10 text-center text-sm text-gray-400">No events recorded yet.</p>
        )}
      </div>
    </div>
  );
}
