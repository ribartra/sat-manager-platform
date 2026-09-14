import { PageShell } from "@/components/sat";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { studentAccessWhereFor } from "@/lib/program-scope";
import { AssignExamForm } from "./assign-exam-form-client";

interface PageProps {
  params: Promise<{ studentId: string }>;
}

export default async function AssignExamPage({ params }: PageProps) {
  const { studentId } = await params;
  const session = await auth();
  const studentWhere = session
    ? studentAccessWhereFor(session.user)
    : { role: "STUDENT" as const, active: true, validationStatus: "APPROVED" as const };

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
      select: { testId: true },
    }),
  ]);

  if (!student) notFound();

  const assignedIds = new Set(existing.map((row) => row.testId));

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
          alreadyAssigned: assignedIds.has(exam.id),
        }))}
      />
    </PageShell>
  );
}
