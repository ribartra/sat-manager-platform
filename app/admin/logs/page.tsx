import { Breadcrumbs } from "@/components/sat/breadcrumbs";
import { ListFilters, PageShell, Pagination, RoleBadge, pageFromParam, pageSizeFromParam } from "@/components/sat";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { redirect } from "next/navigation";
import { formatDate } from "@/lib/utils";
import { roleLabel } from "@/lib/domain-meta";
import { Card } from "@/components/ui/card";
import {
  AUDIT_ACTION_LABELS,
  actionCategory,
  formatAuditPayload,
  humanizeAction,
  outcomeFromMetadata,
  type AuditCategory,
} from "@/lib/audit-catalog";
import { AuditPayload } from "@/components/admin/audit-payload";

interface PageProps {
  searchParams: Promise<{ cat?: string; page?: string; per?: string; user?: string; action?: string; outcome?: string; role?: string }>;
}

const TABS: { id: string; label: string; match?: AuditCategory }[] = [
  { id: "all", label: "All" },
  { id: "auth", label: "Sign-in", match: "Auth" },
  { id: "users", label: "Users", match: "Users" },
  { id: "attempts", label: "Student work", match: "Attempts" },
  { id: "content", label: "Content", match: "Content" },
  { id: "import", label: "Import", match: "Import" },
  { id: "programs", label: "Programs", match: "Programs" },
  { id: "errors", label: "Errors", match: "Errors" },
  { id: "other", label: "Other", match: "Other" },
];

function outcomeBadge(outcome: "success" | "failure" | "info" | null) {
  if (!outcome) return null;
  const styles =
    outcome === "success"
      ? "bg-emerald-50 text-emerald-700"
      : outcome === "failure"
        ? "bg-rose-50 text-rose-700"
        : "bg-sky-50 text-sky-700";
  return (
    <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium uppercase ${styles}`}>
      {outcome}
    </span>
  );
}

export default async function AdminLogsPage({ searchParams }: PageProps) {
  const session = await auth();
  if (!session) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/teacher");

  const { cat, page, per, user: rawUser, action: rawAction, outcome: rawOutcome, role: rawRole } = await searchParams;
  const outcomeFilter = rawOutcome === "success" || rawOutcome === "failure" || rawOutcome === "info" ? rawOutcome : undefined;
  const roleFilter = ["STUDENT", "TEACHER", "PARENT", "ADMIN"].includes(rawRole ?? "") ? rawRole : undefined;
  const category = cat?.toLowerCase() ?? "all";
  const tab = TABS.find((t) => t.id === category) ?? TABS[0];
  const pageSize = pageSizeFromParam(per, 50);

  // Every logged action and actor, for the tabs and the Action / User drop-downs (they search inside).
  const [actionRows, actorRows] = await Promise.all([
    prisma.auditLog.groupBy({ by: ["action"] }),
    prisma.auditLog.groupBy({ by: ["userId"], where: { userId: { not: null } } }),
  ]);
  const actions = actionRows.map((row) => row.action);
  const tabActions = tab.id === "all" ? null : actions.filter((action) => actionCategory(action) === tab.match);
  const actionFilter = rawAction && actions.includes(rawAction) && (!tabActions || tabActions.includes(rawAction)) ? rawAction : undefined;
  const actors = await prisma.user.findMany({
    where: { id: { in: actorRows.map((row) => row.userId!).filter(Boolean) } },
    select: { id: true, name: true, email: true },
    orderBy: { name: "asc" },
  });
  const userFilter = actors.some((actor) => actor.id === rawUser) ? rawUser : undefined;

  // Filtered and paged in the database: every action is reachable (no "latest 500" cut).
  const where = {
    ...(actionFilter ? { action: actionFilter } : tabActions ? { action: { in: tabActions } } : {}),
    ...(userFilter ? { userId: userFilter } : {}),
    ...(roleFilter ? { user: { role: roleFilter } } : {}),
    // writeAudit stores metadata as compact JSON ({"outcome":"success",…}).
    ...(outcomeFilter ? { metadata: { contains: `"outcome":"${outcomeFilter}"` } } : {}),
  };
  const total = await prisma.auditLog.count({ where });
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const current = Math.min(pageFromParam(page), pageCount);
  const logs = await prisma.auditLog.findMany({
    where,
    include: { user: { select: { name: true, email: true, role: true } } },
    orderBy: { createdAt: "desc" },
    skip: (current - 1) * pageSize,
    take: pageSize,
  });
  const logPage = { items: logs, page: current, pageCount, total };
  const params = { cat: tab.id === "all" ? undefined : tab.id, user: userFilter, action: actionFilter, outcome: outcomeFilter, role: roleFilter, per: String(pageSize) };

  return (
    <PageShell width="wide">
      <Breadcrumbs items={[{ label: "Home", href: "/teacher" }, { label: "Admin" }, { label: "Audit Log" }]} />
      <h1 className="mb-1 text-xl font-semibold text-gray-900">Activity log</h1>
      <p className="mb-4 text-sm text-gray-500">Every action by users, newest first.</p>

      <ListFilters
        action="/admin/logs"
        search={false}
        hidden={{ cat: tab.id === "all" ? undefined : tab.id, per: String(pageSize) }}
        filters={[
          { name: "user", label: "User", value: userFilter, allLabel: "Anyone", options: actors.map((actor) => ({ value: actor.id, label: `${actor.name} · ${actor.email}` })) },
          {
            name: "action",
            label: "Action",
            value: actionFilter,
            allLabel: "Any action",
            options: (tabActions ?? actions)
              .map((action) => ({ value: action, label: AUDIT_ACTION_LABELS[action] ?? humanizeAction(action) }))
              .sort((a, b) => a.label.localeCompare(b.label)),
          },
          { name: "outcome", label: "Outcome", value: outcomeFilter, allLabel: "Any outcome", options: [{ value: "success", label: "Success" }, { value: "failure", label: "Failure" }, { value: "info", label: "Info" }] },
          { name: "role", label: "Account type", value: roleFilter, allLabel: "Any account", options: ["STUDENT", "TEACHER", "PARENT", "ADMIN"].map((r) => ({ value: r, label: roleLabel(r) })) },
        ]}
      />
      <div className="mb-4 flex flex-wrap gap-2">
        {TABS.map((item) => {
          const active = tab.id === item.id;
          // Changing tab keeps the other filters (the action belongs to a tab, so it resets).
          const keep = new URLSearchParams(Object.entries({ ...params, cat: item.id === "all" ? undefined : item.id, action: undefined }).filter((e): e is [string, string] => Boolean(e[1])));
          const href = `/admin/logs${keep.toString() ? `?${keep.toString()}` : ""}`;
          return (
            <a
              key={item.id}
              href={href}
              className={`rounded-md px-3 py-1.5 text-xs font-medium ${
                active ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {item.label}
            </a>
          );
        })}
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="px-4 py-3 text-left font-medium text-gray-500">When</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Who</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Event</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {logPage.items.map((log) => {
                const eventCategory = actionCategory(log.action);
                const categoryLabel = TABS.find((t) => t.match === eventCategory)?.label ?? eventCategory;
                const label = humanizeAction(log.action);
                const outcome = outcomeFromMetadata(log.metadata);
                const payload = formatAuditPayload(log.metadata);
                const uncatalogued = !(log.action in AUDIT_ACTION_LABELS);

                return (
                  <tr key={log.id} className="align-top hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                      <p>{formatDate(log.createdAt)}</p>
                      <p className="mt-0.5 font-mono text-[10px] text-gray-400">
                        {log.createdAt.toISOString().replace("T", " ").slice(0, 19)} UTC
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      {log.user ? (
                        <>
                          <p className="font-medium text-gray-800">{log.user.name}</p>
                          <span className="mt-0.5 block"><RoleBadge role={log.user.role} /></span>
                          <p className="text-[10px] text-gray-400">{log.user.email}</p>
                        </>
                      ) : (
                        <>
                          <p className="font-medium text-gray-800">System</p>
                          <p className="text-xs text-gray-400">—</p>
                        </>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-800">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] uppercase text-gray-500">
                          {categoryLabel}
                        </span>
                        {outcomeBadge(outcome)}
                        {uncatalogued && (
                          <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
                            new
                          </span>
                        )}
                      </div>
                      <p className="mt-1 font-medium text-gray-900" title={log.action}>{label}</p>
                    </td>
                    <td className="px-4 py-3">
                      <AuditPayload payload={payload} targetType={log.targetType} targetId={log.targetId} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {total === 0 && (
          <p className="py-10 text-center text-sm text-gray-400">No events recorded yet.</p>
        )}
      </Card>
      <Pagination basePath="/admin/logs" params={params} pageSize={pageSize} pageSizeParam="per" {...logPage} />
    </PageShell>
  );
}
