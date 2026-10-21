import prisma from "@/lib/prisma";
import { sendIssueReportEmail } from "@/lib/email";
import type { IssueTarget } from "@/lib/issue-report";

/** Emails a stored report (lib/email sendIssueReportEmail) and records the outcome on the row. */
export async function emailIssueReport(id: string) {
  const report = await prisma.issueReport.findUnique({
    where: { id },
    include: { user: { select: { id: true, name: true, email: true, role: true } } },
  });
  if (!report) return { sent: false as const, reason: "NOT_FOUND" };
  let target: IssueTarget;
  try {
    target = JSON.parse(report.target) as IssueTarget;
  } catch {
    target = { kind: "page", context: "" };
  }
  const result = await sendIssueReportEmail({
    id: report.id,
    category: report.category,
    comment: report.comment,
    url: report.url,
    pageTitle: report.pageTitle,
    viewport: report.viewport,
    userAgent: report.userAgent,
    createdAt: report.createdAt,
    target,
    user: report.user,
    screenshot: report.screenshot ? { content: Buffer.from(report.screenshot), contentType: report.screenshotType ?? "image/jpeg" } : null,
  });
  await prisma.issueReport.update({
    where: { id },
    data: result.sent ? { emailSentAt: new Date(), emailError: null } : { emailError: result.reason },
  });
  return result;
}
