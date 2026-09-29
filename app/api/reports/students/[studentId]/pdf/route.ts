import { NextResponse } from "next/server";
import { requireTeacherOrAdmin } from "@/lib/rbac";
import prisma from "@/lib/prisma";
import { teacherProgramEnrollmentScope } from "@/lib/program-scope";
import { loadMockReport, loadPracticeReport, type ReportFilters } from "@/lib/student-report";
import { renderStudentReportPdf, type ReportAreaKey, type StudentReportData } from "@/lib/pdf/student-report-document";
import { getFeatureSetting } from "@/lib/app-settings";

// Student progress report as a PDF, generated server-side from the same data as the teacher
// student page (lib/student-report.ts) — no browser. `areas` picks the sections (one per area,
// concatenated in one file): math,reading,writing,mocks. Legacy aliases kept for older links
// (parents page): mathematics, fpt/exams, and the single `area=` param.
//   GET /api/reports/students/[id]/pdf?areas=math,mocks&topic=&difficulty=&from=&to=&disposition=inline
export const runtime = "nodejs";

interface RouteContext {
  params: Promise<{ studentId: string }>;
}

const ORDER: ReportAreaKey[] = ["math", "reading", "writing", "mocks"];
const PRACTICE_AREA = { math: "MATH", reading: "READING", writing: "WRITING" } as const;
const LABEL: Record<ReportAreaKey, string> = { math: "Math", reading: "Reading", writing: "Writing", mocks: "Full Practice Tests" };

function parseAreas(value: string | null, legacy: string | null): ReportAreaKey[] {
  const raw = (value || legacy || "").toLowerCase();
  const alias: Record<string, ReportAreaKey> = {
    math: "math", mathematics: "math", reading: "reading", writing: "writing",
    mocks: "mocks", fpt: "mocks", exams: "mocks", "full-practice-tests": "mocks",
  };
  const picked = new Set(raw.split(",").map((item) => alias[item.trim()]).filter(Boolean));
  if (picked.size === 0) return ["math", "reading", "writing"];
  return ORDER.filter((area) => picked.has(area));
}

export async function GET(req: Request, { params }: RouteContext) {
  const session = await requireTeacherOrAdmin();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const url = new URL(req.url);
  const areas = parseAreas(url.searchParams.get("areas"), url.searchParams.get("area"));
  const showEndDate = await getFeatureSetting("TIME_FILTER_END_DATE");
  const filters: ReportFilters = {
    topic: url.searchParams.get("topic") || undefined,
    difficulty: url.searchParams.get("difficulty") || undefined,
    from: url.searchParams.get("from") || undefined,
    // Time filters are open-ended unless Admin → Settings enables the end date.
    to: showEndDate ? url.searchParams.get("to") || undefined : undefined,
  };
  const { studentId } = await params;
  const programScope = session.user.role === "TEACHER" ? teacherProgramEnrollmentScope(session.user.id) : undefined;
  const student = await prisma.user.findFirst({
    where: { id: studentId, role: "STUDENT", ...(programScope ? { programEnrollments: programScope } : {}) },
    include: { programEnrollments: { where: { active: true, status: "APPROVED" }, include: { program: { select: { name: true } } } } },
  });
  if (!student) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const skill = filters.topic ? await prisma.topic.findUnique({ where: { id: filters.topic }, select: { name: true } }) : null;
  const filterSummary = [
    skill ? `Skill: ${skill.name}` : null,
    filters.difficulty ? `Difficulty: ${filters.difficulty}` : null,
    filters.from ? `From ${filters.from}` : null,
    filters.to ? `To ${filters.to}` : null,
  ].filter(Boolean).join(" · ");

  const sections: StudentReportData["sections"] = [];
  for (const area of areas) {
    if (area === "mocks") {
      // Skill/difficulty do not apply to Full Practice Tests; dates do.
      sections.push({ area, mock: await loadMockReport(studentId, { from: filters.from, to: filters.to }) });
    } else {
      sections.push({ area, practice: await loadPracticeReport(studentId, PRACTICE_AREA[area], filters) });
    }
  }

  const pdf = await renderStudentReportPdf({
    student: {
      name: student.name,
      email: student.email,
      programs: student.programEnrollments.map((enrollment) => enrollment.program.name),
      startDate: student.startDate,
    },
    generatedAt: new Date(),
    filterSummary,
    sections,
  });

  const safeName = student.name.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") || "student";
  const fileName = `SAT-report-${safeName}-${areas.join("-")}-${new Date().toISOString().slice(0, 10)}.pdf`;
  const disposition = url.searchParams.get("disposition") === "inline" ? "inline" : "attachment";
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${disposition}; filename="${fileName}"`,
      "Cache-Control": "no-store",
      "X-Report-Areas": areas.map((area) => LABEL[area]).join(", "),
    },
  });
}
