import { NextResponse } from "next/server";
import { requireTeacherOrAdmin } from "@/lib/rbac";
import prisma from "@/lib/prisma";
import { studentAccessWhereFor } from "@/lib/program-scope";
import { type ReportFilters } from "@/lib/student-report";
import { getFeatureSetting } from "@/lib/app-settings";
import { buildStudentReportPdf, parseReportAreas } from "@/lib/pdf/build-student-report";
import { sendParentReportPdfEmail } from "@/lib/email";
import { writeAudit } from "@/lib/audit";
import { BadRequestError, ForbiddenError, NotFoundError, ValidationError, withApiErrors } from "@/lib/api-error";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { resolveParentAccount } from "@/lib/consent";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Emails the student report PDF (same document as the preview/download) as an attachment to
// the parents the teacher picks. Only parents linked to the student and with an email qualify.
// A student with no parent linked can be sent to one address instead (toEmail); the response then
// says whether to offer linking that address as the parent (askToLinkParent).
//   POST /api/reports/students/[id]/email  { parentIds | toEmail, areas, filters?, fptAttemptId? }
export const runtime = "nodejs";

interface RouteContext {
  params: Promise<{ studentId: string }>;
}

export const POST = withApiErrors(async function POST(req: Request, { params }: RouteContext) {
  const session = await requireTeacherOrAdmin();
  if (!session) return new ForbiddenError("Forbidden").toResponse();

  const { studentId } = await params;
  const body = (await req.json().catch(() => ({}))) as {
    parentIds?: unknown;
    areas?: unknown;
    filters?: { topic?: string; difficulty?: string; from?: string; to?: string };
    fptAttemptId?: unknown;
    toEmail?: unknown;
  };
  const parentIds = Array.isArray(body.parentIds)
    ? [...new Set(body.parentIds.filter((id): id is string => typeof id === "string"))].slice(0, 10)
    : [];
  const toEmail = typeof body.toEmail === "string" ? body.toEmail.trim().toLowerCase() : "";
  if (parentIds.length === 0 && !toEmail) return new BadRequestError("Choose at least one parent.").toResponse();
  if (toEmail && !EMAIL_RE.test(toEmail)) return new ValidationError("Enter a valid email address.", ["toEmail"]).toResponse();

  const student = await prisma.user.findFirst({
    where: { id: studentId, ...studentAccessWhereFor(session.user) },
    select: { id: true },
  });
  if (!student) return new NotFoundError("Not found").toResponse();

  let recipients: { parent: { id: string | null; name: string; email: string | null } }[];
  if (toEmail) {
    // Only for students without a parent linked; otherwise the teacher picks the linked parent.
    const linkedParents = await prisma.parentStudent.count({ where: { studentId } });
    if (linkedParents > 0) return new BadRequestError("This student has a parent linked. Choose them to send the report.").toResponse();
    const limited = checkRateLimit(`report-email-to:${session.user.id}`, 20, 60 * 60 * 1000);
    if (!limited.allowed) return rateLimitResponse(limited.resetAt);
    recipients = [{ parent: { id: null, name: toEmail, email: toEmail } }];
  } else {
    const links = await prisma.parentStudent.findMany({
      where: { studentId, parentId: { in: parentIds } },
      include: { parent: { select: { id: true, name: true, email: true } } },
    });
    recipients = links.filter((link) => link.parent.email);
    if (recipients.length === 0) {
      return new BadRequestError("None of the selected parents is linked to this student with an email.").toResponse();
    }
  }

  const showEndDate = await getFeatureSetting("TIME_FILTER_END_DATE");
  const filters: ReportFilters = {
    topic: body.filters?.topic || undefined,
    difficulty: body.filters?.difficulty || undefined,
    from: body.filters?.from || undefined,
    to: showEndDate ? body.filters?.to || undefined : undefined,
  };
  const areas = parseReportAreas(Array.isArray(body.areas) ? body.areas.join(",") : typeof body.areas === "string" ? body.areas : "");
  const fptAttemptId = typeof body.fptAttemptId === "string" && body.fptAttemptId ? body.fptAttemptId : null;
  const report = await buildStudentReportPdf({ viewer: session.user, studentId, areas, filters, fptAttemptId });
  if (!report) return new NotFoundError("Not found").toResponse();

  const results: { parentId: string | null; name: string; email: string | null; sent: boolean; reason: string | null }[] = [];
  for (const link of recipients) {
    const outcome = await sendParentReportPdfEmail(link.parent.email!, link.parent.id ? link.parent.name : null, report.studentName, report.label, {
      filename: report.fileName,
      content: report.pdf,
    });
    results.push({
      parentId: link.parent.id,
      name: link.parent.name,
      email: link.parent.email,
      sent: outcome.sent,
      reason: outcome.sent ? null : outcome.reason,
    });
  }
  const skipped = toEmail ? [] : parentIds.filter((id) => !recipients.some((link) => link.parent.id === id));

  await writeAudit({
    userId: session.user.id,
    action: "REPORT_PDF_EMAILED",
    targetType: "User",
    targetId: studentId,
    outcome: results.every((result) => result.sent) ? "success" : "failure",
    metadata: {
      areas,
      fptAttemptId,
      recipients: results.map((result) => ({ parentId: result.parentId, sent: result.sent, reason: result.reason })),
      toEmail: toEmail || undefined,
      skipped,
    },
  });

  // Offer to link the address as the parent, unless this teacher said "Don't ask again" for this
  // student or the address belongs to another kind of account (it could never be linked).
  let askToLinkParent = false;
  if (toEmail && results.some((result) => result.sent)) {
    const [dismissed, account] = await Promise.all([
      prisma.parentLinkPromptDismissal.findUnique({ where: { userId_studentId: { userId: session.user.id, studentId } } }),
      resolveParentAccount(prisma, toEmail),
    ]);
    askToLinkParent = !dismissed && account.kind !== "conflict";
  }

  return NextResponse.json({ results, skipped, askToLinkParent });
});
