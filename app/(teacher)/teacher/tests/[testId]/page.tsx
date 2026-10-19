import Link from "next/link";
import {
  EmptyState,
  LinkTr,
  PageContent,
  PageHeader,
  PageShell,
  Pagination,
  RowAction,
  RowLink,
  SectionHeader,
  SimpleTable,
  StudentCell,
  TD,
  invalidatedRowClass,
  pageFromParam,
  paginate,
} from "@/components/sat";
import { TestModuleTiles } from "@/components/sat/test-module-tiles";
import { Pct } from "@/components/sat/work-status";
import { Button } from "@/components/ui/button";
import { getFeatureSetting } from "@/lib/app-settings";
import { fullTestModulesForAttempt } from "@/lib/full-test-snapshot";
import { studentAccessWhereFor } from "@/lib/program-scope";
import { formatDate } from "@/lib/utils";
import { notFound } from "next/navigation";
import prisma from "@/lib/prisma";
import { requireTeacherOrAdmin } from "@/lib/rbac";
import { teacherProgramEnrollmentScope } from "@/lib/program-scope";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { QuestionListItem, toQuestionListMedia } from "@/components/question-list-item";
import { buildTestAttemptView, moduleViewsForTest } from "@/lib/test-view";
import { Breadcrumbs } from "@/components/sat/breadcrumbs";
import {
  difficultyBadgeVariant,
  difficultyLabel,
  fullTestStatusBadgeVariant,
  fullTestStatusLabel,
  questionTypeLabel,
} from "@/lib/domain-meta";
import { resolveQuestionType } from "@/lib/question-type";
import { FullTestActions } from "../full-test-actions-client";

interface PageProps {
  params: Promise<{ testId: string }>;
  searchParams: Promise<{ attemptsPage?: string }>;
}

const ATTEMPTS_PAGE_SIZE = 10;

export default async function FullTestDetailPage({ params, searchParams }: PageProps) {
  const { testId } = await params;
  const { attemptsPage } = await searchParams;
  const session = await requireTeacherOrAdmin();
  if (!session) notFound();
  const now = new Date();
  // Teachers only see students of their programs; the delete/archive guard still counts everyone.
  const studentScope =
    session.user.role === "TEACHER" ? { student: { programEnrollments: teacherProgramEnrollmentScope(session.user.id) } } : {};
  const test = await prisma.fullPracticeTest.findUnique({
    where: { id: testId },
    include: {
      modules: {
        include: {
          questions: {
            include: {
              question: {
                include: {
                  topic: { include: { domain: { include: { section: true } } } },
                  options: { select: { text: true, imageUrl: true } },
                },
              },
            },
            orderBy: { order: "asc" },
          },
        },
        orderBy: { order: "asc" },
      },
      _count: { select: { assignments: true, attempts: true } },
      assignments: {
        where: studentScope,
        include: {
          student: true,
          // Latest attempt that still counts: an invalidated one never drives progress or score.
          attempts: { where: { status: { not: "INVALIDATED" } }, orderBy: { startedAt: "desc" }, take: 1, include: { answers: true } },
        },
        orderBy: { createdAt: "desc" },
      },
      attempts: { where: studentScope, include: { student: true }, orderBy: { startedAt: "desc" } },
    },
  });
  if (!test) notFound();

  // Students table (mockup tests.html?test=): every student this teacher can see, assigned or not.
  const roster = await prisma.user.findMany({
    where: studentAccessWhereFor(session.user, now),
    select: { id: true, name: true, email: true, avatarUrl: true },
    orderBy: { name: "asc" },
  });
  const excludePretest = await getFeatureSetting("FPT_PRETEST_EXCLUSION");
  const attemptsByAssignment = new Map<string, number>();
  for (const a of test.attempts) if (a.assignmentId && a.status !== "INVALIDATED") attemptsByAssignment.set(a.assignmentId, (attemptsByAssignment.get(a.assignmentId) ?? 0) + 1);
  const assignmentByStudent = new Map(test.assignments.map((a) => [a.studentId, a]));
  const rows = await Promise.all(
    [...roster.filter((st) => assignmentByStudent.has(st.id)), ...roster.filter((st) => !assignmentByStudent.has(st.id))].map(async (st) => {
      const assignment = assignmentByStudent.get(st.id) ?? null;
      const attempt = assignment?.attempts[0] ?? null;
      const view = attempt
        ? buildTestAttemptView({
            modules: await fullTestModulesForAttempt(attempt),
            status: attempt.status,
            moduleTimerState: attempt.moduleTimerState,
            answers: attempt.answers,
            rwScore: attempt.rwScore,
            mathScore: attempt.mathScore,
            totalScore: attempt.totalScore,
            excludePretest,
          })
        : null;
      const overdue = Boolean(assignment && assignment.status !== "COMPLETED" && (assignment.status === "OVERDUE" || (assignment.dueDate && assignment.dueDate < now)));
      const status = !assignment
        ? "Not assigned"
        : attempt?.status === "IN_PROGRESS"
          ? "In progress"
          : assignment.status === "COMPLETED"
            ? "Completed"
            : overdue
              ? "Overdue"
              : "Not started";
      return { st, assignment, attempt, view, status, tries: assignment ? attemptsByAssignment.get(assignment.id) ?? 0 : 0 };
    }),
  );
  const rowPage = paginate(rows, pageFromParam(attemptsPage), ATTEMPTS_PAGE_SIZE);
  const firstAssigned = test.assignments.reduce<Date | null>((m, a) => (!m || a.createdAt < m ? a.createdAt : m), null);
  const nextDue = test.assignments
    .filter((a) => a.status !== "COMPLETED" && a.dueDate)
    .reduce<Date | null>((m, a) => (!m || a.dueDate! < m ? a.dueDate : m), null);
  const moduleViews = moduleViewsForTest(test.modules.map((m) => ({ name: m.name, section: m.section, timeLimit: m.timeLimit, questions: m.questions.map((q) => ({ questionId: q.questionId })) })));
  const sectionText = (section: string) => (section === "MATH" ? "text-[var(--sat-area-math)]" : "text-[var(--sat-area-reading)]");
  const statusBadge = (status: string) =>
    status === "Completed" ? "success" : status === "In progress" ? "warning" : status === "Overdue" ? "danger" : status === "Not started" ? "info" : "default";

  return (
    <PageShell maxWidth={1180} width="wide">
      <Breadcrumbs items={[{ label: "Home", href: "/teacher" }, { label: "Tests", href: "/teacher/tests" }, { label: test.name }]} />
      <PageHeader
        title={test.name}
        description={`${firstAssigned ? `Assigned ${formatDate(firstAssigned)}` : "Not assigned yet"}${nextDue ? ` · next due ${formatDate(nextDue)}` : ""} · 4 modules · ${test.breakMinutes > 0 ? "optional break" : "no break"} · review ${test.reviewEnabled ? "on" : "off"}`}
        actions={
          <div className="flex flex-col items-end gap-2">
            <div className="flex flex-wrap gap-2">
              <Button asChild variant="secondary"><Link href="/teacher/tests">All tests</Link></Button>
              <Button asChild><Link href={`/teacher/tests/${test.id}/assign`}>Assign this test</Link></Button>
            </div>
            <div className="flex items-center gap-2">
              {test.status !== "PUBLISHED" ? <Badge variant={fullTestStatusBadgeVariant(test.status)}>{fullTestStatusLabel(test.status)}</Badge> : null}
              <FullTestActions
                testId={test.id}
                status={test.status}
                hasAssignments={test._count.assignments > 0}
                hasAttempts={test._count.attempts > 0}
                variant="detail"
              />
            </div>
          </div>
        }
      />
      <PageContent>
      <TestModuleTiles modules={moduleViews} />

      <section id="students" className="mt-6 scroll-mt-6">
        <SectionHeader title="Students" description="Correct answers per module and section scores (200–800). Click a row to review the answers." />
        {rows.length === 0 ? (
          <EmptyState title="No students yet." />
        ) : (
          <>
            <SimpleTable
              head={[
                "Student",
                "Status",
                ...moduleViews.map((m) => <span key={m.key} className={sectionText(m.section)}>{m.short}</span>),
                <span key="rw" className="text-[var(--sat-area-reading)]">R&amp;W score</span>,
                <span key="m" className="text-[var(--sat-area-math)]">Math score</span>,
                "",
              ]}
            >
              {rowPage.items.map(({ st, assignment, attempt, view, status, tries }) => {
                const href = attempt ? `/teacher/students/${st.id}/tests/${attempt.id}` : `/teacher/students/${st.id}?area=tests`;
                const section = (code: "RW" | "MATH") => {
                  const sec = view?.sections[code];
                  if (!sec) return <span className="text-xs text-gray-400">Not taken</span>;
                  if (sec.complete && sec.score !== null) return <b className="text-base tabular-nums">{sec.score}</b>;
                  return <span className="text-xs text-gray-500">{sec.modulesDone ? `${sec.modulesDone} of 2 modules` : "Not taken"}</span>;
                };
                return (
                  <LinkTr key={st.id} className={attempt ? invalidatedRowClass(attempt.status) : undefined}>
                    <td className={TD}>
                      <StudentCell name={st.name} email={st.email} avatarUrl={st.avatarUrl}>
                        <RowLink href={href} className="block truncate">{st.name}</RowLink>
                      </StudentCell>
                    </td>
                    <td className={TD}>
                      <Badge variant={statusBadge(status)}>{status}</Badge>
                      {status === "Completed" && tries > 1 ? <span className="block text-xs text-gray-500">{tries} attempts</span> : null}
                      {assignment?.dueDate && status !== "Completed" ? <span className="block text-xs text-gray-500">due {formatDate(assignment.dueDate)}</span> : null}
                    </td>
                    {moduleViews.map((_, i) => {
                      const m = view?.modules[i];
                      return (
                        <td key={i} className={TD}>
                          {m?.state === "done" ? (
                            <Pct value={m.pct} className="font-semibold" />
                          ) : m?.state === "progress" ? (
                            <span className="text-xs text-amber-700">In progress</span>
                          ) : (
                            <span className="text-xs text-gray-400">—</span>
                          )}
                          {m?.state === "done" ? <span className="block text-xs text-gray-500">{m.right}/{m.questionCount}</span> : null}
                        </td>
                      );
                    })}
                    <td className={TD}>{section("RW")}</td>
                    <td className={TD}>{section("MATH")}</td>
                    <td className={`${TD} text-right`}>
                      {assignment ? (
                        <span className="text-xs text-blue-600">Open ›</span>
                      ) : (
                        <RowAction>
                          <Button asChild size="sm" variant="ghost">
                            <Link href={`/teacher/students/${st.id}/assign-test?test=${test.id}`}>Assign</Link>
                          </Button>
                        </RowAction>
                      )}
                    </td>
                  </LinkTr>
                );
              })}
            </SimpleTable>
            <Pagination basePath={`/teacher/tests/${test.id}`} params={{}} param="attemptsPage" anchor="students" pageSize={ATTEMPTS_PAGE_SIZE} {...rowPage} />
          </>
        )}
      </section>

      <div className="mt-6 space-y-4">
          {test.modules.map((module, moduleIndex) => {
            const view = moduleViews[moduleIndex];
            return (
              <Card key={module.id} id={`module-${view.key}`} className="scroll-mt-6">
                <CardHeader className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-sm font-semibold text-gray-900">
                      <span className={sectionText(view.section)}>{view.short}</span> · {module.name}
                    </h2>
                    <p className="text-xs text-gray-500">
                      {view.tier} · {view.minutes} min · {module.questions.length} questions
                    </p>
                  </div>
                </CardHeader>
                <CardBody className="divide-y divide-gray-100 p-0">
                  {module.questions.map((item, index) => (
                    <div key={item.questionId} className="px-5 py-3">
                      <QuestionListItem
                        question={toQuestionListMedia(item.question)}
                        href={`/teacher/questions/${item.question.id}/edit`}
                        indexLabel={<span className="text-xs font-medium text-gray-400">Q{index + 1}</span>}
                        meta={
                          <>
                            <Badge variant={difficultyBadgeVariant(item.question.difficulty)}>
                              {difficultyLabel(item.question.difficulty)}
                            </Badge>
                            <Badge variant="default">{questionTypeLabel(resolveQuestionType(item.question.type, item.question.options), true)}</Badge>
                            <Badge variant="default">{item.question.topic.name}</Badge>
                          </>
                        }
                      />
                    </div>
                  ))}
                  {module.questions.length === 0 && (
                    <div className="px-5 py-8 text-center text-sm text-gray-400">No questions in this module.</div>
                  )}
                </CardBody>
              </Card>
            );
          })}
      </div>
      </PageContent>
    </PageShell>
  );
}
