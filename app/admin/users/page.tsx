import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import prisma from "@/lib/prisma";
import { requireAdmin } from "@/lib/rbac";
import { UserValidationActions } from "./user-validation-actions-client";

export const dynamic = "force-dynamic";

function validationBadge(status: string) {
  if (status === "APPROVED") return <Badge variant="success">Approved</Badge>;
  if (status === "REJECTED") return <Badge variant="danger">Rejected</Badge>;
  return <Badge variant="warning">Pending</Badge>;
}

export default async function AdminUsersPage() {
  const session = await requireAdmin();
  if (!session) redirect("/teacher");

  const users = await prisma.user.findMany({
    orderBy: [{ createdAt: "desc" }],
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      active: true,
      validationStatus: true,
      validationReviewedAt: true,
      createdAt: true,
    },
  });

  const sortedUsers = users.sort((a, b) => {
    if (a.validationStatus === "PENDING" && b.validationStatus !== "PENDING") return -1;
    if (a.validationStatus !== "PENDING" && b.validationStatus === "PENDING") return 1;
    return b.createdAt.getTime() - a.createdAt.getTime();
  });

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="mb-2 text-xl font-semibold text-gray-900">Account Validation</h1>
      <p className="mb-6 text-sm text-gray-500">
        Review manually created or otherwise unverified accounts. Accounts created through emailed invite links are approved automatically when the link is consumed.
      </p>
      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="px-4 py-3 text-left font-medium text-gray-500">User</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">Role</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">Access</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">Validation</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">Reviewed</th>
              <th className="px-4 py-3 text-right font-medium text-gray-500">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {sortedUsers.map((user) => (
              <tr key={user.id}>
                <td className="px-4 py-3">
                  <p className="font-medium text-gray-900">{user.name}</p>
                  <p className="text-xs text-gray-500">{user.email}</p>
                </td>
                <td className="px-4 py-3 text-gray-600">{user.role}</td>
                <td className="px-4 py-3">
                  <Badge variant={user.active ? "success" : "danger"}>{user.active ? "Active" : "Inactive"}</Badge>
                </td>
                <td className="px-4 py-3">{validationBadge(user.validationStatus)}</td>
                <td className="px-4 py-3 text-gray-600">
                  {user.validationReviewedAt ? user.validationReviewedAt.toLocaleString("en-US") : "-"}
                </td>
                <td className="px-4 py-3 text-right">
                  <UserValidationActions userId={user.id} currentStatus={user.validationStatus} isSelf={user.id === session.user.id} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
