import { PageShell } from "@/components/sat";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { studentAccessWhereFor } from "@/lib/program-scope";
import { AssignExamForm } from "./assign-exam-form-client";
import { refreshAssignmentStates } from "@/lib/assignments";

interface PageProps {
  params: Promise<{ studentId: string }>;
  searchParams: Promise<{ area?: string; topic?: string; difficulty?: string; from?: string; to?: string }>;
}

export default async function AssignExamPage({ params, searchParams }: PageProps) {
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

  const assignmentByTest = new Map(existing.map((row) => [row.testId, row]));
  const returnParams = new URLSearchParams();
  for (const key of ["area", "topic", "difficulty", "from", "to"] as const) {
    if (query[key]) returnParams.set(key, query[key]!);
  }
  const returnHref = `/teacher/students/${studentId}${returnParams.toString() ? `?${returnParams.toString()}` : ""}`;

  return (
    <PageShell width="narrow">
      <div className="mb-6 flex items-center gap-2 text-sm text-gray-500">
        <Link href={`/teacher/students/${studentId}`} className="flex items-center gap-1 hover:text-blue-600">
          <ChevronLeft size={14} /> {student.name}
        </Link>
        <span>/</span>
        <span className="text-gray-900">Assign Exam</span>
      </div>

      <h1 className="mb-4 text-xl font-semibold text-gray-900">Assign Exam</h1>
      <AssignExamForm
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
