import nodemailer from "nodemailer";
import { getSmtpConfig } from "@/lib/smtp-settings";

type EmailPayload = {
  to: string;
  subject: string;
  text: string;
  html?: string;
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
  const baseUrl = process.env.AUTH_URL || "http://localhost:3000";
  return new URL(path, baseUrl).toString();
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
    });

    return { sent: true as const };
  } catch (error) {
    console.error("[EMAIL:FAILED]", error);
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

export async function sendParentConsentEmail(to: string, parentName: string | null, studentName: string, consentUrl: string) {
  const displayName = parentName || "Parent/Guardian";
  const safeParent = escapeHtml(displayName);
  const safeStudent = escapeHtml(studentName);
  const safeUrl = escapeHtml(consentUrl);

  return sendTransactionalEmail({
    to,
    subject: "Authorize SAT Practice account enrollment",
    text: [
      `Hello ${displayName},`,
      "",
      `${studentName} has been invited to SAT Practice. Please authorize the enrollment here:`,
      consentUrl,
      "",
      "This link expires in 7 days.",
    ].join("\n"),
    html: `
      <p>Hello ${safeParent},</p>
      <p>${safeStudent} has been invited to SAT Practice. Please authorize the enrollment here:</p>
      <p><a href="${safeUrl}">${safeUrl}</a></p>
      <p>This link expires in 7 days.</p>
    `,
  });
}

export async function sendParentInviteEmail(to: string, parentName: string | null, studentName: string, inviteUrl: string) {
  const displayName = parentName || "Parent/Guardian";
  const safeParent = escapeHtml(displayName);
  const safeStudent = escapeHtml(studentName);
  const safeUrl = escapeHtml(inviteUrl);

  return sendTransactionalEmail({
    to,
    subject: "Create your SAT Practice parent account",
    text: [
      `Hello ${displayName},`,
      "",
      `${studentName} has been invited to SAT Practice. Create your parent account to follow their progress and approve their enrollment:`,
      inviteUrl,
      "",
      "This link expires in 7 days.",
    ].join("\n"),
    html: `
      <p>Hello ${safeParent},</p>
      <p>${safeStudent} has been invited to SAT Practice. Create your parent account to follow their progress and approve their enrollment:</p>
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
  const displayName = parentName || "Parent/Guardian";
  const safeParent = escapeHtml(displayName);
  const safeStudent = escapeHtml(studentName);
  const safeUrl = escapeHtml(reportUrl);
  const safeSections = escapeHtml(sectionsLabel);

  return sendTransactionalEmail({
    to,
    subject: `${studentName}'s SAT Practice progress report`,
    text: [
      `Hello ${displayName},`,
      "",
      `Your child's teacher has shared a progress report for ${studentName} (${sectionsLabel}).`,
      "Open this single-use link to view it:",
      reportUrl,
      "",
      "The link activates the first time you open it and stays available for 7 days after that.",
    ].join("\n"),
    html: `
      <p>Hello ${safeParent},</p>
      <p>Your child's teacher has shared a progress report for <strong>${safeStudent}</strong> (${safeSections}).</p>
      <p>Open this single-use link to view it:</p>
      <p><a href="${safeUrl}">${safeUrl}</a></p>
      <p>The link activates the first time you open it and stays available for 7 days after that.</p>
    `,
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
