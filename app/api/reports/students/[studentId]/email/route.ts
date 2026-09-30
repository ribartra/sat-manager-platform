import { NextResponse } from "next/server";
import { requireTeacherOrAdmin } from "@/lib/rbac";
import prisma from "@/lib/prisma";
import { studentAccessWhereFor } from "@/lib/program-scope";
import { type ReportFilters } from "@/lib/student-report";
import { getFeatureSetting } from "@/lib/app-settings";
import { buildStudentReportPdf, parseReportAreas } from "@/lib/pdf/build-student-report";
import { sendParentReportPdfEmail } from "@/lib/email";
import { writeAudit } from "@/lib/audit";

// Emails the student report PDF (same document as the preview/download) as an attachment to
// the parents the teacher picks. Only parents linked to the student and with an email qualify.
//   POST /api/reports/students/[id]/email  { parentIds, areas, filters?, fptAttemptId? }
export const runtime = "nodejs";

interface RouteContext {
  params: Promise<{ studentId: string }>;
}

export async function POST(req: Request, { params }: RouteContext) {
  const session = await requireTeacherOrAdmin();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { studentId } = await params;
  const body = (await req.json().catch(() => ({}))) as {
    parentIds?: unknown;
    areas?: unknown;
    filters?: { topic?: string; difficulty?: string; from?: string; to?: string };
    fptAttemptId?: unknown;
  };
  const parentIds = Array.isArray(body.parentIds)
    ? [...new Set(body.parentIds.filter((id): id is string => typeof id === "string"))].slice(0, 10)
    : [];
  if (parentIds.length === 0) return NextResponse.json({ error: "Choose at least one parent." }, { status: 400 });

  const student = await prisma.user.findFirst({
    where: { id: studentId, ...studentAccessWhereFor(session.user) },
    select: { id: true },
  });
  if (!student) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const links = await prisma.parentStudent.findMany({
    where: { studentId, parentId: { in: parentIds } },
    include: { parent: { select: { id: true, name: true, email: true } } },
  });
  const recipients = links.filter((link) => link.parent.email);
  if (recipients.length === 0) {
    return NextResponse.json({ error: "None of the selected parents is linked to this student with an email." }, { status: 400 });
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
  if (!report) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const results: { parentId: string; name: string; email: string | null; sent: boolean; reason: string | null }[] = [];
  for (const link of recipients) {
    const outcome = await sendParentReportPdfEmail(link.parent.email!, link.parent.name, report.studentName, report.label, {
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
  const skipped = parentIds.filter((id) => !recipients.some((link) => link.parent.id === id));

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
      skipped,
    },
  });

  return NextResponse.json({ results, skipped });
}
