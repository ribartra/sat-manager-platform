import { redirect } from "next/navigation";
import { Breadcrumbs } from "@/components/sat/breadcrumbs";
import { PageShell, Pagination, pageFromParam, paginate } from "@/components/sat";
import { ChevronCell, LinkTr, RowLink, SimpleTable, TD } from "@/components/sat/link-table";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { roleLabel } from "@/lib/domain-meta";
import { formatDate } from "@/lib/utils";
import { issueCategoryMeta } from "@/lib/issue-report";

const PAGE_SIZE = 20;

const TABS = [
  { id: "open", label: "Open", where: { status: "OPEN" } },
  { id: "resolved", label: "Resolved", where: { status: "RESOLVED" } },
  { id: "all", label: "All", where: {} },
] as const;

/** Admin → Reports: what users sent with "Report a problem" (components/sat/issue-reporter.tsx). */
export default async function AdminReportsPage({ searchParams }: { searchParams: Promise<{ status?: string; page?: string }> }) {
  const session = await auth();
  if (!session) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/teacher");

  const { status, page } = await searchParams;
  const tab = TABS.find((t) => t.id === status) ?? TABS[0];
  const [reports, counts] = await Promise.all([
    prisma.issueReport.findMany({
      where: tab.where,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        category: true,
        comment: true,
        url: true,
        pageTitle: true,
        status: true,
        emailSentAt: true,
        createdAt: true,
        user: { select: { name: true, role: true } },
      },
    }),
    prisma.issueReport.groupBy({ by: ["status"], _count: { _all: true } }),
  ]);
  const count = (s: string) => counts.find((c) => c.status === s)?._count._all ?? 0;
  const tabCount = { open: count("OPEN"), resolved: count("RESOLVED"), all: count("OPEN") + count("RESOLVED") };
  const reportPage = paginate(reports, pageFromParam(page), PAGE_SIZE);

  return (
    <PageShell width="wide">
      <Breadcrumbs items={[{ label: "Home", href: "/teacher" }, { label: "Admin" }, { label: "Reports" }]} />
      <h1 className="mb-1 text-xl font-semibold text-gray-900">Reports</h1>
      <p className="mb-4 text-sm text-gray-500">
        Problems and suggestions users sent with “Report a problem”. Each one is also emailed to the SAT team.
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
                  <p className="text-xs text-gray-400">{roleLabel(r.user.role)}</p>
                </td>
                <td className={TD}>
                  <span className="rounded px-1.5 py-0.5 text-[11px] font-bold text-white" style={{ background: cat.color }}>{cat.label}</span>
                  {r.status === "RESOLVED" ? <span className="ml-1 rounded bg-gray-100 px-1.5 py-0.5 text-[11px] text-gray-500">Resolved</span> : null}
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
      <Pagination basePath="/admin/reports" params={{ status: tab.id === "open" ? undefined : tab.id }} pageSize={PAGE_SIZE} {...reportPage} />
    </PageShell>
  );
}
