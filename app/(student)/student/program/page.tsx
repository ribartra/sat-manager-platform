import { PageHeader, PageShell } from "@/components/sat";
import { Breadcrumbs } from "@/components/sat/breadcrumbs";
import { getStudentViewer } from "@/lib/student-viewer";
import prisma from "@/lib/prisma";
import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { FolderOpen, Clock, CheckCircle, BookOpen } from "lucide-react";
import { formatDate } from "@/lib/utils";

export default async function StudentProgramPage() {
  // The student shown: the signed-in student, or the teacher's Student view (read only).
  const viewer = await getStudentViewer();
  if (!viewer) redirect("/login");
  const session = viewer.session;
  if (!viewer.readOnly && !["STUDENT", "PARENT"].includes(session.user.role)) redirect("/teacher");

  const studentId = viewer.studentId;
  const now = new Date();

  // Active enrollment in a currently active program
  const activeEnrollment = await prisma.programEnrollment.findFirst({
    where: {
      studentId,
      status: "APPROVED",
      active: true,
      program: {
        active: true,
        startDate: { lte: now },
        OR: [{ endDate: null }, { endDate: { gt: now } }],
      },
    },
    include: {
      program: {
        include: {
          teachers: {
            where: { endDate: null },
            include: { teacher: { select: { name: true } } },
          },
          enrollments: { where: { status: "APPROVED", active: true }, select: { studentId: true } },
        },
      },
    },
  });

  if (activeEnrollment) {
    return <EnrolledView enrollment={activeEnrollment} />;
  }

  // Pending enrollment request
  const pendingEnrollment = await prisma.programEnrollment.findFirst({
    where: { studentId, status: "PENDING" },
    include: {
      program: {
        include: {
          teachers: {
            where: { endDate: null },
            include: { teacher: { select: { name: true } } },
          },
          enrollments: { where: { status: "APPROVED", active: true }, select: { studentId: true } },
        },
      },
    },
    orderBy: { enrolledAt: "desc" },
  });

  if (pendingEnrollment) {
    return <PendingView program={pendingEnrollment.program} requestedAt={pendingEnrollment.enrolledAt} />;
  }

  return <NoProgramView />;
}

// ─── Sub-views ────────────────────────────────────────────────────────────────

type Program = {
  id: string;
  name: string;
  startDate: Date;
  endDate: Date | null;
  teachers: { teacher: { name: string } }[];
  enrollments: { studentId: string }[];
};

type Enrollment = {
  enrolledAt: Date;
  program: Program;
};

function EnrolledView({ enrollment }: { enrollment: Enrollment }) {
  const { program } = enrollment;
  const teachers = program.teachers.map((t) => t.teacher.name).join(", ") || "—";
  return (
    <PageShell>
      <Breadcrumbs items={[{ label: "Home", href: "/student" }, { label: "Programs" }]} />
      <PageHeader title="Programs" />
      <Card variant="success" padding="lg">
        <div className="flex items-center gap-3 mb-6">
          <div className="rounded-full bg-green-100 p-2.5">
            <CheckCircle size={20} className="text-green-600" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-green-700">Your program</p>
            <h2 className="text-xl font-semibold text-gray-900">{program.name}</h2>
          </div>
          <Badge variant="success" className="ml-auto">Active</Badge>
        </div>
        <dl className="space-y-3 text-sm">
          <div className="flex justify-between">
            <dt className="text-gray-500">Teacher</dt>
            <dd className="font-medium text-gray-800">{teachers}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-gray-500">Starts</dt>
            <dd className="font-medium text-gray-800">{formatDate(program.startDate)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-gray-500">Ends</dt>
            <dd className="font-medium text-gray-800">
              {program.endDate ? formatDate(program.endDate) : "No end date"}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-gray-500">You joined</dt>
            <dd className="font-medium text-gray-800">{formatDate(enrollment.enrolledAt)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-gray-500">Students in this program</dt>
            <dd className="font-medium text-gray-800">{program.enrollments.length}</dd>
          </div>
        </dl>
      </Card>
    </PageShell>
  );
}

function PendingView({ program, requestedAt }: { program: { name: string }; requestedAt: Date }) {
  return (
    <PageShell>
      <Breadcrumbs items={[{ label: "Home", href: "/student" }, { label: "Programs" }]} />
      <PageHeader title="Programs" />
      <Card variant="warning" padding="lg" className="text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-amber-100">
          <Clock size={24} className="text-amber-600" />
        </div>
        <Badge variant="warning" className="mb-3">Waiting for approval</Badge>
        <h2 className="text-lg font-semibold text-gray-900 mb-2">Request sent</h2>
        <p className="text-sm text-gray-600 mb-6">
          Your request to join <strong>{program.name}</strong> is waiting for your teacher to
          approve it. You&apos;ll be able to use everything once it&apos;s approved.
        </p>
        <p className="text-xs text-gray-400">
          Sent on {formatDate(requestedAt)}
        </p>
      </Card>
    </PageShell>
  );
}

function NoProgramView() {
  return (
    <PageShell>
      <Breadcrumbs items={[{ label: "Home", href: "/student" }, { label: "Programs" }]} />
      <PageHeader title="Programs" />
      <div className="mb-8 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-blue-100">
          <FolderOpen size={24} className="text-blue-600" />
        </div>
        <h2 className="text-xl font-semibold text-gray-900">You&apos;re not in a program yet</h2>
        <p className="mt-1 text-sm text-gray-500">
          Your teacher needs to add you to a program before you can start practicing.
        </p>
      </div>

      <Card variant="subtle" padding="lg" className="border-dashed text-center">
        <BookOpen size={32} className="mx-auto mb-3 text-gray-300" />
        <p className="font-medium text-gray-500">Waiting for your teacher</p>
        <p className="text-sm text-gray-400 mt-1">
          Your teacher decides which programs and practice sets you can use.
        </p>
      </Card>
    </PageShell>
  );
}
