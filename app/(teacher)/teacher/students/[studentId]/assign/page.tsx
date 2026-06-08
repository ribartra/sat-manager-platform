import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { AssignForm } from "./assign-form-client";

interface PageProps {
  params: Promise<{ studentId: string }>;
}

export default async function AssignPage({ params }: PageProps) {
  const { studentId } = await params;
  const session = await auth();
  const programScope =
    session?.user.role === "TEACHER"
      ? {
          some: {
            active: true,
            program: {
              teachers: { some: { teacherId: session.user.id, active: true, teacher: { active: true } } },
              active: true,
              OR: [{ contractEndsAt: null }, { contractEndsAt: { gt: new Date() } }],
            },
          },
        }
      : undefined;

  const student = await prisma.user.findFirst({
    where: { id: studentId, role: "STUDENT", ...(programScope ? { programEnrollments: programScope } : {}) },
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

  const groups = await prisma.group.findMany({
    include: { members: { select: { userId: true } } },
  });

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
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
          memberIds: g.members.map((m) => m.userId),
        }))}
      />
    </div>
  );
}
