import Link from "next/link";
import { nameWithSource } from "@/lib/test-name";
import { notFound } from "next/navigation";
import { LinkTabs, PageHeader, PageShell } from "@/components/sat";
import { PAGE_TITLE_CLASS } from "@/components/sat/page-shell";
import { Alert } from "@/components/sat/alert";
import { Breadcrumbs } from "@/components/sat/breadcrumbs";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { getFeatureSetting } from "@/lib/app-settings";
import { assignableContentWhere, contentScopeFor, studentAccessWhereFor } from "@/lib/program-scope";
import { refreshAssignmentStates } from "@/lib/assignments";
import { loadStudentOverviews } from "@/lib/teacher-overview";
import { domainRank } from "@/lib/taxonomy-order";
import { ACTIVE_SOURCE_WHERE, DEFAULT_PRACTICE_SOURCE_ID } from "@/lib/content-source";
import { resolvePracticeArea, tabFromPracticeArea } from "@/lib/practice-area";
import { assignHref, assignQuery, parseAssignParams, type AssignArea, type AssignParams } from "@/lib/assign-params";
import { difficultyLabel } from "@/lib/domain-meta";
import { StudentSwitcher } from "../students/[studentId]/student-switcher";
import { StudentDonePanel } from "../students/[studentId]/student-done-panel";
import { AssignForm } from "../students/[studentId]/assign/assign-form-client";
import { AssignTestForm } from "../students/[studentId]/assign-test/assign-test-form-client";

const AREA_TABS: { key: AssignArea; label: string }[] = [
  { key: "math", label: "Math" },
  { key: "reading", label: "Reading" },
  { key: "writing", label: "Writing" },
  { key: "tests", label: "Tests" },
];

/**
 * The one Assign view (practice sets and Tests), driven by the URL (lib/assign-params.ts):
 * `/teacher/students/<id>/assign?area=…` with the student chosen, `/teacher/assign?area=…` to choose
 * one first (Assign on a Test or a Practice Set). The student is a drop-down in the title that keeps
 * the rest of the URL; the area tabs are links; `set` / `test` preselect, `topic` opens a skill,
 * `edit` changes the dates / settings of sets the student already has.
 */
export async function AssignView({ studentId, query }: { studentId: string | null; query: Record<string, string | string[] | undefined> }) {
  const session = await auth();
  if (!session) notFound();
  const now = new Date();
  const params: AssignParams = parseAssignParams(query);

  // A preselected practice set decides the area and opens its skill.
  const presetSet = params.set.length
    ? await prisma.practiceSet.findFirst({
        where: { id: params.set[0], ...contentScopeFor(session.user) },
        select: { id: true, name: true, difficulty: true, status: true, topicId: true, topic: { select: { name: true, domain: { select: { practiceArea: true } } } } },
      })
    : null;
  if (presetSet && !params.test) {
    const tab = tabFromPracticeArea(resolvePracticeArea(presetSet.topic.domain));
    if (tab === "math" || tab === "reading" || tab === "writing") params.area = tab;
    params.topic ??= presetSet.topicId;
  }
  const presetTest = params.test
    ? await prisma.fullPracticeTest.findFirst({ where: { id: params.test, ...contentScopeFor(session.user) }, select: { id: true, name: true, status: true, source: { select: { name: true } } } })
    : null;

  const studentWhere = studentAccessWhereFor(session.user, now);
  // Students to pick: those who don't have the preselected Test / practice set yet (a Test is one
  // TEST number of one source, so the same row).
  const rosterWhere = presetTest
    ? { AND: [studentWhere, { fullTestAssignments: { none: { testId: presetTest.id } } }] }
    : presetSet
      ? { AND: [studentWhere, { assignments: { none: { practiceSetId: presetSet.id } } }] }
      : studentWhere;
  const [roster, student] = await Promise.all([
    prisma.user.findMany({ where: rosterWhere, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    studentId ? prisma.user.findFirst({ where: { id: studentId, ...studentWhere }, select: { id: true, name: true } }) : Promise.resolve(null),
  ]);
  if (studentId && !student) notFound();

  // Switching student keeps what is being assigned (not the per-student edit).
  const carry = assignQuery({ ...params, edit: [] });
  const tabs = AREA_TABS.map((t) => ({ key: t.key, label: t.label, href: assignHref({ studentId, area: t.key }) }));
  const itemLabel = presetTest
    ? nameWithSource(presetTest.name, presetTest.source?.name ?? "No source")
    : presetSet
      ? `${presetSet.topic.name} (${difficultyLabel(presetSet.difficulty)})`
      : null;
  const everyoneHasIt = roster.length === 0 && Boolean(presetTest || presetSet);

  // Title prefix: editing what the student already has (dates / settings) or assigning.
  const header = (editingNow = params.edit.length > 0) => (
    <>
      <Breadcrumbs
        items={
          student
            ? [
                { label: "Home", href: "/teacher" },
                { label: "Students", href: "/teacher/students" },
                { label: student.name, href: `/teacher/students/${student.id}?area=${params.area}` },
                { label: "Assign" },
              ]
            : [
                { label: "Home", href: "/teacher" },
                presetTest ? { label: "Tests", href: "/teacher/tests" } : { label: "Practice", href: "/teacher/practice-sets" },
                ...(presetTest ? [{ label: presetTest.name, href: `/teacher/tests/${presetTest.id}` }] : presetSet ? [{ label: presetSet.name, href: `/teacher/practice-sets/${presetSet.id}` }] : []),
                { label: "Assign" },
              ]
        }
      />
      <PageHeader
        title={
          <StudentSwitcher
            prefix={editingNow ? "Edit what is assigned to" : "Assign to"}
            name={student?.name ?? ""}
            students={roster}
            selectedStudentId={student?.id ?? null}
            query={carry}
            path="/teacher/students/:id/assign"
            className={PAGE_TITLE_CLASS}
            // No student yet: the list opens by itself.
            defaultOpen={!student && roster.length > 0}
            emptyText={everyoneHasIt ? "Every student already has it." : "You have no students yet."}
          />
        }
        // No student yet: what is being assigned is the page description.
        description={
          !student && itemLabel ? (
            <>
              You&apos;re assigning <b className="font-medium text-gray-700">{itemLabel}</b>. Choose the student in the title above.
            </>
          ) : !student ? (
            "Choose the student in the title above."
          ) : (
            "1. Choose the student · 2. Check what they have done · 3. Choose practice sets or Tests · 4. Set a due date"
          )
        }
      />
      <LinkTabs label="What to assign" active={params.area} tabs={tabs} />
    </>
  );

  // ------------------------------------------------------------ No student yet (from a Test / Practice Set)
  if (!student) {
    return (
      <PageShell>
        {header()}
        {presetTest && presetTest.status !== "PUBLISHED" ? <Alert tone="warning">This Test isn&apos;t published yet: publish it before assigning it.</Alert> : null}
        {presetSet && presetSet.status !== "PUBLISHED" ? <Alert tone="warning">This practice set isn&apos;t published yet: publish it before assigning it.</Alert> : null}
        {everyoneHasIt ? <Alert tone="info">Every student already has {itemLabel}.</Alert> : roster.length === 0 ? <Alert tone="info">You have no students yet.</Alert> : null}
      </PageShell>
    );
  }

  await refreshAssignmentStates(now);
  const [overview, teacherGroupManagementEnabled] = await Promise.all([
    loadStudentOverviews([student.id], now).then((m) => m.get(student.id)),
    // Groups are optional (Admin → Settings, off by default): hide every Group control while off, for admins too.
    getFeatureSetting("TEACHER_GROUP_MANAGEMENT"),
  ]);
  const groups = teacherGroupManagementEnabled
    ? await prisma.group.findMany({
        include: { members: { where: { user: { active: true, validationStatus: "APPROVED" } }, include: { user: { select: { name: true } } } } },
        orderBy: { name: "asc" },
      })
    : [];
  const first = student.name.split(" ")[0];

  // ------------------------------------------------------------ Tests
  if (params.area === "tests") {
    const [exams, existing] = await Promise.all([
      prisma.fullPracticeTest.findMany({
        // Only Tests of a program the teacher teaches and the student is enrolled in.
        where: { status: "PUBLISHED", ...ACTIVE_SOURCE_WHERE, ...assignableContentWhere(session.user, student.id) },
        include: { source: { select: { id: true, name: true, sortOrder: true } }, modules: { select: { id: true, questions: { select: { questionId: true } } } } },
        orderBy: { name: "asc" },
      }),
      prisma.fullPracticeTestAssignment.findMany({ where: { studentId: student.id }, select: { testId: true, status: true, dueDate: true, unlockAt: true, feedbackMode: true, showExplanations: true } }),
    ]);
    // Already assigned = shown with the "ALREADY ASSIGNED" stamp and not selectable (the student can
    // retake it); an open one opens to edit its due date.
    const assignmentByTest = new Map(existing.map((row) => [row.testId, row]));
    const presetRow = params.test ? assignmentByTest.get(params.test) : undefined;
    const editingExam = presetRow && ["PENDING", "IN_PROGRESS"].includes(presetRow.status) ? exams.find((exam) => exam.id === params.test) : undefined;
    return (
      <PageShell>
        {header(Boolean(editingExam))}
        {presetTest && presetRow && !editingExam ? <Alert tone="info" className="mb-3">{first} already took {presetTest.name}; they can retake it from their Tests page.</Alert> : null}
        {overview ? <StudentDonePanel overview={overview} studentId={student.id} focus="tests" /> : null}
        <AssignTestForm
          editing={
            editingExam && presetRow
              ? {
                  id: editingExam.id,
                  name: editingExam.name,
                  dueDate: presetRow.dueDate?.toISOString() ?? null,
                  unlockAt: presetRow.unlockAt?.toISOString() ?? null,
                  feedbackMode: presetRow.feedbackMode,
                  showExplanations: presetRow.showExplanations,
                }
              : undefined
          }
          initialSelected={params.test}
          studentId={student.id}
          studentName={student.name}
          exams={exams
            .map((exam) => ({
              id: exam.id,
              assigned: assignmentByTest.has(exam.id),
              name: exam.name,
              number: exam.number,
              sourceId: exam.source?.id ?? "none",
              sourceName: exam.source?.name ?? "No source",
              sourceOrder: exam.source?.sortOrder ?? 999,
              moduleCount: exam.modules.length,
              questionCount: exam.modules.reduce((sum, module) => sum + module.questions.length, 0),
            }))}
          returnHref={`/teacher/students/${student.id}?area=tests`}
          groups={groups.map((g) => ({ id: g.id, name: g.name, memberIds: g.members.map((m) => m.userId) }))}
          groupAssignmentEnabled={teacherGroupManagementEnabled}
        />
      </PageShell>
    );
  }

  // ------------------------------------------------------------ Practice (Math / Reading / Writing)
  const [practiceSets, existing] = await Promise.all([
    prisma.practiceSet.findMany({
      // Only sets of a program the teacher teaches and the student is enrolled in.
      where: { status: "PUBLISHED", ...ACTIVE_SOURCE_WHERE, ...assignableContentWhere(session.user, student.id) },
      include: {
        topic: { include: { domain: { include: { section: true } } } },
        source: { select: { id: true, name: true, sortOrder: true } },
        questions: { select: { questionId: true } },
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.assignment.findMany({
      where: { studentId: student.id },
      select: { practiceSetId: true, status: true, dueDate: true, unlockAt: true, feedbackMode: true, showExplanations: true },
    }),
  ]);
  // Already assigned = shown with the "ALREADY ASSIGNED" stamp and not selectable (the student can retry
  // it any time); only "Edit" (dates and settings) of an open one, via ?edit=.
  const assignmentBySet = new Map(existing.map((a) => [a.practiceSetId, a]));
  const editIds = new Set([...params.edit, ...params.set.filter((id) => ["PENDING", "IN_PROGRESS"].includes(assignmentBySet.get(id)?.status ?? ""))]);
  const editing = practiceSets
    .filter((ps) => editIds.has(ps.id) && ["PENDING", "IN_PROGRESS"].includes(assignmentBySet.get(ps.id)?.status ?? ""))
    .map((ps) => {
      const current = assignmentBySet.get(ps.id)!;
      return {
        id: ps.id,
        name: ps.name,
        difficulty: ps.difficulty,
        status: current.status,
        dueDate: current.dueDate?.toISOString() ?? null,
        unlockAt: current.unlockAt?.toISOString() ?? null,
        feedbackMode: current.feedbackMode === "IMMEDIATE" ? ("IMMEDIATE" as const) : ("AFTER_SET" as const),
        showExplanations: current.showExplanations,
      };
    });
  const presetDone = presetSet && assignmentBySet.has(presetSet.id) && !editIds.has(presetSet.id);

  return (
    <PageShell>
      {header(editing.length > 0)}
      {presetDone ? (
        <Alert tone="info" className="mb-3">
          {first} already did {presetSet!.name}; they can retry it any time from their Practice page.{" "}
          <Link href={`/teacher/students/${student.id}?area=${params.area}`} className="font-medium underline">See their results</Link>
        </Alert>
      ) : null}
      {overview ? <StudentDonePanel overview={overview} studentId={student.id} focus="practice" /> : null}
      <AssignForm
        key={`${student.id}-${params.area}`}
        studentId={student.id}
        studentName={student.name}
        practiceSets={practiceSets
          .map((ps) => ({
            id: ps.id,
            assigned: assignmentBySet.has(ps.id),
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
        groups={groups.map((g) => ({ id: g.id, name: g.name, members: g.members.map((m) => ({ id: m.userId, name: m.user.name })) }))}
        groupAssignmentEnabled={teacherGroupManagementEnabled}
        lockOptionEnabled={await getFeatureSetting("ASSIGN_LOCKED_OPTION")}
        area={params.area}
        initialSelected={params.set}
        openSkillId={params.topic}
      />
    </PageShell>
  );
}
