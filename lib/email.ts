import nodemailer from "nodemailer";
import { getSmtpConfig } from "@/lib/smtp-settings";
import { captureCaughtError, writeAudit } from "@/lib/audit";
import { PARENT_ACCESS_WINDOW_DAYS, PARENT_ACTIVATION_DEADLINE_DAYS } from "@/lib/parent-access";

export type EmailAttachment = { filename: string; content: Buffer; contentType?: string };

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

export async function sendParentConsentEmail(to: string, parentName: string | null, studentName: string, consentUrl: string) {
  const safeGreeting = escapeHtml(greeting(parentName));
  const safeStudent = escapeHtml(studentName);
  const safeUrl = escapeHtml(consentUrl);

  return sendTransactionalEmail({
    to,
    subject: `Please approve ${studentName}'s SAT Practice account`,
    text: [
      greeting(parentName),
      "",
      `${studentName} has been invited to SAT Practice. Click below to give permission:`,
      consentUrl,
      "",
      "This link expires in 7 days.",
    ].join("\n"),
    html: `
      <p>${safeGreeting}</p>
      <p>${safeStudent} has been invited to SAT Practice. Click below to give permission:</p>
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
