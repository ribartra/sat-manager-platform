import nodemailer from "nodemailer";
import { getSmtpConfig } from "@/lib/smtp-settings";
import { captureCaughtError, writeAudit } from "@/lib/audit";
import { PARENT_ACCESS_WINDOW_DAYS, PARENT_ACTIVATION_DEADLINE_DAYS } from "@/lib/parent-access";
import { ISSUE_REPORT_DEFAULT_EMAIL, issueCategoryMeta, type IssueElement, type IssueTarget } from "@/lib/issue-report";

export type EmailAttachment = { filename: string; content: Buffer; contentType?: string; cid?: string };

type EmailPayload = {
  to: string;
  subject: string;
  text: string;
  html?: string;
  attachments?: EmailAttachment[];
};

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function absoluteAppUrl(path: string) {
  const configured = process.env.AUTH_URL?.trim();
  if (!configured) {
    if (process.env.NODE_ENV === "production" && process.env.NEXT_PHASE !== "phase-production-build") {
      // Never silently emit localhost links in production emails.
      void writeAudit({
        action: "EMAIL_URL_MISCONFIGURED",
        targetType: "AppSetting",
        targetId: "AUTH_URL",
        outcome: "failure",
        metadata: { path },
      });
      throw new Error("AUTH_URL is required in production to build absolute email links.");
    }
    return new URL(path, "http://localhost:3000").toString();
  }
  return new URL(path, configured).toString();
}

export async function sendTransactionalEmail(payload: EmailPayload) {
  const config = await getSmtpConfig();
  if (!config.configured) {
    console.log(`[EMAIL:SKIPPED] SMTP not configured. ${payload.to}: ${payload.subject}\n${payload.text}`);
    return { sent: false, reason: "SMTP_NOT_CONFIGURED" as const };
  }

  const transporter = nodemailer.createTransport({
    host: config.host!,
    port: config.port,
    secure: config.port === 465,
    auth: {
      user: config.user!,
      pass: config.pass!,
    },
  });

  try {
    await transporter.sendMail({
      from: config.from!,
      to: payload.to,
      subject: payload.subject,
      text: payload.text,
      html: payload.html,
      attachments: payload.attachments,
    });

    return { sent: true as const };
  } catch (error) {
    await captureCaughtError("email.send", error, {
      metadata: { to: payload.to, subject: payload.subject },
    });
    return { sent: false, reason: "SEND_FAILED" as const };
  }
}

export async function sendStudentInviteEmail(to: string, studentName: string, inviteUrl: string) {
  const safeName = escapeHtml(studentName);
  const safeUrl = escapeHtml(inviteUrl);

  return sendTransactionalEmail({
    to,
    subject: "Activate your SAT Practice account",
    text: [
      `Hello ${studentName},`,
      "",
      "Your SAT Practice account is ready. Use this link to activate it:",
      inviteUrl,
      "",
      "This link expires in 7 days.",
    ].join("\n"),
    html: `
      <p>Hello ${safeName},</p>
      <p>Your SAT Practice account is ready. Use this link to activate it:</p>
      <p><a href="${safeUrl}">${safeUrl}</a></p>
      <p>This link expires in 7 days.</p>
    `,
  });
}

/** "Hello Ana," or just "Hello," when we do not know the parent's name. */
function greeting(name: string | null) {
  return name ? `Hello ${name},` : "Hello,";
}

const REPORT_COLOR_KEY = "Green = strong (80%+), yellow = getting there (60–79%), red = needs work. Reply to this email with any questions.";

export async function sendParentConsentEmail(
  to: string,
  parentName: string | null,
  studentName: string,
  consentUrl: string,
  options: { existingStudent?: boolean } = {},
) {
  const safeGreeting = escapeHtml(greeting(parentName));
  const safeUrl = escapeHtml(consentUrl);
  const intro = options.existingStudent
    ? `${studentName} is practicing for the SAT with their teacher on SAT Practice. The teacher asks for your permission. Click below to authorize:`
    : `${studentName} has been invited to SAT Practice. Click below to give permission:`;

  return sendTransactionalEmail({
    to,
    subject: `Please authorize ${studentName}'s SAT Practice account`,
    text: [greeting(parentName), "", intro, consentUrl, "", "This link expires in 7 days."].join("\n"),
    html: `
      <p>${safeGreeting}</p>
      <p>${escapeHtml(intro)}</p>
      <p><a href="${safeUrl}">${safeUrl}</a></p>
      <p>This link expires in 7 days.</p>
    `,
  });
}

export async function sendParentInviteEmail(to: string, parentName: string | null, studentName: string, inviteUrl: string) {
  const safeGreeting = escapeHtml(greeting(parentName));
  const safeStudent = escapeHtml(studentName);
  const safeUrl = escapeHtml(inviteUrl);

  return sendTransactionalEmail({
    to,
    subject: "Create your SAT Practice parent account",
    text: [
      greeting(parentName),
      "",
      `${studentName} has been invited to SAT Practice. Create your parent account to follow their progress and approve their account:`,
      inviteUrl,
      "",
      "This link expires in 7 days.",
    ].join("\n"),
    html: `
      <p>${safeGreeting}</p>
      <p>${safeStudent} has been invited to SAT Practice. Create your parent account to follow their progress and approve their account:</p>
      <p><a href="${safeUrl}">${safeUrl}</a></p>
      <p>This link expires in 7 days.</p>
    `,
  });
}

export async function sendParentReportEmail(
  to: string,
  parentName: string | null,
  studentName: string,
  reportUrl: string,
  sectionsLabel: string
) {
  const safeGreeting = escapeHtml(greeting(parentName));
  const safeStudent = escapeHtml(studentName);
  const safeUrl = escapeHtml(reportUrl);
  const safeSections = escapeHtml(sectionsLabel);
  const linkNote = `Please open the link within ${PARENT_ACTIVATION_DEADLINE_DAYS} days. After you open it, you can view the report for ${PARENT_ACCESS_WINDOW_DAYS} days.`;

  return sendTransactionalEmail({
    to,
    subject: `${studentName}'s SAT progress report`,
    text: [
      greeting(parentName),
      "",
      `${studentName}'s teacher shared an SAT Practice progress report (${sectionsLabel}).`,
      "Open this link to view it:",
      reportUrl,
      "",
      linkNote,
      "",
      REPORT_COLOR_KEY,
    ].join("\n"),
    html: `
      <p>${safeGreeting}</p>
      <p><strong>${safeStudent}</strong>'s teacher shared an SAT Practice progress report (${safeSections}).</p>
      <p>Open this link to view it:</p>
      <p><a href="${safeUrl}">${safeUrl}</a></p>
      <p>${escapeHtml(linkNote)}</p>
      <p>${escapeHtml(REPORT_COLOR_KEY)}</p>
    `,
  });
}

/** Progress report sent as a PDF attachment (no link to open). */
export async function sendParentReportPdfEmail(
  to: string,
  parentName: string | null,
  studentName: string,
  reportLabel: string,
  attachment: EmailAttachment,
) {
  const safeGreeting = escapeHtml(greeting(parentName));
  const safeStudent = escapeHtml(studentName);
  const safeLabel = escapeHtml(reportLabel);

  return sendTransactionalEmail({
    to,
    subject: `${studentName}'s SAT progress report`,
    text: [
      greeting(parentName),
      "",
      `${studentName}'s teacher shared an SAT Practice progress report (${reportLabel}).`,
      "The report is attached to this email as a PDF.",
      "",
      REPORT_COLOR_KEY,
    ].join("\n"),
    html: `
      <p>${safeGreeting}</p>
      <p><strong>${safeStudent}</strong>'s teacher shared an SAT Practice progress report (${safeLabel}).</p>
      <p>The report is attached to this email as a PDF.</p>
      <p>${escapeHtml(REPORT_COLOR_KEY)}</p>
    `,
    attachments: [{ contentType: "application/pdf", ...attachment }],
  });
}

export async function sendPasswordResetEmail(to: string, name: string, resetUrl: string) {
  const safeName = escapeHtml(name);
  const safeUrl = escapeHtml(resetUrl);

  return sendTransactionalEmail({
    to,
    subject: "Reset your SAT Practice password",
    text: [
      `Hello ${name},`,
      "",
      "Use this link to reset your password:",
      resetUrl,
      "",
      "This link expires in 1 hour. If you did not request it, ignore this message.",
    ].join("\n"),
    html: `
      <p>Hello ${safeName},</p>
      <p>Use this link to reset your password:</p>
      <p><a href="${safeUrl}">${safeUrl}</a></p>
      <p>This link expires in 1 hour. If you did not request it, ignore this message.</p>
    `,
  });
}

export interface IssueReportEmailInput {
  id: string;
  category: string;
  comment: string;
  url: string;
  pageTitle: string | null;
  viewport: string | null;
  userAgent: string | null;
  createdAt: Date;
  target: IssueTarget;
  user: { id: string; name: string; email: string; role: string };
  screenshot: { content: Buffer; contentType: string } | null;
}

function issueElementRows(el: IssueElement) {
  const rows: [string, string][] = [
    ["Selector", el.selector],
    ["Tag", el.tag],
  ];
  if (el.id) rows.push(["id", el.id]);
  if (el.classes?.length) rows.push(["Classes", el.classes.join(" ")]);
  for (const [k, v] of Object.entries(el.attributes ?? {})) rows.push([k, v]);
  if (el.text) rows.push(["Text", el.text]);
  if (el.ancestors?.length) rows.push(["Ancestors", el.ancestors.join(" › ")]);
  if (el.rect) rows.push(["Box", `${el.rect.width}×${el.rect.height} at (${el.rect.x}, ${el.rect.y})`]);
  return rows;
}

const PRE = 'style="white-space:pre-wrap;word-break:break-all;background:#f3f4f6;border-radius:6px;padding:8px;font-size:12px"';
const TD = 'style="padding:4px 8px;border-bottom:1px solid #e5e7eb;vertical-align:top;font-size:13px"';

function htmlTable(rows: [string, string][]) {
  return `<table style="border-collapse:collapse">${rows
    .map(([k, v]) => `<tr><td ${TD}><b>${escapeHtml(k)}</b></td><td ${TD}><code>${escapeHtml(v)}</code></td></tr>`)
    .join("")}</table>`;
}

/** "Report a problem" → ISSUE_REPORT_EMAIL, with the screenshot and the full report as JSON. */
export async function sendIssueReportEmail(report: IssueReportEmailInput) {
  const to = process.env.ISSUE_REPORT_EMAIL?.trim() || ISSUE_REPORT_DEFAULT_EMAIL;
  const category = issueCategoryMeta(report.category);
  const t = report.target;
  let path = report.url;
  try {
    path = new URL(report.url).pathname;
  } catch {}
  const adminUrl = absoluteAppUrl(`/admin/reports/${report.id}`);
  const when = report.createdAt.toISOString().replace("T", " ").slice(0, 16) + " UTC";
  const about = t.kind === "page" ? "The whole screen" : t.kind === "area" ? "A dragged area" : "One element";
  const summary: [string, string][] = [
    ["From", `${report.user.name} <${report.user.email}> · ${report.user.role}`],
    ["When", when],
    ["Page", report.url],
    ["Title", report.pageTitle ?? "—"],
    ["About", `${about} · ${t.context}`],
    ["Viewport", `${report.viewport ?? "—"}${t.devicePixelRatio ? ` @${t.devicePixelRatio}x` : ""}${t.scroll ? ` · scrolled ${t.scroll.x},${t.scroll.y}` : ""}`],
    ["Browser", report.userAgent ?? "—"],
  ];
  if (t.columns?.length) summary.push(["Table columns", t.columns.join(", ")]);

  const text = [
    `${category.label} reported by ${report.user.name} (${report.user.email}, ${report.user.role})`,
    "",
    report.comment,
    "",
    ...summary.map(([k, v]) => `${k}: ${v}`),
    ...(t.element ? ["", "Element:", ...issueElementRows(t.element).map(([k, v]) => `  ${k}: ${v}`), "", "HTML:", t.element.html ?? "—"] : []),
    ...(t.inside?.length ? ["", "Inside the area:", ...t.inside.map((e) => `  ${e.selector} · ${e.text ?? ""}`)] : []),
    ...(t.errors?.length ? ["", "JS errors:", ...t.errors] : []),
    "",
    `Open in Admin → Reports: ${adminUrl}`,
  ].join("\n");

  const html = `
    <p><span style="background:${category.color};color:#fff;border-radius:6px;padding:2px 8px;font-weight:700">${escapeHtml(category.label)}</span>
      reported by <b>${escapeHtml(report.user.name)}</b> (${escapeHtml(report.user.email)}, ${escapeHtml(report.user.role)})</p>
    <blockquote style="border-left:4px solid ${category.color};margin:12px 0;padding:6px 12px;white-space:pre-wrap;font-size:15px">${escapeHtml(report.comment)}</blockquote>
    ${htmlTable(summary.map(([k, v]) => [k, v]))}
    <p><a href="${escapeHtml(report.url)}">Open the page</a> · <a href="${escapeHtml(adminUrl)}">Open in Admin → Reports</a></p>
    ${report.screenshot ? `<p><img src="cid:issue-screenshot" alt="Screenshot" style="max-width:100%;border:1px solid #e5e7eb;border-radius:8px"></p>` : "<p><i>No screenshot (the browser could not capture the page).</i></p>"}
    ${t.element ? `<h3 style="margin-bottom:4px">${t.kind === "area" ? "Element containing the area" : "Element"}</h3>${htmlTable(issueElementRows(t.element))}<h4 style="margin-bottom:4px">HTML</h4><pre ${PRE}>${escapeHtml(t.element.html ?? "—")}</pre>` : ""}
    ${t.inside?.length ? `<h3 style="margin-bottom:4px">Inside the area (${t.inside.length})</h3>${htmlTable(t.inside.map((e) => [e.selector, [e.classes?.join(" "), e.text].filter(Boolean).join(" · ")]))}` : ""}
    ${t.errors?.length ? `<h3 style="margin-bottom:4px">JS errors on the page</h3><pre ${PRE}>${escapeHtml(t.errors.join("\n"))}</pre>` : ""}
    <p style="color:#6b7280;font-size:12px">The full report is attached as report.json.</p>
  `;

  const json = {
    id: report.id,
    category: report.category,
    comment: report.comment,
    url: report.url,
    pageTitle: report.pageTitle,
    viewport: report.viewport,
    userAgent: report.userAgent,
    createdAt: report.createdAt.toISOString(),
    user: report.user,
    target: t,
  };
  const attachments: EmailAttachment[] = [
    { filename: "report.json", content: Buffer.from(JSON.stringify(json, null, 2)), contentType: "application/json" },
  ];
  if (report.screenshot) {
    const ext = report.screenshot.contentType === "image/png" ? "png" : "jpg";
    attachments.unshift({ filename: `screenshot.${ext}`, content: report.screenshot.content, contentType: report.screenshot.contentType, cid: "issue-screenshot" });
  }

  return sendTransactionalEmail({
    to,
    subject: `[SAT report] ${category.label} · ${path}${t.context ? ` · ${t.context}` : ""}`.slice(0, 200),
    text,
    html,
    attachments,
  });
}
