import { PageShell } from "@/components/sat";
import { assignableContentWhere } from "@/lib/program-scope";
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
import { domainRank } from "@/lib/taxonomy-order";
import { DEFAULT_PRACTICE_SOURCE_ID } from "@/lib/content-source";

interface PageProps {
  params: Promise<{ studentId: string }>;
  /** `sets` = edit mode for those already-assigned sets ("Edit" in the student's Active practice sets). */
  searchParams: Promise<{ area?: string; sets?: string }>;
}

export default async function AssignPage({ params, searchParams }: PageProps) {
  const [{ studentId }, query] = await Promise.all([params, searchParams]);
  const initialArea = ["math", "reading", "writing"].includes(query.area ?? "") ? (query.area as "math" | "reading" | "writing") : "math";
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
    // Only sets of a program the teacher teaches and the student is enrolled in.
    where: { status: "PUBLISHED", ...(session ? assignableContentWhere(session.user, studentId) : { id: "__no_session__" }) },
    include: {
      topic: { include: { domain: { include: { section: true } } } },
      source: { select: { id: true, name: true, sortOrder: true } },
      questions: { select: { questionId: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  await refreshAssignmentStates(now);
  const existing = await prisma.assignment.findMany({
    where: { studentId },
    select: { practiceSetId: true, status: true, dueDate: true },
  });
  // Already assigned = never offered again (the student can retry it any time); only "Edit" (dates and
  // settings) of an open one, via ?sets=.
  const assignmentBySet = new Map(existing.map((a) => [a.practiceSetId, a]));
  const editIds = new Set((query.sets ?? "").split(",").filter(Boolean));
  const editing = practiceSets
    .filter((ps) => editIds.has(ps.id) && ["PENDING", "IN_PROGRESS"].includes(assignmentBySet.get(ps.id)?.status ?? ""))
    .map((ps) => ({ id: ps.id, name: ps.name, difficulty: ps.difficulty, status: assignmentBySet.get(ps.id)!.status, dueDate: assignmentBySet.get(ps.id)!.dueDate?.toISOString() ?? null }));

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
    <PageShell maxWidth={1180}>
      <Breadcrumbs
        items={[
          { label: "Home", href: "/teacher" },
          { label: "Students", href: "/teacher/students" },
          { label: student.name, href: `/teacher/students/${studentId}` },
          { label: editing.length ? "Edit assigned practice" : "Assign practice" },
        ]}
      />
      <h1 className="mb-1 text-xl font-semibold text-gray-900">
        {editing.length ? "Edit practice of" : "Assign practice to"} <span className="text-blue-700">{student.name}</span>
      </h1>
      <p className="mb-4 text-sm text-gray-500">1. Check what the student has done · 2. Choose practice sets · 3. Set a due date</p>
      {overview ? <StudentDonePanel overview={overview} studentId={studentId} focus="practice" /> : null}

      <AssignForm
        studentId={studentId}
        studentName={student.name}
        practiceSets={practiceSets
          .filter((ps) => !assignmentBySet.has(ps.id))
          .map((ps) => ({
            id: ps.id,
            name: ps.name,
            difficulty: ps.difficulty,
            topicName: ps.topic.name,
            topicId: ps.topicId,
            domainOrder: domainRank(ps.topic.domain.id),
            domainId: ps.topic.domain.id,
            domainName: ps.topic.domain.name,
            sourceId: ps.source?.id ?? DEFAULT_PRACTICE_SOURCE_ID,
            sourceName: ps.source?.name ?? "College Board",
            sourceOrder: ps.source?.sortOrder ?? 0,
            practiceArea: resolvePracticeArea({ practiceArea: ps.topic.domain.practiceArea }),
            questionCount: ps.questions.length,
          }))}
        editing={editing}
        groups={groups.map((g) => ({
          id: g.id,
          name: g.name,
          members: g.members.map((m) => ({ id: m.userId, name: m.user.name })),
        }))}
        groupAssignmentEnabled={teacherGroupManagementEnabled}
        lockOptionEnabled={await getFeatureSetting("ASSIGN_LOCKED_OPTION")}
        initialArea={initialArea}
      />
    </PageShell>
  );
}
