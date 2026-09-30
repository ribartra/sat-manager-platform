import prisma from "@/lib/prisma";
import { teacherProgramEnrollmentScope } from "@/lib/program-scope";
import { loadMockReport, loadPracticeReport, type ReportFilters } from "@/lib/student-report";
import { renderStudentReportPdf, type ReportAreaKey, type StudentReportData } from "@/lib/pdf/student-report-document";
import { formatDate } from "@/lib/utils";

// Builds the student progress report PDF from the same data as the teacher student page
// (lib/student-report.ts), server-side and without a browser. Shared by the download/preview
// route and the "email to parents" route.

export const REPORT_AREA_ORDER: ReportAreaKey[] = ["math", "reading", "writing", "mocks"];
const PRACTICE_AREA = { math: "MATH", reading: "READING", writing: "WRITING" } as const;
export const REPORT_AREA_LABEL: Record<ReportAreaKey, string> = { math: "Math", reading: "Reading", writing: "Writing", mocks: "Full Practice Tests" };

export function parseReportAreas(value: string | null | undefined, legacy?: string | null): ReportAreaKey[] {
  const raw = (value || legacy || "").toLowerCase();
  const alias: Record<string, ReportAreaKey> = {
    math: "math", mathematics: "math", reading: "reading", writing: "writing",
    mocks: "mocks", fpt: "mocks", exams: "mocks", "full-practice-tests": "mocks",
  };
  const picked = new Set(raw.split(",").map((item) => alias[item.trim()]).filter(Boolean));
  if (picked.size === 0) return ["math", "reading", "writing"];
  return REPORT_AREA_ORDER.filter((area) => picked.has(area));
}

export interface BuiltStudentReport {
  pdf: Buffer;
  fileName: string;
  studentName: string;
  label: string;
}

/** Returns null when the student does not exist or is outside the viewer's program scope. */
export async function buildStudentReportPdf(input: {
  viewer: { id: string; role: string };
  studentId: string;
  areas: ReportAreaKey[];
  filters: ReportFilters;
  fptAttemptId?: string | null;
}): Promise<BuiltStudentReport | null> {
  const { viewer, studentId, filters } = input;
  const programScope = viewer.role === "TEACHER" ? teacherProgramEnrollmentScope(viewer.id) : undefined;
  const student = await prisma.user.findFirst({
    where: { id: studentId, role: "STUDENT", ...(programScope ? { programEnrollments: programScope } : {}) },
    include: { programEnrollments: { where: { active: true, status: "APPROVED" }, include: { program: { select: { name: true } } } } },
  });
  if (!student) return null;

  // A specific exam: the report covers that exam only.
  const exam = input.fptAttemptId
    ? await prisma.fullPracticeTestAttempt.findFirst({
        where: { id: input.fptAttemptId, studentId, status: "SUBMITTED" },
        select: { id: true, submittedAt: true, test: { select: { name: true } } },
      })
    : null;
  if (input.fptAttemptId && !exam) return null;
  const areas: ReportAreaKey[] = exam ? ["mocks"] : input.areas;

  const skill = filters.topic ? await prisma.topic.findUnique({ where: { id: filters.topic }, select: { name: true } }) : null;
  const filterSummary = exam
    ? `Exam: ${exam.test.name}${exam.submittedAt ? ` · ${formatDate(exam.submittedAt)}` : ""}`
    : [
        skill ? `Skill: ${skill.name}` : null,
        filters.difficulty ? `Difficulty: ${filters.difficulty}` : null,
        filters.from ? `From ${filters.from}` : null,
        filters.to ? `To ${filters.to}` : null,
      ].filter(Boolean).join(" · ");

  const sections: StudentReportData["sections"] = [];
  for (const area of areas) {
    if (area === "mocks") {
      // Skill/difficulty do not apply to Full Practice Tests; dates do.
      sections.push({ area, mock: await loadMockReport(studentId, { from: filters.from, to: filters.to }, { attemptId: exam?.id }) });
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
  const scope = exam ? `exam-${exam.test.name.replace(/[^a-z0-9]+/gi, "-")}` : areas.join("-");
  return {
    pdf,
    fileName: `SAT-report-${safeName}-${scope}-${new Date().toISOString().slice(0, 10)}.pdf`,
    studentName: student.name,
    label: exam ? `${exam.test.name} results` : areas.map((area) => REPORT_AREA_LABEL[area]).join(", "),
  };
}
