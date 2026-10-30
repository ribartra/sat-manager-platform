import { Breadcrumbs } from "@/components/sat/breadcrumbs";
import { ListFilters, PAGE_SIZE, PageShell, Pagination, pageFromParam } from "@/components/sat";
import { periodDates, periodParams, resolvePeriod } from "@/lib/period-filter";
import prisma from "@/lib/prisma";
import Link from "next/link";
import { redirect } from "next/navigation";
import { formatDate } from "@/lib/utils";
import { requireApprovedSession } from "@/lib/rbac";
import { Card } from "@/components/ui/card";
import { homeHrefForRole } from "@/lib/nav-config";

export const dynamic = "force-dynamic";

/**
 * Every notification of the user, newest first (the bell shows the latest 10 and links here): paged
 * in the database, 25 per page, with the period filter of History.
 */
export default async function NotificationsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const session = await requireApprovedSession();
  if (!session) redirect("/auth/pending-validation");
  const query = await searchParams;
  const pageSize = PAGE_SIZE;

  const period = resolvePeriod(query);
  const { from, to } = periodDates(period);
  const where = { userId: session.user.id, ...(from || to ? { createdAt: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {}) };
  const total = await prisma.notification.count({ where });
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(pageFromParam(query.page), pageCount);
  const notifications = await prisma.notification.findMany({
    where,
    orderBy: { createdAt: "desc" },
    skip: (page - 1) * pageSize,
    take: pageSize,
  });

  return (
    <PageShell width="narrow">
      <Breadcrumbs items={[{ label: "Home", href: homeHrefForRole(session.user.role) }, { label: "Notifications" }]} />
      <h1 className="mb-4 text-[26px] font-bold tracking-[-0.3px] text-gray-900">Notifications</h1>
      <ListFilters
        action="/notifications" search={false} period={period} />
      <Card>
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
        {notifications.length === 0 && <div className="p-10 text-center text-sm text-gray-400">{period.period === "all" ? "No notifications yet." : "No notifications in this period."}</div>}
      </Card>
      <Pagination basePath="/notifications" params={periodParams(period)} page={page} pageCount={pageCount} total={total} pageSize={pageSize} />
    </PageShell>
  );
}
