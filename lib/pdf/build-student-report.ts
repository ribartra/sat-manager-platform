import prisma from "@/lib/prisma";
import { teacherProgramEnrollmentScope } from "@/lib/program-scope";
import { loadMockReport, loadPracticeReport, type ReportFilters } from "@/lib/student-report";
import { practiceSetGroups, setsFromReportAttempts, testGroups } from "@/lib/attempt-groups";
import { loadStudentTests, sortTests } from "@/lib/test-assignments";
import { renderStudentReportPdf, type ReportAreaKey, type StudentReportData } from "@/lib/pdf/student-report-document";
import { formatDate } from "@/lib/utils";

// Builds the student progress report PDF from the same data, computed the same way, as the
// teacher's student page tabs (lib/student-report.ts, lib/attempt-groups.ts, lib/test-assignments.ts),
// server-side and without a browser. Shared by the download/preview route and the "email to parents"
// route. Like the page, it shows every result (no skill / level / date filters); the one narrowing
// left is a single Test attempt ("Test report").

export const REPORT_AREA_ORDER: ReportAreaKey[] = ["math", "reading", "writing", "mocks"];
const PRACTICE_AREA = { math: "MATH", reading: "READING", writing: "WRITING" } as const;
export const REPORT_AREA_LABEL: Record<ReportAreaKey, string> = { math: "Math", reading: "Reading", writing: "Writing", mocks: "Tests" };

const FILE_SCOPE: Record<ReportAreaKey, string> = { math: "math", reading: "reading", writing: "writing", mocks: "full-practice-tests" };

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
  /** Kept for the callers; the report, like the student page, shows every result. */
  filters?: ReportFilters;
  fptAttemptId?: string | null;
}): Promise<BuiltStudentReport | null> {
  const { viewer, studentId } = input;
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

  const filterSummary = exam ? `Test: ${exam.test.name}${exam.submittedAt ? `, ${formatDate(exam.submittedAt)}` : ""}` : "All results";

  const sections: StudentReportData["sections"] = [];
  for (const area of areas) {
    if (area === "mocks") {
      // The Tests tab: KPI strip, Test cards (pending first), Test attempts and active Tests.
      const [mock, allTests] = await Promise.all([loadMockReport(studentId, {}, { attemptId: exam?.id }), loadStudentTests(studentId)]);
      const finished = new Set(mock.examHistory.map((row) => row.id));
      const keep = exam ? (a: { id: string }) => a.id === exam.id : (a: { id: string; status: string }) => a.status === "IN_PROGRESS" || finished.has(a.id);
      const ordered = sortTests(allTests);
      const tests = [...ordered.pending, ...ordered.done].filter((t) => !exam || t.attempts.some((a) => a.id === exam.id));
      sections.push({
        area,
        mock,
        tests,
        groups: testGroups(tests, keep).map((g) => ({
          ...g,
          title: String(g.title),
          number: g.number ?? null,
          sourceName: g.sourceName ?? "",
          sourceOrder: g.sourceOrder ?? 0,
          tryCount: tests.find((t) => t.assignmentId === g.key)?.attempts.length ?? g.tries.length,
        })),
      });
    } else {
      // A practice tab: skills by difficulty, active sets, comments and the practice-attempts accordion.
      const practice = await loadPracticeReport(studentId, PRACTICE_AREA[area], {});
      sections.push({
        area,
        practice,
        groups: practiceSetGroups(setsFromReportAttempts(practice.attemptHistory)).map((g) => ({
          key: g.key,
          title: String(g.title),
          skillName: g.skillName ?? null,
          sourceName: g.sourceName ?? null,
          sourceOrder: g.sourceOrder ?? null,
          tryCount: g.tryCount,
          last: g.last,
          recent: g.recent,
        })),
      });
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
