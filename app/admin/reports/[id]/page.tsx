import { notFound, redirect } from "next/navigation";
import { Breadcrumbs } from "@/components/sat/breadcrumbs";
import { PageShell } from "@/components/sat";
import { Card } from "@/components/ui/card";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { roleLabel } from "@/lib/domain-meta";
import { issueCategoryMeta, type IssueElement, type IssueTarget } from "@/lib/issue-report";
import { ReportActions } from "./report-actions";

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1 border-b border-gray-100 py-2 text-sm sm:grid-cols-[9rem_1fr]">
      <dt className="font-medium text-gray-500">{label}</dt>
      <dd className="min-w-0 break-words text-gray-800">{children}</dd>
    </div>
  );
}

function ElementDetails({ el }: { el: IssueElement }) {
  return (
    <dl>
      <Row label="Selector"><code className="text-xs">{el.selector}</code></Row>
      <Row label="Tag"><code className="text-xs">{el.tag}{el.id ? `#${el.id}` : ""}</code></Row>
      {el.classes?.length ? <Row label="Classes"><code className="text-xs">{el.classes.join(" ")}</code></Row> : null}
      {Object.entries(el.attributes ?? {}).map(([k, v]) => (
        <Row key={k} label={k}><code className="text-xs">{v}</code></Row>
      ))}
      {el.text ? <Row label="Text">{el.text}</Row> : null}
      {el.ancestors?.length ? <Row label="Ancestors"><code className="text-xs">{el.ancestors.join(" › ")}</code></Row> : null}
      {el.rect ? <Row label="Box">{el.rect.width}×{el.rect.height} at ({el.rect.x}, {el.rect.y})</Row> : null}
      {el.html ? (
        <Row label="HTML">
          <pre className="max-h-72 overflow-auto whitespace-pre-wrap break-all rounded-md bg-gray-50 p-2 text-[11px]">{el.html}</pre>
        </Row>
      ) : null}
    </dl>
  );
}

export default async function AdminReportPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/teacher");

  const { id } = await params;
  const report = await prisma.issueReport.findUnique({
    where: { id },
    select: {
      id: true,
      category: true,
      comment: true,
      url: true,
      pageTitle: true,
      viewport: true,
      userAgent: true,
      target: true,
      screenshotType: true,
      status: true,
      emailSentAt: true,
      emailError: true,
      resolvedAt: true,
      createdAt: true,
      user: { select: { id: true, name: true, email: true, role: true } },
      resolvedBy: { select: { name: true } },
    },
  });
  if (!report) notFound();
  let target: IssueTarget = { kind: "page", context: "" };
  try {
    target = JSON.parse(report.target) as IssueTarget;
  } catch {}
  const cat = issueCategoryMeta(report.category);
  const about = target.kind === "page" ? "The whole screen" : target.kind === "area" ? "A dragged area" : "One element";

  return (
    <PageShell width="wide">
      <Breadcrumbs items={[{ label: "Home", href: "/teacher" }, { label: "Admin" }, { label: "Reports", href: "/admin/reports" }, { label: report.pageTitle || "Report" }]} />
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="mb-1 flex items-center gap-2">
            <span className="rounded px-2 py-0.5 text-xs font-bold text-white" style={{ background: cat.color }}>{cat.label}</span>
            {report.status === "RESOLVED" ? (
              <span className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                Resolved{report.resolvedBy ? ` by ${report.resolvedBy.name}` : ""}
              </span>
            ) : (
              <span className="rounded bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">Open</span>
            )}
          </p>
          <h1 className="text-xl font-semibold text-gray-900">{report.pageTitle || "Report"}</h1>
          <p className="text-sm text-gray-500">
            {report.user.name} ({report.user.email}, {roleLabel(report.user.role)}) · {report.createdAt.toISOString().replace("T", " ").slice(0, 16)} UTC
          </p>
        </div>
        <ReportActions id={report.id} status={report.status} emailed={!!report.emailSentAt} />
      </div>

      <blockquote className="mb-4 whitespace-pre-wrap rounded-lg border-l-4 bg-white px-4 py-3 text-[15px] text-gray-900" style={{ borderColor: cat.color }}>
        {report.comment}
      </blockquote>

      <div className="grid items-start gap-4 lg:grid-cols-[3fr_2fr]">
        <Card padding="md">
          <h2 className="mb-2 text-sm font-semibold text-gray-900">Screenshot</h2>
          {report.screenshotType ? (
            <a href={`/api/admin/issue-reports/${report.id}/screenshot`} target="_blank" rel="noreferrer">
              {/* eslint-disable-next-line @next/next/no-img-element -- admin-only binary from the DB */}
              <img src={`/api/admin/issue-reports/${report.id}/screenshot`} alt="What the user saw (selection outlined)" className="w-full rounded-md border border-gray-200" />
            </a>
          ) : (
            <p className="text-sm text-gray-500">The browser could not take a screenshot.</p>
          )}
        </Card>
        <div className="grid gap-4">
          <Card padding="md">
            <h2 className="mb-1 text-sm font-semibold text-gray-900">Page</h2>
            <dl>
              <Row label="Address"><a href={report.url} className="text-blue-600 hover:underline" target="_blank" rel="noreferrer">{report.url}</a></Row>
              <Row label="About">{about} · {target.context}</Row>
              {target.columns?.length ? <Row label="Table columns">{target.columns.join(", ")}</Row> : null}
              <Row label="Viewport">
                {report.viewport ?? "—"}
                {target.devicePixelRatio ? ` @${target.devicePixelRatio}x` : ""}
                {target.scroll ? ` · scrolled ${target.scroll.x},${target.scroll.y}` : ""}
              </Row>
              <Row label="Browser"><span className="text-xs">{report.userAgent ?? "—"}</span></Row>
              <Row label="Email">
                {report.emailSentAt ? `Sent ${report.emailSentAt.toISOString().replace("T", " ").slice(0, 16)} UTC` : `Not sent${report.emailError ? ` (${report.emailError})` : ""}`}
              </Row>
            </dl>
          </Card>
          {target.errors?.length ? (
            <Card padding="md">
              <h2 className="mb-2 text-sm font-semibold text-gray-900">JS errors on the page</h2>
              <pre className="whitespace-pre-wrap break-all rounded-md bg-red-50 p-2 text-[11px] text-red-800">{target.errors.join("\n")}</pre>
            </Card>
          ) : null}
        </div>
      </div>

      {target.element ? (
        <Card padding="md" className="mt-4">
          <h2 className="mb-1 text-sm font-semibold text-gray-900">{target.kind === "area" ? "Element containing the area" : "Selected element"}</h2>
          <ElementDetails el={target.element} />
        </Card>
      ) : null}
      {target.inside?.length ? (
        <Card padding="md" className="mt-4">
          <h2 className="mb-2 text-sm font-semibold text-gray-900">Inside the area ({target.inside.length})</h2>
          <ul className="divide-y divide-gray-100 text-sm">
            {target.inside.map((el, i) => (
              <li key={i} className="grid gap-0.5 py-1.5">
                <span className="text-gray-800">{el.text || <i className="text-gray-400">(no text)</i>}</span>
                <code className="break-all text-[11px] text-gray-500">{el.selector}{el.classes?.length ? ` · ${el.classes.join(" ")}` : ""}</code>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </PageShell>
  );
}
