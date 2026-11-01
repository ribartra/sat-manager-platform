import { Breadcrumbs } from "@/components/sat/breadcrumbs";
import { PageHeader, PageShell } from "@/components/sat";
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
    <PageShell>
      <Breadcrumbs items={[{ label: "Home", href: "/teacher" }, { label: "Students", href: "/teacher/students" }, { label: student.name, href: `/teacher/students/${student.id}` }, { label: "Edit" }]} />
      <PageHeader title="Edit Student" />
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
    </PageShell>
  );
}
