import prisma from "@/lib/prisma";
import Link from "next/link";
import { redirect } from "next/navigation";
import { formatDate } from "@/lib/utils";
import { requireApprovedSession } from "@/lib/rbac";

export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  const session = await requireApprovedSession();
  if (!session) redirect("/auth/pending-validation");

  const notifications = await prisma.notification.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="mb-6 text-xl font-semibold text-gray-900">Notifications</h1>
      <div className="rounded-lg border border-gray-200 bg-white">
        {notifications.map((n) => (
          <Link
            key={n.id}
            href={n.href ?? "#"}
            className="block border-b border-gray-100 px-4 py-3 last:border-b-0 hover:bg-gray-50"
          >
            <div className="flex items-center justify-between gap-4">
              <p className="text-sm font-medium text-gray-900">{n.title}</p>
              <span className="text-xs text-gray-400">{formatDate(n.createdAt)}</span>
            </div>
            {n.body && <p className="mt-1 text-sm text-gray-500">{n.body}</p>}
          </Link>
        ))}
        {notifications.length === 0 && <div className="p-10 text-center text-sm text-gray-400">No notifications yet.</div>}
      </div>
    </div>
  );
}
