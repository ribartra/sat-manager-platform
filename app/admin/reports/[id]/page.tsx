import { notFound, redirect } from "next/navigation";
import { Breadcrumbs } from "@/components/sat/breadcrumbs";
import { PageShell } from "@/components/sat";
import { Card } from "@/components/ui/card";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { roleLabel } from "@/lib/domain-meta";
import { issueCategoryMeta, type IssueElement, type IssueTarget } from "@/lib/issue-report";
import { getCoderAgentConfig } from "@/lib/coder-agent-settings";
import { ReportActions } from "./report-actions";

const EVENT_LABELS: Record<string, string> = {
  CREATED: "Reported",
  EMAILED: "Emailed to the SAT team",
  EMAIL_FAILED: "Email not sent",
  SENT_TO_AGENT: "Sent to the coding agent",
  AGENT_ERROR: "Coding agent did not accept it",
  IN_PROGRESS: "Coding agent took it",
  RESOLVED: "Marked fixed",
  REOPENED: "Reopened",
  NOTE: "Note",
};
const SOURCE_LABELS: Record<string, string> = { ADMIN: "Admin", AGENT: "AI coding agent", SYSTEM: "System" };

/** Commit / PR link when it is a URL, plain text otherwise. */
function RefLink({ value }: { value: string }) {
  return /^https?:\/\//i.test(value) ? (
    <a href={value} target="_blank" rel="noreferrer" className="break-all text-blue-600 hover:underline">{value}</a>
  ) : (
    <code className="break-all text-xs">{value}</code>
  );
}

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
      resolvedBySource: true,
      resolutionNote: true,
      resolutionRef: true,
      agentTicketId: true,
      agentSentAt: true,
      agentError: true,
      createdAt: true,
      events: { orderBy: { createdAt: "asc" }, select: { id: true, source: true, type: true, message: true, ref: true, createdAt: true } },
      user: { select: { id: true, name: true, email: true, role: true } },
      resolvedBy: { select: { name: true } },
    },
  });
  if (!report) notFound();
  const agent = await getCoderAgentConfig();
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
              <span className="rounded bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">
                {report.resolvedBySource === "AGENT" ? "Fixed by the AI coding agent" : `Fixed by ${report.resolvedBy?.name ?? "an admin"}`}
              </span>
            ) : report.status === "IN_PROGRESS" ? (
              <span className="rounded bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">In progress (coding agent)</span>
            ) : (
              <span className="rounded bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">Open</span>
            )}
          </p>
          <h1 className="text-xl font-semibold text-gray-900">{report.pageTitle || "Report"}</h1>
          <p className="text-sm text-gray-500">
            {report.user.name} ({report.user.email}, {roleLabel(report.user.role)}) · {report.createdAt.toISOString().replace("T", " ").slice(0, 16)} UTC
          </p>
        </div>
        <ReportActions id={report.id} status={report.status} emailed={!!report.emailSentAt} agentEnabled={agent.enabled} sentToAgent={!!report.agentSentAt} />
      </div>

      <blockquote className="mb-4 whitespace-pre-wrap rounded-lg border-l-4 bg-white px-4 py-3 text-[15px] text-gray-900" style={{ borderColor: cat.color }}>
        {report.comment}
      </blockquote>

      {report.status === "RESOLVED" && (report.resolutionNote || report.resolutionRef) ? (
        <Card padding="md" className="mb-4 border-green-200 bg-green-50/40">
          <h2 className="mb-1 text-sm font-semibold text-gray-900">How it was fixed</h2>
          {report.resolutionNote ? <p className="whitespace-pre-wrap text-sm text-gray-800">{report.resolutionNote}</p> : null}
          {report.resolutionRef ? <p className="mt-1 text-sm"><RefLink value={report.resolutionRef} /></p> : null}
        </Card>
      ) : null}

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
              <Row label="About">{target.kind === "page" ? about : `${about} · ${target.context}`}</Row>
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
          <Card padding="md">
            <h2 className="mb-2 text-sm font-semibold text-gray-900">Timeline</h2>
            <ol className="grid gap-2 text-sm">
              {report.events.map((e) => (
                <li key={e.id} className="grid gap-0.5 border-l-2 border-gray-200 pl-3">
                  <span className="text-gray-800">
                    <b className="font-medium">{EVENT_LABELS[e.type] ?? e.type}</b>
                    <span className="text-xs text-gray-500"> · {SOURCE_LABELS[e.source] ?? e.source} · {e.createdAt.toISOString().replace("T", " ").slice(0, 16)} UTC</span>
                  </span>
                  {e.message ? <span className="whitespace-pre-wrap text-xs text-gray-600">{e.message}</span> : null}
                  {e.ref ? <span className="text-xs"><RefLink value={e.ref} /></span> : null}
                </li>
              ))}
              {report.events.length === 0 ? <li className="text-xs text-gray-500">No events recorded.</li> : null}
            </ol>
            <p className="mt-3 text-xs text-gray-500">
              Coding agent:{" "}
              {!agent.enabled
                ? "off (set the URL in Admin → Settings)"
                : report.agentSentAt
                  ? `sent ${report.agentSentAt.toISOString().replace("T", " ").slice(0, 16)} UTC${report.agentTicketId ? ` · ticket ${report.agentTicketId}` : ""}`
                  : report.agentError
                    ? `not accepted (${report.agentError})`
                    : "not sent"}
            </p>
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
