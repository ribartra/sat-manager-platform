import { NextResponse } from "next/server";
import { requireTeacherOrAdmin } from "@/lib/rbac";
import { type ReportFilters } from "@/lib/student-report";
import { resolvePeriod } from "@/lib/period-filter";
import { buildStudentReportPdf, parseReportAreas } from "@/lib/pdf/build-student-report";
import { ForbiddenError, NotFoundError, withApiErrors } from "@/lib/api-error";

// Student progress report as a PDF, generated server-side from the same data as the teacher
// student page (lib/student-report.ts) — no browser. `areas` picks the sections (one per area,
// concatenated in one file): math,reading,writing,mocks. `fptAttemptId` limits the report to one
// submitted Full Practice Test. Legacy aliases kept for older links (parents page):
// mathematics, fpt/exams, and the single `area=` param.
// `period` (all | 30d | 60d | 90d | custom + from / to) limits tries and results to that time.
//   GET /api/reports/students/[id]/pdf?areas=math,mocks&period=30d&from=&to=&fptAttemptId=&disposition=inline
export const runtime = "nodejs";

interface RouteContext {
  params: Promise<{ studentId: string }>;
}

export const GET = withApiErrors(async function GET(req: Request, { params }: RouteContext) {
  const session = await requireTeacherOrAdmin();
  if (!session) return new ForbiddenError("Forbidden").toResponse();

  const url = new URL(req.url);
  const filters: ReportFilters = {
    topic: url.searchParams.get("topic") || undefined,
    difficulty: url.searchParams.get("difficulty") || undefined,
  };
  // The period chosen in the report dialog (the end date always applies).
  const period = resolvePeriod({ period: url.searchParams.get("period"), from: url.searchParams.get("from"), to: url.searchParams.get("to") });
  const { studentId } = await params;
  const report = await buildStudentReportPdf({
    viewer: session.user,
    studentId,
    areas: parseReportAreas(url.searchParams.get("areas"), url.searchParams.get("area")),
    filters,
    period,
    fptAttemptId: url.searchParams.get("fptAttemptId"),
  });
  if (!report) return new NotFoundError("Not found").toResponse();

  const disposition = url.searchParams.get("disposition") === "inline" ? "inline" : "attachment";
  return new NextResponse(new Uint8Array(report.pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${disposition}; filename="${report.fileName}"`,
      "Cache-Control": "no-store",
      "X-Report-Areas": report.label,
    },
  });
});
