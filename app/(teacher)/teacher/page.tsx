import { PageShell, PracticeAreaTabs } from "@/components/sat";
import prisma from "@/lib/prisma";
import Link from "next/link";
import { formatDate } from "@/lib/utils";
import { Card, CardBody } from "@/components/ui/card";
import { AlertTriangle, UserPlus } from "lucide-react";
import { UnlockRequestActions } from "./unlock-request-actions-client";
import { auth } from "@/lib/auth";
import { getFeatureSetting } from "@/lib/app-settings";
import { refreshAssignmentStates } from "@/lib/assignments";
import { studentAccessWhereFor, teacherProgramEnrollmentScope } from "@/lib/program-scope";
import { academicTopicWhere } from "@/lib/taxonomy";
import { difficultyOptions } from "@/lib/domain-meta";
import { TeacherStudentsTable, type TeacherStudentRow } from "./students-table-client";
import { activeAreaTab, practiceAreaFromTab } from "@/lib/practice-area";
import { progressFilterQuery } from "@/lib/progress-filters";
import { summarizeAllQuestionAnswers } from "@/lib/weighted-score";
import { SkillOptions } from "@/components/progress-filters";
import { compareSkills, isOfficialSkill } from "@/lib/taxonomy-order";

interface PageProps {
  searchParams: Promise<{
    q?: string;
    area?: string;
    group?: string;
    topic?: string;
    difficulty?: string;
    from?: string;
    to?: string;
    incorporatedFrom?: string;
    incorporatedTo?: string;
  }>;
}

function parseDateParam(value?: string, endOfDay = false) {
  if (!value) return undefined;
  const date = new Date(`${value}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}`);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

export default async function TeacherDashboard({ searchParams }: PageProps) {
  const session = await auth();
  const now = new Date();
  await refreshAssignmentStates(now);
  const programScope =
    session?.user.role === "TEACHER"
      ? teacherProgramEnrollmentScope(session.user.id, now)
      : undefined;
  const params = await searchParams;
  const search = params.q?.trim() ?? "";
  const area = activeAreaTab(params.area, "math");
  const practiceArea = practiceAreaFromTab(area);
  // Groups are optional (Admin → Settings, off by default): hide every Group control while off, for admins too.
  const teacherGroupManagementEnabled = await getFeatureSetting("TEACHER_GROUP_MANAGEMENT");
  const groupId = teacherGroupManagementEnabled ? params.group || "" : "";
  const topicId = params.topic || "";
  const difficulty = params.difficulty || "";
  const fromDate = parseDateParam(params.incorporatedFrom ?? params.from);
  // Open-ended unless Admin → Settings → "Show 'to' date in time filters" is on.
  const showEndDate = await getFeatureSetting("TIME_FILTER_END_DATE");
  const toDate = showEndDate ? parseDateParam(params.incorporatedTo ?? params.to, true) : undefined;
  const practiceSetFilter = {
    ...(topicId ? { topicId } : {}),
    ...(difficulty ? { difficulty } : {}),
    ...(practiceArea ? { topic: { domain: { practiceArea } } } : {}),
  };
  const hasAttemptFilter = Boolean(topicId || difficulty || fromDate || toDate);

  const studentWhere = {
    ...(session ? studentAccessWhereFor(session.user, now) : { role: "STUDENT", active: true, validationStatus: "APPROVED" }),
    ...(search
      ? {
          OR: [
            { name: { contains: search } },
            { email: { contains: search } },
          ],
        }
      : {}),
    ...(teacherGroupManagementEnabled && groupId ? { groups: { some: { groupId } } } : {}),
    ...(fromDate || toDate
      ? {
          startDate: {
            ...(fromDate ? { gte: fromDate } : {}),
            ...(toDate ? { lte: toDate } : {}),
          },
        }
      : {}),
  };

  const studentUnlockRequestsEnabled = await getFeatureSetting("STUDENT_UNLOCK_REQUESTS");

  const [students, groups, topics] = await Promise.all([
    prisma.user.findMany({
      where: studentWhere,
      include: {
        groups: { include: { group: true } },
        programEnrollments: { include: { program: true }, where: { active: true, status: "APPROVED" } },
        attempts: {
          where: {
            status: "SUBMITTED",
            ...(area === "mocks" ? { id: "__no_practice_attempt__" } : {}),
            ...(area !== "mocks" && (topicId || difficulty || practiceArea)
              ? {
                  assignment: {
                    practiceSet: practiceSetFilter,
                  },
                }
              : {}),
          },
          orderBy: { submittedAt: "desc" },
          include: {
            answers: true,
            assignment: { include: { practiceSet: { include: { topic: true } } } },
          },
        },
        assignments: {
          where: {
            status: { in: ["PENDING", "OVERDUE"] },
            ...(area === "mocks" ? { id: "__no_practice_assignment__" } : {}),
            ...(area !== "mocks" && practiceArea ? { practiceSet: { topic: { domain: { practiceArea } } } } : {}),
          },
        },
        fullTestAttempts: {
          where: {
            status: "SUBMITTED",
            ...(area === "mocks" ? {} : { id: "__no_full_test_attempt__" }),
          },
          orderBy: { submittedAt: "desc" },
          include: { answers: true, test: { select: { name: true } } },
        },
        fullTestAssignments: {
          where: {
            status: { in: ["PENDING", "OVERDUE"] },
            ...(area === "mocks" ? {} : { id: "__no_full_test_assignment__" }),
          },
        },
      },
      orderBy: { name: "asc" },
    }),
    teacherGroupManagementEnabled ? prisma.group.findMany({ orderBy: { name: "asc" } }) : Promise.resolve([]),
    prisma.topic.findMany({
      where: {
        AND: [academicTopicWhere, ...(practiceArea ? [{ domain: { practiceArea } }] : [])],
      },
      include: { domain: { include: { section: true } } },
      orderBy: { name: "asc" },
    }),
  ]);

  const [overdueAssignments, overdueFullTestAssignments, unlockRequests] = await Promise.all([
    prisma.assignment.findMany({
      where: {
        dueDate: { lt: new Date() },
        status: { in: ["PENDING", "IN_PROGRESS"] },
        ...(area === "mocks" ? { id: "__no_practice_overdue__" } : {}),
        ...(area !== "mocks" && practiceArea ? { practiceSet: { topic: { domain: { practiceArea } } } } : {}),
        student: {
          active: true,
          validationStatus: "APPROVED",
          ...(programScope ? { programEnrollments: programScope } : {}),
        },
      },
      include: { student: true, practiceSet: true },
      take: 5,
      orderBy: { dueDate: "asc" },
    }),
    prisma.fullPracticeTestAssignment.findMany({
      where: {
        status: { in: ["PENDING", "IN_PROGRESS"] },
        dueDate: { lt: new Date() },
        ...(area === "mocks" ? {} : { id: "__no_full_test_overdue__" }),
        student: {
          active: true,
          validationStatus: "APPROVED",
          ...(programScope ? { programEnrollments: programScope } : {}),
        },
      },
      include: { student: true, test: true },
      take: 5,
      orderBy: { dueDate: "asc" },
    }),
    studentUnlockRequestsEnabled
      ? prisma.unlockRequest.findMany({
          where: {
            status: "PENDING",
            ...(area === "mocks" ? { id: "__no_unlock_request__" } : {}),
            assignment: {
              ...(practiceArea ? { practiceSet: { topic: { domain: { practiceArea } } } } : {}),
              student: {
                active: true,
                validationStatus: "APPROVED",
                ...(programScope ? { programEnrollments: programScope } : {}),
              },
            },
          },
          include: { assignment: { include: { student: true, practiceSet: true } } },
          orderBy: { createdAt: "desc" },
          take: 5,
        })
      : Promise.resolve([]),
  ]);

  const fiveDaysAgo = new Date();
  fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);
  const inactiveStudents = students.filter((s) => {
    const areaActivity = area === "mocks"
      ? s.fullTestAttempts.map((attempt) => attempt.submittedAt).filter((value): value is Date => Boolean(value))
      : s.attempts.map((attempt) => attempt.submittedAt).filter((value): value is Date => Boolean(value));
    const lastActiveAt = areaActivity.sort((a, b) => b.getTime() - a.getTime())[0];
    if (!lastActiveAt) return true;
    return lastActiveAt < fiveDaysAgo;
  });
  const performanceBuckets = new Map<string, { label: string; correct: number; total: number; attempts: number }>();
  for (const student of students) {
    if (area === "mocks") {
      for (const attempt of student.fullTestAttempts) {
        const key = `full-test:${attempt.testId}`;
        const bucket = performanceBuckets.get(key) ?? {
          label: `${attempt.test.name} · Full Practice Test`,
          correct: 0,
          total: 0,
          attempts: 0,
        };
        const score = summarizeAllQuestionAnswers(attempt.answers);
        bucket.correct += score.correct;
        bucket.total += score.total;
        bucket.attempts += 1;
        performanceBuckets.set(key, bucket);
      }
      continue;
    }
    for (const attempt of student.attempts) {
      const practiceSet = attempt.assignment?.practiceSet;
      if (!practiceSet) continue;
      const key = `${practiceSet.topicId}:${practiceSet.difficulty}`;
      const bucket =
        performanceBuckets.get(key) ?? {
          label: `${practiceSet.topic.name} · ${practiceSet.difficulty}`,
          correct: 0,
          total: 0,
          attempts: 0,
        };
      const score = summarizeAllQuestionAnswers(attempt.answers);
      bucket.correct += score.correct;
      bucket.total += score.total;
      bucket.attempts += 1;
      performanceBuckets.set(key, bucket);
    }
  }
  const lowPerformance = Array.from(performanceBuckets.values())
    .filter((bucket) => bucket.total > 0)
    .map((bucket) => ({ ...bucket, score: Math.round((bucket.correct / bucket.total) * 100) }))
    .sort((a, b) => a.score - b.score)
    .slice(0, 3);

  return (
    <PageShell width="wide" density="compact" className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">Students</h1>
        <Link
          href="/teacher/students/invite"
          className="flex items-center gap-1.5 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          <UserPlus size={14} /> Invite Student
        </Link>
      </div>

      <PracticeAreaTabs
        basePath="/teacher"
        active={area}
        preserve={{ q: search, group: groupId, topic: topicId, difficulty, incorporatedFrom: params.incorporatedFrom ?? params.from, incorporatedTo: showEndDate ? params.incorporatedTo ?? params.to : undefined }}
      />

      <Card as="form" padding="sm" className="flex flex-wrap items-end gap-x-3 gap-y-2">
        <input type="hidden" name="area" value={area} />
        <label className="min-w-[10rem] flex-[1.6] text-xs font-medium text-gray-600">
          Search
          <input
            name="q"
            defaultValue={search}
            placeholder="Name or email"
            className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm text-gray-900"
          />
        </label>
        {teacherGroupManagementEnabled && (
          <label className="min-w-[7.5rem] flex-1 text-xs font-medium text-gray-600">
            Group
            <select name="group" defaultValue={groupId} className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm text-gray-900">
              <option value="">All</option>
              {groups.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.name}
                </option>
              ))}
            </select>
          </label>
        )}
        {area !== "mocks" && (
          <>
            <label className="min-w-[7.5rem] flex-1 text-xs font-medium text-gray-600">
              Skill
              <select name="topic" defaultValue={topicId} className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm text-gray-900">
                <option value="">All skills</option>
                <SkillOptions topics={topics.filter((topic) => isOfficialSkill(topic.id)).sort(compareSkills).map((topic) => ({ id: topic.id, name: topic.name, group: topic.domain.name }))} />
              </select>
            </label>
            <label className="min-w-[7.5rem] flex-1 text-xs font-medium text-gray-600">
              Difficulty
              <select name="difficulty" defaultValue={difficulty} className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm text-gray-900">
                <option value="">All</option>
                {difficultyOptions().map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </label>
          </>
        )}
        <label className="min-w-[7.5rem] flex-1 text-xs font-medium text-gray-600">
          Start date from
          <input name="incorporatedFrom" type="date" defaultValue={params.incorporatedFrom || params.from || ""} className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm text-gray-900" />
        </label>
{showEndDate && (
        <label className="min-w-[7.5rem] flex-1 text-xs font-medium text-gray-600">
          Start date to
          <input name="incorporatedTo" type="date" defaultValue={params.incorporatedTo || params.to || ""} className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm text-gray-900" />
        </label>
        )}
        <div className="flex items-center gap-2">
          <button type="submit" title="Search, group and start date choose which students are listed; skill and difficulty change the scores shown." className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700">
            Apply
          </button>
          <Link href={`/teacher?area=${area}`} className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50">
            Clear
          </Link>
        </div>
      </Card>

      {/* Alerts */}
      {(inactiveStudents.length > 0 || overdueAssignments.length > 0 || overdueFullTestAssignments.length > 0 || unlockRequests.length > 0) && (
        <Card variant="warning" padding="sm" className="mb-5">
          <div className="flex items-center gap-2">
            <AlertTriangle size={16} className="shrink-0 text-amber-600" />
            <div className="text-sm text-amber-800">
              {inactiveStudents.length > 0 && <p><strong>{inactiveStudents.length} student{inactiveStudents.length > 1 ? "s" : ""}</strong> haven&apos;t practiced in 5+ days: {inactiveStudents.map((s) => s.name).join(", ")}</p>}
              {(overdueAssignments.length > 0 || overdueFullTestAssignments.length > 0) && <p><strong>{overdueAssignments.length + overdueFullTestAssignments.length}</strong> overdue assignment{overdueAssignments.length + overdueFullTestAssignments.length > 1 ? "s" : ""} need attention.</p>}
              {unlockRequests.length > 0 && <p><strong>{unlockRequests.length}</strong> pending unlock request{unlockRequests.length > 1 ? "s" : ""}.</p>}
            </div>
          </div>
        </Card>
      )}

      {lowPerformance.length > 0 && (
        <div className="mb-5 grid gap-3 md:grid-cols-3">
          {lowPerformance.map((bucket) => (
            <Card key={bucket.label} variant="danger" padding="sm">
              <p className="text-xs font-medium text-red-700">Low performance</p>
              <p className="mt-1 truncate text-sm font-semibold text-gray-900">{bucket.label}</p>
              <p className="mt-1 text-xs text-gray-600">
                {bucket.score}% avg · {bucket.attempts} attempt{bucket.attempts !== 1 ? "s" : ""}
              </p>
            </Card>
          ))}
        </div>
      )}

      {/* Students table */}
      {unlockRequests.length > 0 && (
        <Card className="mb-6">
          <CardBody className="p-4">
            <h2 className="mb-3 text-sm font-semibold text-gray-900">Unlock Requests</h2>
            <div className="space-y-2">
              {unlockRequests.map((request) => (
                <div key={request.id} className="flex items-center justify-between border-b border-gray-100 pb-2 last:border-b-0 last:pb-0">
                  <p className="text-sm text-gray-700">
                    <strong>{request.assignment.student.name}</strong> requested <strong>{request.assignment.practiceSet.name}</strong>
                  </p>
                  <UnlockRequestActions requestId={request.id} />
                </div>
              ))}
            </div>
          </CardBody>
        </Card>
      )}

      {/* Students table */}
      <TeacherStudentsTable
        showGroups={teacherGroupManagementEnabled}
        filterQuery={progressFilterQuery({ area, topic: topicId, difficulty })}
        rows={students.map((student): TeacherStudentRow => {
          const areaActivity = area === "mocks"
            ? student.fullTestAttempts.map((attempt) => attempt.submittedAt).filter((value): value is Date => Boolean(value))
            : student.attempts.map((attempt) => attempt.submittedAt).filter((value): value is Date => Boolean(value));
          const lastActiveAt = areaActivity.sort((a, b) => b.getTime() - a.getTime())[0];
          const inactive = !lastActiveAt || lastActiveAt < fiveDaysAgo;
          const studentGroups = teacherGroupManagementEnabled
            ? student.groups.map((gm) => gm.group.name).join(", ")
            : "";
          const programs = student.programEnrollments.map((pe) => pe.program.name).join(", ");
          const avgScore = summarizeAllQuestionAnswers(
            area === "mocks"
              ? student.fullTestAttempts.flatMap((attempt) => attempt.answers)
              : student.attempts.flatMap((attempt) => attempt.answers),
          ).percent;

          return {
            id: student.id,
            name: student.name,
            email: student.email,
            programsLabel: programs || "—",
            groupsLabel: teacherGroupManagementEnabled ? studentGroups || "—" : null,
            lastActiveLabel: lastActiveAt
              ? `${formatDate(lastActiveAt)}${inactive ? " ⚠" : ""}`
              : "Never",
            lastActiveTone: !lastActiveAt ? "never" : inactive ? "warn" : "ok",
            pendingCount: area === "mocks" ? student.fullTestAssignments.length : student.assignments.length,
            avgScoreLabel: avgScore !== null ? `${avgScore}%` : "—",
            avgScoreTone:
              avgScore === null ? "none" : avgScore >= 80 ? "high" : avgScore >= 60 ? "mid" : "low",
            avgScoreFiltered: avgScore !== null && hasAttemptFilter,
            active: student.active,
          };
        })}
      />
    </PageShell>
  );
}
