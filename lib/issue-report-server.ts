import { after } from "next/server";
import prisma from "@/lib/prisma";
import { absoluteAppUrl, sendIssueReportEmail, sendIssueReportResolvedEmail } from "@/lib/email";
import { getCoderAgentConfig } from "@/lib/coder-agent-settings";
import { notify } from "@/lib/notify";
import { issueCategoryMeta, type IssueTarget } from "@/lib/issue-report";

export type IssueEventSource = "ADMIN" | "AGENT" | "SYSTEM";

export async function addIssueEvent(reportId: string, source: IssueEventSource, type: string, data: { message?: string | null; ref?: string | null; userId?: string | null } = {}) {
  await prisma.issueReportEvent.create({
    data: { reportId, source, type, message: data.message?.slice(0, 4000) ?? null, ref: data.ref?.slice(0, 1000) ?? null, userId: data.userId ?? null },
  });
}

function parseTarget(raw: string): IssueTarget {
  try {
    return JSON.parse(raw) as IssueTarget;
  } catch {
    return { kind: "page", context: "" };
  }
}

async function loadReport(id: string) {
  return prisma.issueReport.findUnique({
    where: { id },
    include: { user: { select: { id: true, name: true, email: true, role: true } } },
  });
}
type LoadedReport = NonNullable<Awaited<ReturnType<typeof loadReport>>>;

/** The report as JSON for the coding agent (outbound POST and GET /api/agent/issue-reports/[id]). */
export function issueReportPayload(report: LoadedReport, withScreenshot = true) {
  return {
    report: {
      id: report.id,
      category: report.category,
      comment: report.comment,
      status: report.status,
      url: report.url,
      pageTitle: report.pageTitle,
      viewport: report.viewport,
      userAgent: report.userAgent,
      createdAt: report.createdAt.toISOString(),
      user: report.user,
      target: parseTarget(report.target),
      resolution: report.resolvedAt
        ? { by: report.resolvedBySource, at: report.resolvedAt.toISOString(), note: report.resolutionNote, ref: report.resolutionRef }
        : null,
      agentTicketId: report.agentTicketId,
    },
    screenshot:
      withScreenshot && report.screenshot
        ? { contentType: report.screenshotType ?? "image/jpeg", base64: Buffer.from(report.screenshot).toString("base64") }
        : null,
    links: { admin: absoluteAppUrl(`/admin/reports/${report.id}`) },
    callback: { url: absoluteAppUrl(`/api/agent/issue-reports/${report.id}`), auth: "Bearer <callback token from Admin → Settings → Coding agent>" },
  };
}

export async function getIssueReportForAgent(id: string) {
  const report = await loadReport(id);
  return report ? issueReportPayload(report) : null;
}

/** Emails a stored report (lib/email sendIssueReportEmail) and records the outcome on the row. */
export async function emailIssueReport(id: string) {
  const report = await loadReport(id);
  if (!report) return { sent: false as const, reason: "NOT_FOUND" };
  const result = await sendIssueReportEmail({
    id: report.id,
    category: report.category,
    comment: report.comment,
    url: report.url,
    pageTitle: report.pageTitle,
    viewport: report.viewport,
    userAgent: report.userAgent,
    createdAt: report.createdAt,
    target: parseTarget(report.target),
    user: report.user,
    screenshot: report.screenshot ? { content: Buffer.from(report.screenshot), contentType: report.screenshotType ?? "image/jpeg" } : null,
  });
  await prisma.issueReport.update({
    where: { id },
    data: result.sent ? { emailSentAt: new Date(), emailError: null } : { emailError: result.reason },
  });
  await addIssueEvent(id, "SYSTEM", result.sent ? "EMAILED" : "EMAIL_FAILED", { message: result.sent ? null : result.reason });
  return result;
}

/**
 * POSTs the report to the coding agent (Admin → Settings → Coding agent). Off while the URL is empty.
 * The agent may answer { ticketId }; it later calls /api/agent/issue-reports/[id]. Contract: docs/coder-agent-api.md.
 */
export async function sendIssueReportToAgent(id: string): Promise<{ sent: boolean; reason?: string }> {
  const config = await getCoderAgentConfig();
  if (!config.url) return { sent: false, reason: "DISABLED" };
  const report = await loadReport(id);
  if (!report) return { sent: false, reason: "NOT_FOUND" };
  let error: string | null = null;
  let ticketId: string | null = null;
  try {
    const res = await fetch(config.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Event": "issue_report.created",
        ...(config.token ? { Authorization: `Bearer ${config.token}` } : {}),
      },
      body: JSON.stringify({ event: "issue_report.created", sentAt: new Date().toISOString(), ...issueReportPayload(report) }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) error = `HTTP ${res.status}`;
    else {
      const data = (await res.json().catch(() => null)) as { ticketId?: unknown } | null;
      if (data && (typeof data.ticketId === "string" || typeof data.ticketId === "number")) ticketId = String(data.ticketId).slice(0, 200);
    }
  } catch (e) {
    error = e instanceof Error ? (e.name === "TimeoutError" ? "Timed out after 15 s" : e.message) : "Request failed";
  }
  await prisma.issueReport.update({
    where: { id },
    data: error ? { agentError: error.slice(0, 500) } : { agentSentAt: new Date(), agentError: null, ...(ticketId ? { agentTicketId: ticketId } : {}) },
  });
  await addIssueEvent(id, "SYSTEM", error ? "AGENT_ERROR" : "SENT_TO_AGENT", { message: error ?? (ticketId ? `Agent ticket ${ticketId}` : null) });
  return error ? { sent: false, reason: error } : { sent: true };
}

function pathOf(url: string) {
  try {
    const u = new URL(url);
    return u.pathname + u.search;
  } catch {
    return "/";
  }
}

/** Fixed ("levantado") by an admin or by the coding agent: records who, the note and link, and tells the reporter. */
export async function resolveIssueReport(input: { id: string; source: "ADMIN" | "AGENT"; userId?: string | null; note?: string | null; ref?: string | null }) {
  const report = await loadReport(input.id);
  if (!report) return null;
  const note = input.note?.trim().slice(0, 4000) || null;
  const ref = input.ref?.trim().slice(0, 1000) || null;
  await prisma.issueReport.update({
    where: { id: input.id },
    data: {
      status: "RESOLVED",
      resolvedAt: new Date(),
      resolvedBySource: input.source,
      resolvedById: input.source === "ADMIN" ? input.userId ?? null : null,
      resolutionNote: note,
      resolutionRef: ref,
    },
  });
  await addIssueEvent(input.id, input.source, "RESOLVED", { message: note, ref, userId: input.userId });
  const where = report.pageTitle && report.pageTitle !== "SAT Practice Platform" ? report.pageTitle : pathOf(report.url).split("?")[0];
  await notify(report.userId, {
    title: "Your report was fixed",
    body: `${issueCategoryMeta(report.category).label} on ${where}: ${(note ?? report.comment).slice(0, 160)}`,
    href: pathOf(report.url),
  });
  // After the response: the agent's callback doesn't wait on SMTP (the email outcome is not part of it).
  if (input.source === "AGENT") after(() => sendIssueReportResolvedEmail({ id: report.id, comment: report.comment, url: report.url, note, ref }).then(() => undefined));
  return true;
}

export async function reopenIssueReport(id: string, source: IssueEventSource, userId?: string | null, message?: string | null) {
  await prisma.issueReport.update({
    where: { id },
    data: { status: "OPEN", resolvedAt: null, resolvedById: null, resolvedBySource: null, resolutionNote: null, resolutionRef: null },
  });
  await addIssueEvent(id, source, "REOPENED", { message, userId });
}
