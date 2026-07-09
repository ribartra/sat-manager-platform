import prisma from "@/lib/prisma";
import { requireTeacherOrAdmin } from "@/lib/rbac";
import { studentAccessWhereFor } from "@/lib/program-scope";
import { notFound } from "next/navigation";
import { EditStudentForm } from "./student-edit-client";

interface PageProps {
  params: Promise<{ studentId: string }>;
}

export default async function EditStudentPage({ params }: PageProps) {
  const session = await requireTeacherOrAdmin();
  if (!session) notFound();

  const { studentId } = await params;
  const student = await prisma.user.findFirst({
    where: { id: studentId, ...studentAccessWhereFor(session.user) },
  });
  if (!student) notFound();

  return (
    <div className="mx-auto max-w-xl px-4 py-8">
      <h1 className="mb-6 text-xl font-semibold text-gray-900">Edit Student</h1>
      <EditStudentForm
        student={{
          id: student.id,
          name: student.name,
          email: student.email,
          phone: student.phone ?? "",
          startDate: student.startDate?.toISOString().slice(0, 10) ?? "",
          active: student.active,
        }}
      />
    </div>
  );
}
