import nodemailer from "nodemailer";

type EmailPayload = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

function smtpConfigured() {
  return Boolean(process.env.EMAIL_HOST && process.env.EMAIL_FROM);
}

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
  if (!smtpConfigured()) {
    console.log(`[EMAIL:SKIPPED] SMTP not configured. ${payload.to}: ${payload.subject}\n${payload.text}`);
    return { sent: false, reason: "SMTP_NOT_CONFIGURED" };
  }

  const port = Number(process.env.EMAIL_PORT || 587);
  const user = process.env.EMAIL_USER;
  const pass = process.env.EMAIL_PASS;

  const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port,
    secure: port === 465,
    auth: user && pass ? { user, pass } : undefined,
  });

  try {
    await transporter.sendMail({
      from: process.env.EMAIL_FROM,
      to: payload.to,
      subject: payload.subject,
      text: payload.text,
      html: payload.html,
    });

    return { sent: true };
  } catch (error) {
    console.error("[EMAIL:FAILED]", error);
    return { sent: false, reason: "SEND_FAILED" };
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
