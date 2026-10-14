import { PageShell } from "@/components/sat";
import { notFound } from "next/navigation";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { studentAccessWhereFor } from "@/lib/program-scope";
import { AssignTestForm } from "./assign-test-form-client";
import { Breadcrumbs } from "@/components/sat/breadcrumbs";
import { loadStudentOverviews } from "@/lib/teacher-overview";
import { StudentDonePanel } from "../student-done-panel";
import { refreshAssignmentStates } from "@/lib/assignments";

interface PageProps {
  params: Promise<{ studentId: string }>;
  searchParams: Promise<{ area?: string; topic?: string; difficulty?: string; from?: string; to?: string; test?: string }>;
}

export default async function AssignTestPage({ params, searchParams }: PageProps) {
  const [{ studentId }, query] = await Promise.all([params, searchParams]);
  const session = await auth();
  const studentWhere = session
    ? studentAccessWhereFor(session.user)
    : { role: "STUDENT" as const, active: true, validationStatus: "APPROVED" as const };

  await refreshAssignmentStates();
  const [student, exams, existing] = await Promise.all([
    prisma.user.findFirst({ where: { id: studentId, ...studentWhere }, select: { id: true, name: true } }),
    prisma.fullPracticeTest.findMany({
      where: { status: "PUBLISHED" },
      include: {
        modules: {
          select: {
            id: true,
            questions: { select: { questionId: true } },
          },
        },
      },
      orderBy: { name: "asc" },
    }),
    prisma.fullPracticeTestAssignment.findMany({
      where: { studentId },
      select: { testId: true, status: true, dueDate: true },
    }),
  ]);

  if (!student) notFound();
  const overview = (await loadStudentOverviews([student.id])).get(student.id);

  const assignmentByTest = new Map(existing.map((row) => [row.testId, row]));
  const returnParams = new URLSearchParams();
  for (const key of ["area", "topic", "difficulty", "from", "to"] as const) {
    if (query[key]) returnParams.set(key, query[key]!);
  }
  const returnHref = `/teacher/students/${studentId}${returnParams.toString() ? `?${returnParams.toString()}` : ""}`;

  return (
    <PageShell width="narrow">
      <Breadcrumbs
        items={[
          { label: "Home", href: "/teacher" },
          { label: "Students", href: "/teacher/students" },
          { label: student.name, href: `/teacher/students/${studentId}?area=tests` },
          { label: "Assign test" },
        ]}
      />
      <h1 className="mb-1 text-xl font-semibold text-gray-900">Assign a test</h1>
      <p className="mb-4 text-sm text-gray-500">1. Check what the student has done · 2. Choose the tests · 3. Set a due date</p>
      {overview ? <StudentDonePanel overview={overview} studentId={student.id} focus="tests" /> : null}
      <AssignTestForm
        initialSelected={query.test ? [query.test] : []}
        studentId={student.id}
        studentName={student.name}
        exams={exams.map((exam) => ({
          id: exam.id,
          name: exam.name,
          moduleCount: exam.modules.length,
          questionCount: exam.modules.reduce((sum, module) => sum + module.questions.length, 0),
          assignment: assignmentByTest.has(exam.id)
            ? {
                status: assignmentByTest.get(exam.id)!.status,
                dueDate: assignmentByTest.get(exam.id)!.dueDate?.toISOString() ?? null,
              }
            : null,
        }))}
        returnHref={returnHref}
      />
    </PageShell>
  );
}
