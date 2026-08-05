import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { FolderOpen, Clock, CheckCircle, BookOpen } from "lucide-react";

export default async function StudentProgramPage() {
  const session = await auth();
  if (!session) redirect("/login");
  if (!["STUDENT", "PARENT"].includes(session.user.role)) redirect("/teacher");

  const studentId = session.user.id;
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
    <div className="mx-auto max-w-xl px-4 py-12">
      <Card variant="success" padding="lg">
        <div className="flex items-center gap-3 mb-6">
          <div className="rounded-full bg-green-100 p-2.5">
            <CheckCircle size={20} className="text-green-600" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-green-700">Active enrollment</p>
            <h1 className="text-xl font-semibold text-gray-900">{program.name}</h1>
          </div>
          <Badge variant="success" className="ml-auto">Active</Badge>
        </div>
        <dl className="space-y-3 text-sm">
          <div className="flex justify-between">
            <dt className="text-gray-500">Teacher</dt>
            <dd className="font-medium text-gray-800">{teachers}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-gray-500">Program start</dt>
            <dd className="font-medium text-gray-800">{program.startDate.toISOString().slice(0, 10)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-gray-500">Program end</dt>
            <dd className="font-medium text-gray-800">
              {program.endDate ? program.endDate.toISOString().slice(0, 10) : "No end date"}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-gray-500">Your enrollment date</dt>
            <dd className="font-medium text-gray-800">{enrollment.enrolledAt.toISOString().slice(0, 10)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-gray-500">Active students</dt>
            <dd className="font-medium text-gray-800">{program.enrollments.length}</dd>
          </div>
        </dl>
      </Card>
    </div>
  );
}

function PendingView({ program, requestedAt }: { program: { name: string }; requestedAt: Date }) {
  return (
    <div className="mx-auto max-w-xl px-4 py-12">
      <Card variant="warning" padding="lg" className="text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-amber-100">
          <Clock size={24} className="text-amber-600" />
        </div>
        <Badge variant="warning" className="mb-3">Pending approval</Badge>
        <h1 className="text-lg font-semibold text-gray-900 mb-2">Enrollment request sent</h1>
        <p className="text-sm text-gray-600 mb-6">
          Your request to join <strong>{program.name}</strong> is waiting for approval from your
          teacher or administrator. You will get access to the full platform once approved.
        </p>
        <p className="text-xs text-gray-400">
          Request submitted on {requestedAt.toISOString().slice(0, 10)}
        </p>
      </Card>
    </div>
  );
}

function NoProgramView() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <div className="mb-8 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-blue-100">
          <FolderOpen size={24} className="text-blue-600" />
        </div>
        <h1 className="text-xl font-semibold text-gray-900">No active program</h1>
        <p className="mt-1 text-sm text-gray-500">
          Your teacher or administrator must enroll you before program content is available.
        </p>
      </div>

      <Card variant="subtle" padding="lg" className="border-dashed text-center">
        <BookOpen size={32} className="mx-auto mb-3 text-gray-300" />
        <p className="font-medium text-gray-500">Waiting for teacher enrollment</p>
        <p className="text-sm text-gray-400 mt-1">
          Program access, assignments and unlocks are managed by the teacher.
        </p>
      </Card>
    </div>
  );
}
