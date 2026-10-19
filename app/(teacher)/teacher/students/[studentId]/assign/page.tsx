import { PageShell } from "@/components/sat";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/sat/breadcrumbs";
import { loadStudentOverviews } from "@/lib/teacher-overview";
import { StudentDonePanel } from "../student-done-panel";
import { AssignForm } from "./assign-form-client";
import { getFeatureSetting } from "@/lib/app-settings";
import { studentAccessWhereFor } from "@/lib/program-scope";
import { resolvePracticeArea } from "@/lib/practice-area";
import { refreshAssignmentStates } from "@/lib/assignments";
import { comparePracticeSets, domainRank, skillRank } from "@/lib/taxonomy-order";

interface PageProps {
  params: Promise<{ studentId: string }>;
  searchParams: Promise<{ area?: string; domain?: string; topic?: string; skill?: string; difficulty?: string; sets?: string }>;
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
  const overview = (await loadStudentOverviews([student.id], now)).get(student.id);

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
    <PageShell>
      <Breadcrumbs
        items={[
          { label: "Home", href: "/teacher" },
          { label: "Students", href: "/teacher/students" },
          { label: student.name, href: `/teacher/students/${studentId}` },
          { label: "Assign practice" },
        ]}
      />
      <h1 className="mb-1 text-xl font-semibold text-gray-900">
        Assign practice to <span className="text-blue-700">{student.name}</span>
      </h1>
      <p className="mb-4 text-sm text-gray-500">1. Check what the student has done · 2. Choose practice sets · 3. Set a due date</p>
      {overview ? <StudentDonePanel overview={overview} studentId={studentId} focus="practice" /> : null}

      <AssignForm
        studentId={studentId}
        studentName={student.name}
        recommended={
          overview
            ? Object.values(overview.areas)
                .map((a) => a.weakest)
                .filter((w): w is NonNullable<typeof w> => Boolean(w) && w!.pct < 70)
                .map((w) => `${w.topicId}:${w.difficulty}`)
            : []
        }
        practiceSets={[...practiceSets].sort(comparePracticeSets).map((ps) => ({
          id: ps.id,
          name: ps.name,
          difficulty: ps.difficulty,
          topicName: ps.topic.name,
          topicId: ps.topicId,
          domainOrder: domainRank(ps.topic.domain.id),
          skillOrder: skillRank(ps.topicId),
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
        initialTopic={query.topic ?? query.skill}
        initialDifficulty={query.difficulty}
        initialSelected={(query.sets ?? "").split(",").filter(Boolean)}
      />
    </PageShell>
  );
}
