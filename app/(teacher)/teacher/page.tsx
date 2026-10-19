import {
  AttentionCard,
  AttentionItem,
  ChevronCell,
  DateCell,
  EmptyState,
  LinkTr,
  PageShell,
  PracticeAreaTabs,
  RowAction,
  RowLink,
  SectionHeader,
  SimpleTable,
  StudentCell,
  TD,
} from "@/components/sat";
import prisma from "@/lib/prisma";
import Link from "next/link";
import { formatDate, relativeDay } from "@/lib/utils";
import { Card, CardBody } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Clock, Flag, UserPlus } from "lucide-react";
import { UnlockRequestActions } from "./unlock-request-actions-client";
import { auth } from "@/lib/auth";
import { getFeatureSetting } from "@/lib/app-settings";
import { refreshAssignmentStates } from "@/lib/assignments";
import { studentAccessWhereFor, teacherProgramEnrollmentScope } from "@/lib/program-scope";
import { academicTopicWhere } from "@/lib/taxonomy";
import { difficultyLabel, difficultyOptions } from "@/lib/domain-meta";
import { TeacherStudentsTable, type TeacherStudentRow } from "./students-table-client";
import { activeHomeTab, practiceAreaFromTab, practiceAreaLabel, type PracticeAreaCode } from "@/lib/practice-area";
import { progressFilterQuery } from "@/lib/progress-filters";
import { summarizeAllQuestionAnswers } from "@/lib/weighted-score";
import { SkillOptions } from "@/components/progress-filters";
import { compareSkills, isOfficialSkill } from "@/lib/taxonomy-order";
import { Alert } from "@/components/sat/alert";
import { Pct } from "@/components/sat/work-status";
import { isInactive, loadStudentOverviews, type StudentOverview } from "@/lib/teacher-overview";

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

const PRACTICE_AREAS: { code: PracticeAreaCode; tab: "math" | "reading" | "writing" }[] = [
  { code: "MATH", tab: "math" },
  { code: "READING", tab: "reading" },
  { code: "WRITING", tab: "writing" },
];

/**
 * Teacher Home: Summary · Math · Reading · Writing · Tests. Math/Reading/Writing show practice only
 * (% correct); Tests show SAT section scores; the two are never mixed (product rule).
 */
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
  const tab = activeHomeTab(params.area);
  const practiceArea = practiceAreaFromTab(tab === "summary" ? "tests" : tab);
  const firstName = (session?.user.name ?? "teacher").split(" ")[0];
  const studentScope = session ? studentAccessWhereFor(session.user, now) : { role: "STUDENT", active: true, validationStatus: "APPROVED" };
  const searchWhere = search ? { OR: [{ name: { contains: search } }, { email: { contains: search } }] } : {};

  const head = (count: number) => (
    <>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Hello, {firstName}!</h1>
          <p className="mt-0.5 text-sm text-gray-500">
            {count} student{count === 1 ? "" : "s"} · Today is {now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {tab === "summary" || tab === "tests" ? (
            <form action="/teacher" className="flex items-center gap-2">
              {tab !== "summary" ? <input type="hidden" name="area" value={tab} /> : null}
              <input
                name="q"
                defaultValue={search}
                placeholder="Search a student…"
                aria-label="Search a student"
                className="w-56 rounded-md border border-gray-300 px-2 py-1.5 text-sm text-gray-900"
              />
            </form>
          ) : null}
          <Link
            href="/teacher/students/invite"
            className="flex items-center gap-1.5 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            <UserPlus size={14} /> Invite student
          </Link>
        </div>
      </div>
      <PracticeAreaTabs basePath="/teacher" active={tab} includeSummary preserve={{ q: search }} />
    </>
  );

  // ---------------------------------------------------------------- Summary and Tests
  if (!practiceArea) {
    const students = await prisma.user.findMany({
      where: { ...studentScope, ...searchWhere },
      select: { id: true },
      orderBy: { name: "asc" },
    });
    const overviews = await loadStudentOverviews(students.map((s) => s.id), now);
    const rows = students.map((s) => overviews.get(s.id)).filter((o): o is StudentOverview => Boolean(o));

    if (tab === "tests") {
      return (
        <PageShell width="wide" density="compact" className="space-y-4">
          {head(rows.length)}
          {rows.length === 0 ? (
            <EmptyState title="No students match." />
          ) : (
            <SimpleTable head={["Name", "Latest test", "R&W", "Math", "In progress", "Pending", ""]}>
              {rows.map((s) => (
                <LinkTr key={s.id}>
                  <td className={TD}>
                    <StudentCell name={s.name} email={s.email} avatarUrl={s.avatarUrl}>
                      <RowLink href={`/teacher/students/${s.id}?area=tests`} className="block truncate">{s.name}</RowLink>
                    </StudentCell>
                  </td>
                  <td className={TD}>
                    {s.tests.latest ? (
                      <RowAction>
                        <Link href={`/teacher/students/${s.id}/tests/${s.tests.latest.id}`} className="hover:underline">
                          {s.tests.latest.name}
                          <span className="block text-xs text-gray-500">{s.tests.latest.submittedAt ? formatDate(s.tests.latest.submittedAt) : ""}</span>
                        </Link>
                      </RowAction>
                    ) : (
                      <span className="text-xs text-gray-400">None yet</span>
                    )}
                  </td>
                  <td className={`${TD} font-semibold tabular-nums`}>{s.tests.latest?.rw ?? "—"}</td>
                  <td className={`${TD} font-semibold tabular-nums`}>{s.tests.latest?.math ?? "—"}</td>
                  <td className={TD}>{s.tests.inProgress || "—"}</td>
                  <td className={TD}>
                    <div className="flex flex-wrap gap-1">
                      {s.tests.pending.map((p) => (
                        <Badge key={p.testId} variant={p.overdue ? "danger" : "default"}>{p.name}</Badge>
                      ))}
                      {s.tests.pending.length === 0 ? <span className="text-xs text-gray-400">—</span> : null}
                    </div>
                  </td>
                  <td className={`${TD} text-right`}>
                    <RowAction>
                      <Link href={`/teacher/students/${s.id}/assign-test`} className="whitespace-nowrap text-xs text-blue-600 hover:underline">Assign test</Link>
                    </RowAction>
                  </td>
                  <ChevronCell />
                </LinkTr>
              ))}
            </SimpleTable>
          )}
        </PageShell>
      );
    }

    const inactive = rows.filter((s) => isInactive(s.lastActiveAt, now));
    const overdueTests = rows.filter((s) => s.tests.pending.some((p) => p.overdue));
    const lowScores = rows.filter((s) => s.tests.lowSection);
    return (
      <PageShell width="wide" density="compact" className="space-y-4">
        {head(rows.length)}
        <div className="grid gap-3 md:grid-cols-3">
          <AttentionCard title="Inactive 5+ days" icon={<Clock size={14} />} tone="warn" count={inactive.length}>
            {inactive.map((s) => (
              <AttentionItem
                key={s.id}
                name={s.name}
                avatarUrl={s.avatarUrl}
                href={`/teacher/students/${s.id}`}
                detail={s.lastActiveAt ? `Last active ${relativeDay(s.lastActiveAt, now)}` : "Never active"}
              />
            ))}
          </AttentionCard>
          <AttentionCard title="Overdue tests" icon={<Flag size={14} />} tone="bad" count={overdueTests.length}>
            {overdueTests.map((s) => (
              <AttentionItem
                key={s.id}
                name={s.name}
                avatarUrl={s.avatarUrl}
                href={`/teacher/students/${s.id}?area=tests`}
                detail={s.tests.pending.filter((p) => p.overdue).map((p) => p.name).join(", ")}
              />
            ))}
          </AttentionCard>
          <AttentionCard title="Section under 550 in latest test" icon={<AlertTriangle size={14} />} tone="info" count={lowScores.length}>
            {lowScores.map((s) => (
              <AttentionItem
                key={s.id}
                name={s.name}
                avatarUrl={s.avatarUrl}
                href={`/teacher/students/${s.id}?area=tests`}
                detail={<>{s.tests.latest?.name} · R&amp;W {s.tests.latest?.rw ?? "—"} · Math {s.tests.latest?.math ?? "—"}</>}
              />
            ))}
          </AttentionCard>
        </div>

        <section>
          <SectionHeader title="Students" description="Click a row to see everything the student has done. Click an area cell to go straight to that area." />
          {rows.length === 0 ? (
            <EmptyState title="No students yet" description="Invite your first student to get started." />
          ) : (
            <SimpleTable head={[
              "Name",
              "Last active",
              ...PRACTICE_AREAS.map((a) => <span key={a.code} style={{ color: `var(--sat-area-${a.tab})` }}>{practiceAreaLabel(a.code)}</span>),
              <span key="tests" className="text-[var(--sat-area-tests)]">Tests</span>,
              "",
            ]}>
              {rows.map((s) => (
                <LinkTr key={s.id}>
                  <td className={TD}>
                    <StudentCell name={s.name} email={s.email} avatarUrl={s.avatarUrl}>
                      <RowLink href={`/teacher/students/${s.id}`} className="block truncate">{s.name}</RowLink>
                    </StudentCell>
                  </td>
                  <td className={TD}><DateCell date={s.lastActiveAt} now={now} inactive={isInactive(s.lastActiveAt, now)} /></td>
                  {PRACTICE_AREAS.map((a) => {
                    const o = s.areas[a.code];
                    return (
                      <td key={a.code} className={TD}>
                        <RowAction>
                          <Link href={`/teacher/students/${s.id}?area=${a.tab}`} className="-mx-2 -my-1 block rounded-md px-2 py-1 hover:bg-gray-100">
                            {o.last ? (
                              <>
                                <b className="text-sm font-medium text-gray-800">{formatDate(o.last.at)}</b>
                                <span className="block text-xs text-gray-500">Practice · <Pct value={o.last.pct} /></span>
                              </>
                            ) : (
                              <span className="text-xs text-gray-400">No activity</span>
                            )}
                          </Link>
                        </RowAction>
                      </td>
                    );
                  })}
                  <td className={TD}>
                    <RowAction>
                      <Link href={`/teacher/students/${s.id}?area=tests`} className="-mx-2 -my-1 block rounded-md px-2 py-1 hover:bg-gray-100">
                        {s.tests.latest ? (
                          <>
                            <span className="whitespace-nowrap text-sm">R&amp;W <b>{s.tests.latest.rw ?? "—"}</b> · M <b>{s.tests.latest.math ?? "—"}</b></span>
                            <span className="block text-xs text-gray-500">{s.tests.latest.name}{s.tests.latest.submittedAt ? ` · ${formatDate(s.tests.latest.submittedAt)}` : ""}</span>
                          </>
                        ) : (
                          <span className="text-xs text-gray-400">No test finished</span>
                        )}
                        {s.tests.inProgress ? <span className="block text-xs text-amber-700">{s.tests.inProgress} in progress</span> : null}
                      </Link>
                    </RowAction>
                  </td>
                  <ChevronCell />
                </LinkTr>
              ))}
            </SimpleTable>
          )}
        </section>
      </PageShell>
    );
  }

  // ---------------------------------------------------------------- Practice (Math / Reading / Writing)
  const area = tab as "math" | "reading" | "writing";
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
    topic: { domain: { practiceArea } },
  };
  const hasAttemptFilter = Boolean(topicId || difficulty || fromDate || toDate);

  const studentWhere = {
    ...studentScope,
    ...searchWhere,
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

  // Practice only: Test attempts and assignments are never loaded on these tabs.
  const [students, groups, topics] = await Promise.all([
    prisma.user.findMany({
      where: studentWhere,
      include: {
        groups: { include: { group: true } },
        programEnrollments: { include: { program: true }, where: { active: true, status: "APPROVED" } },
        attempts: {
          where: { status: "SUBMITTED", assignment: { practiceSet: practiceSetFilter } },
          orderBy: { submittedAt: "desc" },
          include: {
            // Only the correctness flag is used here; question snapshots stay in the database.
            answers: { select: { isCorrect: true } },
            assignment: { include: { practiceSet: { include: { topic: true } } } },
          },
        },
        assignments: {
          where: {
            status: { in: ["PENDING", "OVERDUE"] },
            practiceSet: { topic: { domain: { practiceArea } } },
          },
        },
      },
      orderBy: { name: "asc" },
    }),
    teacherGroupManagementEnabled ? prisma.group.findMany({ orderBy: { name: "asc" } }) : Promise.resolve([]),
    prisma.topic.findMany({
      where: { AND: [academicTopicWhere, { domain: { practiceArea } }] },
      include: { domain: { include: { section: true } } },
      orderBy: { name: "asc" },
    }),
  ]);

  const [overdueAssignments, unlockRequests] = await Promise.all([
    prisma.assignment.findMany({
      where: {
        dueDate: { lt: new Date() },
        status: { in: ["PENDING", "IN_PROGRESS"] },
        practiceSet: { topic: { domain: { practiceArea } } },
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
    studentUnlockRequestsEnabled
      ? prisma.unlockRequest.findMany({
          where: {
            status: "PENDING",
            assignment: {
              practiceSet: { topic: { domain: { practiceArea } } },
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
    const areaActivity = s.attempts.map((attempt) => attempt.submittedAt).filter((value): value is Date => Boolean(value));
    const lastActiveAt = areaActivity.sort((a, b) => b.getTime() - a.getTime())[0];
    if (!lastActiveAt) return true;
    return lastActiveAt < fiveDaysAgo;
  });
  const performanceBuckets = new Map<string, { label: string; correct: number; total: number; attempts: number }>();
  const studentBuckets = new Map<string, Map<string, { label: string; correct: number; total: number }>>();
  for (const student of students) {
    const mine = new Map<string, { label: string; correct: number; total: number }>();
    for (const attempt of student.attempts) {
      const practiceSet = attempt.assignment?.practiceSet;
      if (!practiceSet) continue;
      const key = `${practiceSet.topicId}:${practiceSet.difficulty}`;
      const label = `${practiceSet.topic.name} (${difficultyLabel(practiceSet.difficulty)})`;
      const bucket = performanceBuckets.get(key) ?? { label, correct: 0, total: 0, attempts: 0 };
      const score = summarizeAllQuestionAnswers(attempt.answers);
      bucket.correct += score.correct;
      bucket.total += score.total;
      bucket.attempts += 1;
      performanceBuckets.set(key, bucket);
      const own = mine.get(key) ?? { label, correct: 0, total: 0 };
      own.correct += score.correct;
      own.total += score.total;
      mine.set(key, own);
    }
    studentBuckets.set(student.id, mine);
  }
  const lowPerformance = Array.from(performanceBuckets.values())
    .filter((bucket) => bucket.total > 0)
    .map((bucket) => ({ ...bucket, score: Math.round((bucket.correct / bucket.total) * 100) }))
    .sort((a, b) => a.score - b.score)
    .slice(0, 3);

  return (
    <PageShell width="wide" density="compact" className="space-y-4">
      {head(students.length)}

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
          <button type="submit" title="Apply filters" className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700">
            Apply
          </button>
          <Link href={`/teacher?area=${area}`} className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50">
            Clear
          </Link>
        </div>
      </Card>

      {(inactiveStudents.length > 0 || overdueAssignments.length > 0 || unlockRequests.length > 0) && (
        <Alert tone="warning" className="mb-5">
          <div className="space-y-0.5">
            {inactiveStudents.length > 0 && <p><strong>{inactiveStudents.length} student{inactiveStudents.length > 1 ? "s" : ""}</strong> haven&apos;t practiced {practiceAreaLabel(practiceArea)} in 5+ days: {inactiveStudents.map((s) => s.name).join(", ")}</p>}
            {overdueAssignments.length > 0 && <p><strong>{overdueAssignments.length}</strong> overdue practice set{overdueAssignments.length > 1 ? "s" : ""} need attention.</p>}
            {unlockRequests.length > 0 && <p><strong>{unlockRequests.length}</strong> unlock request{unlockRequests.length > 1 ? "s" : ""} waiting for you.</p>}
          </div>
        </Alert>
      )}

      {lowPerformance.length > 0 && (
        <div className="mb-5 grid gap-3 md:grid-cols-3">
          {lowPerformance.map((bucket) => (
            <Card key={bucket.label} variant="danger" padding="sm" className="min-w-0">
              <p className="text-xs font-medium text-red-700">Low performance</p>
              <p className="mt-1 truncate text-sm font-semibold text-gray-900">{bucket.label}</p>
              <p className="mt-1 text-xs text-gray-600">
                {bucket.score}% average · {bucket.attempts} result{bucket.attempts !== 1 ? "s" : ""}
              </p>
            </Card>
          ))}
        </div>
      )}

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

      <TeacherStudentsTable
        showGroups={teacherGroupManagementEnabled}
        filterQuery={progressFilterQuery({ area, topic: topicId, difficulty })}
        rows={students.map((student): TeacherStudentRow => {
          const areaActivity = student.attempts.map((attempt) => attempt.submittedAt).filter((value): value is Date => Boolean(value));
          const lastActiveAt = areaActivity.sort((a, b) => b.getTime() - a.getTime())[0];
          const inactive = !lastActiveAt || lastActiveAt < fiveDaysAgo;
          const studentGroups = teacherGroupManagementEnabled
            ? student.groups.map((gm) => gm.group.name).join(", ")
            : "";
          const programs = student.programEnrollments.map((pe) => pe.program.name).join(", ");
          const avgScore = summarizeAllQuestionAnswers(student.attempts.flatMap((attempt) => attempt.answers)).percent;
          const last = student.attempts[0];
          const lastScore = last ? summarizeAllQuestionAnswers(last.answers).percent : null;
          const weakest = [...(studentBuckets.get(student.id)?.values() ?? [])]
            .filter((b) => b.total >= 2)
            .map((b) => ({ ...b, pct: Math.round((b.correct / b.total) * 100) }))
            .sort((a, b) => a.pct - b.pct)[0];

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
            pendingCount: student.assignments.length,
            avgScoreLabel: avgScore !== null ? `${avgScore}%` : "—",
            avgScoreTone:
              avgScore === null ? "none" : avgScore >= 80 ? "high" : avgScore >= 60 ? "mid" : "low",
            avgScoreFiltered: avgScore !== null && hasAttemptFilter,
            active: student.active,
            lastPracticeLabel: last?.assignment?.practiceSet
              ? `${last.assignment.practiceSet.topic.name} (${difficultyLabel(last.assignment.practiceSet.difficulty)})${lastScore !== null ? ` · ${lastScore}%` : ""}`
              : undefined,
            weakestLabel: weakest ? `${weakest.label} · ${weakest.pct}%` : undefined,
            assignHref: `/teacher/students/${student.id}/assign?area=${area}`,
          };
        })}
      />
    </PageShell>
  );
}
