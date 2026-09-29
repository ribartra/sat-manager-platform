import { notFound, redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import { requireTeacherOrAdmin } from "@/lib/rbac";
import { studentAccessWhereFor } from "@/lib/program-scope";
import { PageShell, PageHeader, PageContent } from "@/components/sat";
import { Card } from "@/components/ui/card";
import { buildProgressHref, progressFiltersFromParams } from "@/lib/progress-filters";

// Student Analytics was merged into the student page (performance section). Old links keep working:
// /teacher/analytics?studentId=X&area=… -> /teacher/students/X?area=…#performance
interface PageProps {
  searchParams: Promise<{ studentId?: string; area?: string; topic?: string; difficulty?: string; from?: string; to?: string }>;
}

export default async function TeacherAnalyticsRedirect({ searchParams }: PageProps) {
  const session = await requireTeacherOrAdmin();
  if (!session) notFound();
  const params = await searchParams;
  const filters = progressFiltersFromParams(params);
  const students = await prisma.user.findMany({
    where: studentAccessWhereFor(session.user),
    orderBy: { name: "asc" },
    select: { id: true },
  });
  const selectedStudentId =
    params.studentId && students.some((student) => student.id === params.studentId)
      ? params.studentId
      : students[0]?.id;

  if (selectedStudentId) {
    const href = buildProgressHref(`/teacher/students/${selectedStudentId}`, { ...filters, studentId: undefined });
    redirect(`${href}#performance`);
  }

  return (
    <PageShell>
      <PageHeader title="Student performance" description="Open a student to see their performance." />
      <PageContent>
        <Card padding="lg" className="text-center text-sm text-gray-400">No students in your programs yet.</Card>
      </PageContent>
    </PageShell>
  );
}
