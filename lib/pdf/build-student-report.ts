import prisma from "@/lib/prisma";
import { teacherProgramEnrollmentScope } from "@/lib/program-scope";
import { loadMockReport, loadPracticeReport, type ReportFilters } from "@/lib/student-report";
import { renderStudentReportPdf, type ReportAreaKey, type StudentReportData } from "@/lib/pdf/student-report-document";
import { formatDate } from "@/lib/utils";
import { difficultyLabel } from "@/lib/domain-meta";

// Builds the student progress report PDF from the same data as the teacher student page
// (lib/student-report.ts), server-side and without a browser. Shared by the download/preview
// route and the "email to parents" route.

export const REPORT_AREA_ORDER: ReportAreaKey[] = ["math", "reading", "writing", "mocks"];
const PRACTICE_AREA = { math: "MATH", reading: "READING", writing: "WRITING" } as const;
export const REPORT_AREA_LABEL: Record<ReportAreaKey, string> = { math: "Math", reading: "Reading", writing: "Writing", mocks: "Tests" };

const FILE_SCOPE: Record<ReportAreaKey, string> = { math: "math", reading: "reading", writing: "writing", mocks: "full-practice-tests" };

/** Filter dates arrive as "YYYY-MM-DD"; show them as "Oct 5, 2026" (read as a calendar day, not UTC midnight). */
function reportDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  const parsed = match ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])) : new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : formatDate(parsed);
}

export function parseReportAreas(value: string | null | undefined, legacy?: string | null): ReportAreaKey[] {
  const raw = (value || legacy || "").toLowerCase();
  const alias: Record<string, ReportAreaKey> = {
    math: "math", mathematics: "math", reading: "reading", writing: "writing",
    mocks: "mocks", tests: "mocks", fpt: "mocks", exams: "mocks", "full-practice-tests": "mocks",
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
    ? `Test: ${exam.test.name}${exam.submittedAt ? `, ${formatDate(exam.submittedAt)}` : ""}`
    : [
        skill ? `Skill: ${skill.name}` : null,
        filters.difficulty ? `${difficultyLabel(filters.difficulty)} questions only` : null,
        filters.from ? `From ${reportDate(filters.from)}` : null,
        filters.to ? `To ${reportDate(filters.to)}` : null,
      ].filter(Boolean).join(" · ");

  const sections: StudentReportData["sections"] = [];
  for (const area of areas) {
    if (area === "mocks") {
      // Skill/difficulty do not apply to Tests; dates do.
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

  const slug = (value: string) => value.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "");
  const safeName = slug(student.name) || "student";
  const scope = exam ? slug(exam.test.name) || "full-practice-test" : areas.map((area) => FILE_SCOPE[area]).join("-");
  const month = new Date().toLocaleDateString("en-US", { month: "short", year: "numeric" }).replace(" ", "-"); // "Oct-2026"
  return {
    pdf,
    fileName: `SAT-progress-${safeName}-${scope}-${month}.pdf`,
    studentName: student.name,
    label: exam ? `${exam.test.name} results` : areas.map((area) => REPORT_AREA_LABEL[area]).join(", "),
  };
}
