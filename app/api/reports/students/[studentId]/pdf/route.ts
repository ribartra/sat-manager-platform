import { NextResponse } from "next/server";
import { requireTeacherOrAdmin } from "@/lib/rbac";
import { type ReportFilters } from "@/lib/student-report";
import { getFeatureSetting } from "@/lib/app-settings";
import { buildStudentReportPdf, parseReportAreas } from "@/lib/pdf/build-student-report";

// Student progress report as a PDF, generated server-side from the same data as the teacher
// student page (lib/student-report.ts) — no browser. `areas` picks the sections (one per area,
// concatenated in one file): math,reading,writing,mocks. `fptAttemptId` limits the report to one
// submitted Full Practice Test. Legacy aliases kept for older links (parents page):
// mathematics, fpt/exams, and the single `area=` param.
//   GET /api/reports/students/[id]/pdf?areas=math,mocks&topic=&difficulty=&from=&to=&fptAttemptId=&disposition=inline
export const runtime = "nodejs";

interface RouteContext {
  params: Promise<{ studentId: string }>;
}

export async function GET(req: Request, { params }: RouteContext) {
  const session = await requireTeacherOrAdmin();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const url = new URL(req.url);
  const showEndDate = await getFeatureSetting("TIME_FILTER_END_DATE");
  const filters: ReportFilters = {
    topic: url.searchParams.get("topic") || undefined,
    difficulty: url.searchParams.get("difficulty") || undefined,
    from: url.searchParams.get("from") || undefined,
    // Time filters are open-ended unless Admin → Settings enables the end date.
    to: showEndDate ? url.searchParams.get("to") || undefined : undefined,
  };
  const { studentId } = await params;
  const report = await buildStudentReportPdf({
    viewer: session.user,
    studentId,
    areas: parseReportAreas(url.searchParams.get("areas"), url.searchParams.get("area")),
    filters,
    fptAttemptId: url.searchParams.get("fptAttemptId"),
  });
  if (!report) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const disposition = url.searchParams.get("disposition") === "inline" ? "inline" : "attachment";
  return new NextResponse(new Uint8Array(report.pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${disposition}; filename="${report.fileName}"`,
      "Cache-Control": "no-store",
      "X-Report-Areas": report.label,
    },
  });
}
