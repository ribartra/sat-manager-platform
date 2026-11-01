import { redirect } from "next/navigation";
import Link from "next/link";
import { PageShell } from "@/components/sat";
import { Alert } from "@/components/sat/alert";
import prisma from "@/lib/prisma";
import { requireTeacherOrAdmin } from "@/lib/rbac";
import { studentAccessWhereFor } from "@/lib/program-scope";
import { withSqliteRetry } from "@/lib/sqlite-retry";
import { buildProgressHref, progressFiltersFromParams } from "@/lib/progress-filters";
import { StudentHome, teacherViewLinks } from "@/app/(student)/student/student-home";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ studentId: string }>;
  searchParams: Promise<{
    area?: string;
    skill?: string;
    status?: string;
    page?: string;
    topic?: string;
    difficulty?: string;
    from?: string;
    to?: string;
  }>;
}

function StudentViewUnavailable({
  title,
  message,
  backHref = "/teacher/students",
}: {
  title: string;
  message: string;
  backHref?: string;
}) {
  return (
    <PageShell>
      <Alert tone="warning" title={title} role="alert">
        <p>{message}</p>
        <Link href={backHref} className="mt-3 inline-flex text-sm font-medium underline">
          Back to Students
        </Link>
      </Alert>
    </PageShell>
  );
}

export default async function ImpersonateStudentPage({ params, searchParams }: PageProps) {
  const session = await requireTeacherOrAdmin();
  if (!session) redirect("/login");

  const { studentId } = await params;
  const query = await searchParams;
  // Exit keeps the area/filters the teacher came with.
  const filters = progressFiltersFromParams(query);

  const student = await withSqliteRetry(() => prisma.user.findUnique({
    where: { id: studentId },
    select: { id: true, name: true, email: true, role: true, active: true, validationStatus: true },
  }));
  if (!student || student.role !== "STUDENT") {
    console.warn("[student-view] student not found or not a student", { studentId, teacherId: session.user.id });
    return (
      <StudentViewUnavailable
        title="Student view is not available"
        message="We could not find an active student for this link. Check the student id or return to the students list."
      />
    );
  }

  const inTeacherScope =
    session.user.role === "ADMIN" ||
    Boolean(
      await withSqliteRetry(() => prisma.user.findFirst({
        where: { id: studentId, ...studentAccessWhereFor(session.user) },
        select: { id: true },
      })),
    );

  if (!inTeacherScope) {
    console.warn("[student-view] student outside teacher program scope", {
      studentId,
      studentEmail: student.email,
      teacherId: session.user.id,
    });
    return (
      <StudentViewUnavailable
        title="Student view is not available"
        message="This student is not currently assigned to one of your active programs."
      />
    );
  }

  try {
    await withSqliteRetry(() => prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "IMPERSONATE_STUDENT_VIEW",
        targetType: "User",
        targetId: student.id,
        metadata: JSON.stringify({ studentEmail: student.email }),
      },
    }));
  } catch (error) {
    console.warn("[student-view] audit write failed", {
      studentId,
      studentEmail: student.email,
      teacherId: session.user.id,
      error: error instanceof Error ? error.message : "unknown_error",
    });
  }

  return (
    <div>
      <Alert
        tone="warning"
        layout="banner"
        hideIcon
        className="py-2 text-sm"
        action={
          <Link href={buildProgressHref(`/teacher/students/${student.id}`, filters)} className="text-sm underline">
            Exit Student View
          </Link>
        }
      >
        <span className="font-medium">You are viewing as: {student.name}</span>
      </Alert>
      <PageShell>
        <StudentHome studentId={student.id} firstName={student.name.split(" ")[0]} links={teacherViewLinks(student.id, student.name)} />
      </PageShell>
    </div>
  );
}
