import prisma from "@/lib/prisma";
import { notFound } from "next/navigation";
import { FullTestAssignClient } from "./full-test-assign-client";
import { auth } from "@/lib/auth";
import { getFeatureSetting } from "@/lib/app-settings";
import { studentAccessWhereFor } from "@/lib/program-scope";

interface PageProps { params: Promise<{ testId: string }> }

export default async function AssignFullTestPage({ params }: PageProps) {
  const { testId } = await params;
  const session = await auth();
  const teacherGroupManagementEnabled =
    session?.user.role === "ADMIN" || (await getFeatureSetting("TEACHER_GROUP_MANAGEMENT"));

  const [test, students, groups] = await Promise.all([
    prisma.fullPracticeTest.findUnique({ where: { id: testId } }),
    prisma.user.findMany({
      where: session ? studentAccessWhereFor(session.user) : { role: "STUDENT", active: true, validationStatus: "APPROVED" },
      orderBy: { name: "asc" },
    }),
    teacherGroupManagementEnabled
      ? prisma.group.findMany({
          include: { members: { where: { user: { active: true, validationStatus: "APPROVED" } } } },
          orderBy: { name: "asc" },
        })
      : Promise.resolve([]),
  ]);
  if (!test) notFound();

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="mb-6 text-xl font-semibold text-gray-900">Assign Exam: {test.name}</h1>
      <FullTestAssignClient
        testId={testId}
        students={students.map((s) => ({ id: s.id, name: s.name }))}
        groups={groups.map((g) => ({ id: g.id, name: g.name, memberIds: g.members.map((m) => m.userId) }))}
        groupAssignmentEnabled={teacherGroupManagementEnabled}
      />
    </div>
  );
}
