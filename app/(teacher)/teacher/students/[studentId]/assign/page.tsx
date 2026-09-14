import { PageShell } from "@/components/sat";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { AssignForm } from "./assign-form-client";
import { getFeatureSetting } from "@/lib/app-settings";
import { studentAccessWhereFor } from "@/lib/program-scope";

interface PageProps {
  params: Promise<{ studentId: string }>;
}

export default async function AssignPage({ params }: PageProps) {
  const { studentId } = await params;
  const session = await auth();
  const now = new Date();
  const teacherGroupManagementEnabled =
    session?.user.role === "ADMIN" || (await getFeatureSetting("TEACHER_GROUP_MANAGEMENT"));
  const studentWhere = session
    ? studentAccessWhereFor(session.user, now)
    : { role: "STUDENT", active: true, validationStatus: "APPROVED" };

  const student = await prisma.user.findFirst({
    where: { id: studentId, ...studentWhere },
  });
  if (!student) notFound();

  const practiceSets = await prisma.practiceSet.findMany({
    where: { status: "PUBLISHED" },
    include: {
      topic: { include: { domain: { include: { section: true } } } },
      questions: { select: { questionId: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  const existing = await prisma.assignment.findMany({
    where: { studentId },
    select: { practiceSetId: true },
  });
  const assignedIds = new Set(existing.map((a) => a.practiceSetId));

  const groups = teacherGroupManagementEnabled
    ? await prisma.group.findMany({
        include: {
          members: {
            where: { user: { active: true, validationStatus: "APPROVED" } },
            include: { user: { select: { name: true } } },
          },
        },
      })
    : [];

  return (
    <PageShell width="narrow">
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-6">
        <Link href={`/teacher/students/${studentId}`} className="hover:text-blue-600 flex items-center gap-1">
          <ChevronLeft size={14} /> {student.name}
        </Link>
        <span>/</span>
        <span className="text-gray-900">Assign Practice Sets</span>
      </div>

      <h1 className="text-xl font-semibold text-gray-900 mb-6">
        Assign to: <span className="text-blue-700">{student.name}</span>
      </h1>

      <AssignForm
        studentId={studentId}
        practiceSets={practiceSets.map((ps) => ({
          id: ps.id,
          name: ps.name,
          difficulty: ps.difficulty,
          topicName: ps.topic.name,
          sectionLabel: ps.topic.domain.section.label,
          questionCount: ps.questions.length,
          alreadyAssigned: assignedIds.has(ps.id),
        }))}
        groups={groups.map((g) => ({
          id: g.id,
          name: g.name,
          members: g.members.map((m) => ({ id: m.userId, name: m.user.name })),
        }))}
        groupAssignmentEnabled={teacherGroupManagementEnabled}
      />
    </PageShell>
  );
}
