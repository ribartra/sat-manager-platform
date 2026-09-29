import { PageShell } from "@/components/sat";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { AssignForm } from "./assign-form-client";
import { getFeatureSetting } from "@/lib/app-settings";
import { studentAccessWhereFor } from "@/lib/program-scope";
import { resolvePracticeArea } from "@/lib/practice-area";
import { refreshAssignmentStates } from "@/lib/assignments";

interface PageProps {
  params: Promise<{ studentId: string }>;
  searchParams: Promise<{ area?: string; domain?: string; topic?: string; difficulty?: string; sets?: string }>;
}

export default async function AssignPage({ params, searchParams }: PageProps) {
  const [{ studentId }, query] = await Promise.all([params, searchParams]);
  const initialArea = ["math", "reading", "writing"].includes(query.area ?? "") ? query.area as "math" | "reading" | "writing" : "all";
  const session = await auth();
  const now = new Date();
  // Groups are optional (Admin → Settings, off by default): hide every Group control while off, for admins too.
  const teacherGroupManagementEnabled = await getFeatureSetting("TEACHER_GROUP_MANAGEMENT");
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

  await refreshAssignmentStates(now);
  const existing = await prisma.assignment.findMany({
    where: { studentId },
    select: { practiceSetId: true, status: true, dueDate: true },
  });
  const assignmentBySet = new Map(existing.map((a) => [a.practiceSetId, a]));

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
          topicId: ps.topicId,
          domainId: ps.topic.domain.id,
          domainName: ps.topic.domain.name,
          practiceArea: resolvePracticeArea({
            practiceArea: ps.topic.domain.practiceArea,
            sectionName: ps.topic.domain.section.name,
            sectionLabel: ps.topic.domain.section.label,
            domainName: ps.topic.domain.name,
          }),
          questionCount: ps.questions.length,
          assignment: assignmentBySet.has(ps.id)
            ? {
                status: assignmentBySet.get(ps.id)!.status,
                dueDate: assignmentBySet.get(ps.id)!.dueDate?.toISOString() ?? null,
              }
            : null,
        }))}
        groups={groups.map((g) => ({
          id: g.id,
          name: g.name,
          members: g.members.map((m) => ({ id: m.userId, name: m.user.name })),
        }))}
        groupAssignmentEnabled={teacherGroupManagementEnabled}
        initialArea={initialArea}
        initialDomain={query.domain}
        initialTopic={query.topic}
        initialDifficulty={query.difficulty}
        initialSelected={(query.sets ?? "").split(",").filter(Boolean)}
      />
    </PageShell>
  );
}
