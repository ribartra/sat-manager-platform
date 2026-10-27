import { redirect } from "next/navigation";
import { Breadcrumbs } from "@/components/sat/breadcrumbs";
import { ListFilters, PageShell, Pagination, RoleBadge, pageFromParam, paginate } from "@/components/sat";
import { ChevronCell, LinkTr, RowLink, SimpleTable, TD } from "@/components/sat/link-table";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { roleLabel } from "@/lib/domain-meta";
import { formatDate } from "@/lib/utils";
import { issueCategoryMeta } from "@/lib/issue-report";

const PAGE_SIZE = 20;

const TABS = [
  { id: "open", label: "Open", where: { status: "OPEN" } },
  { id: "in_progress", label: "In progress", where: { status: "IN_PROGRESS" } },
  { id: "resolved", label: "Resolved", where: { status: "RESOLVED" } },
  { id: "all", label: "All", where: {} },
] as const;

const CATEGORY_OPTIONS = ["PROBLEM", "CONFUSING", "SUGGESTION", "PRAISE"].map((value) => ({ value, label: issueCategoryMeta(value).label }));

/** Admin → Reports: what users sent with "Report a problem" (components/sat/issue-reporter.tsx). */
export default async function AdminReportsPage({ searchParams }: { searchParams: Promise<{ status?: string; page?: string; q?: string; category?: string; from?: string }> }) {
  const session = await auth();
  if (!session) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/teacher");

  const { status, page, q: rawQ, category: rawCategory, from: rawFrom } = await searchParams;
  const tab = TABS.find((t) => t.id === status) ?? TABS[0];
  // Search + filters (URL): comment, reporter or page; type; who reported (account type).
  const q = (rawQ ?? "").trim();
  const category = CATEGORY_OPTIONS.some((c) => c.value === rawCategory) ? rawCategory : undefined;
  const fromRole = ["STUDENT", "TEACHER", "PARENT", "ADMIN"].includes(rawFrom ?? "") ? rawFrom : undefined;
  const [reports, counts] = await Promise.all([
    prisma.issueReport.findMany({
      where: {
        ...tab.where,
        ...(category ? { category } : {}),
        ...(fromRole ? { user: { role: fromRole } } : {}),
        ...(q ? { OR: [{ comment: { contains: q } }, { pageTitle: { contains: q } }, { url: { contains: q } }, { user: { name: { contains: q } } }] } : {}),
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        category: true,
        comment: true,
        url: true,
        pageTitle: true,
        status: true,
        resolvedBySource: true,
        emailSentAt: true,
        createdAt: true,
        user: { select: { name: true, role: true } },
      },
    }),
    prisma.issueReport.groupBy({ by: ["status"], _count: { _all: true } }),
  ]);
  const count = (s: string) => counts.find((c) => c.status === s)?._count._all ?? 0;
  const tabCount = {
    open: count("OPEN"),
    in_progress: count("IN_PROGRESS"),
    resolved: count("RESOLVED"),
    all: counts.reduce((n, c) => n + c._count._all, 0),
  };
  const reportPage = paginate(reports, pageFromParam(page), PAGE_SIZE);

  return (
    <PageShell width="wide">
      <Breadcrumbs items={[{ label: "Home", href: "/teacher" }, { label: "Admin" }, { label: "Reports" }]} />
      <h1 className="mb-1 text-xl font-semibold text-gray-900">Reports</h1>
      <p className="mb-4 text-sm text-gray-500">
        Problems and suggestions users sent with “Report a problem”. Each one is emailed to the SAT team and, when set up, sent to the coding agent. An admin or the agent marks it fixed.
      </p>

      <div className="mb-4 flex flex-wrap gap-2">
        {TABS.map((item) => (
          <a
            key={item.id}
            href={item.id === "open" ? "/admin/reports" : `/admin/reports?status=${item.id}`}
            className={`rounded-md px-3 py-1.5 text-xs font-medium ${tab.id === item.id ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
          >
            {item.label} · {tabCount[item.id]}
          </a>
        ))}
      </div>

      <ListFilters
        action="/admin/reports"
        q={q}
        placeholder="Comment, reporter or page"
        hidden={{ status: tab.id === "open" ? undefined : tab.id }}
        filters={[
          { name: "category", label: "Type", value: category, allLabel: "All types", options: CATEGORY_OPTIONS },
          { name: "from", label: "From", value: fromRole, allLabel: "Any account", options: ["STUDENT", "TEACHER", "PARENT", "ADMIN"].map((r) => ({ value: r, label: roleLabel(r) })) },
        ]}
      />

      {reportPage.items.length === 0 ? (
        <p className="rounded-lg border border-dashed border-gray-300 bg-white p-6 text-center text-sm text-gray-500">
          {tab.id === "open" ? "No open reports." : "No reports here yet."}
        </p>
      ) : (
        <SimpleTable head={["When", "From", "Type", "Comment", "Page", "Email", ""]}>
          {reportPage.items.map((r) => {
            const cat = issueCategoryMeta(r.category);
            return (
              <LinkTr key={r.id}>
                <td className={`${TD} whitespace-nowrap text-gray-500`}>{formatDate(r.createdAt)}</td>
                <td className={TD}>
                  <RowLink href={`/admin/reports/${r.id}`}>{r.user.name}</RowLink>
                  <span className="mt-0.5 block"><RoleBadge role={r.user.role} /></span>
                </td>
                <td className={TD}>
                  <span className="rounded px-1.5 py-0.5 text-[11px] font-bold text-white" style={{ background: cat.color }}>{cat.label}</span>
                  {r.status === "RESOLVED" ? (
                    <span className="ml-1 rounded bg-green-50 px-1.5 py-0.5 text-[11px] text-green-700">
                      {r.resolvedBySource === "AGENT" ? "Fixed by AI agent" : "Fixed by admin"}
                    </span>
                  ) : r.status === "IN_PROGRESS" ? (
                    <span className="ml-1 rounded bg-blue-50 px-1.5 py-0.5 text-[11px] text-blue-700">In progress</span>
                  ) : null}
                </td>
                <td className={`${TD} max-w-[22rem]`}><p className="line-clamp-2 text-gray-800">{r.comment}</p></td>
                <td className={`${TD} max-w-[14rem]`}>
                  <p className="truncate text-gray-700">{r.pageTitle || "—"}</p>
                  <p className="truncate font-mono text-[11px] text-gray-400">{new URL(r.url).pathname}</p>
                </td>
                <td className={`${TD} text-xs`}>{r.emailSentAt ? <span className="text-green-700">Sent</span> : <span className="text-red-600">Not sent</span>}</td>
                <ChevronCell />
              </LinkTr>
            );
          })}
        </SimpleTable>
      )}
      <Pagination basePath="/admin/reports" params={{ status: tab.id === "open" ? undefined : tab.id, q: q || undefined, category, from: fromRole }} pageSize={PAGE_SIZE} {...reportPage} />
    </PageShell>
  );
}
