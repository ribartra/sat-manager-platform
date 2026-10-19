import Link from "next/link";
import { AttemptStatusBadge, PageShell, PageHeader, PageContent, Pagination, VoidableValue, invalidatedRowClass, pageFromParam, paginate } from "@/components/sat";
import { notFound } from "next/navigation";
import prisma from "@/lib/prisma";
import { requireTeacherOrAdmin } from "@/lib/rbac";
import { teacherProgramEnrollmentScope } from "@/lib/program-scope";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { QuestionListItem, toQuestionListMedia } from "@/components/question-list-item";
import { completedModulesOf } from "@/lib/full-test-progress";
import { moduleViewsForTest } from "@/lib/test-view";
import { Breadcrumbs } from "@/components/sat/breadcrumbs";
import { cn } from "@/lib/utils";
import {
  difficultyBadgeVariant,
  difficultyLabel,
  fullTestStatusBadgeVariant,
  fullTestStatusLabel,
  assignmentStatusLabel,
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

  const attemptPage = paginate(test.attempts, pageFromParam(attemptsPage), ATTEMPTS_PAGE_SIZE);
  const questionCount = test.modules.reduce((sum, module) => sum + module.questions.length, 0);
  const moduleViews = moduleViewsForTest(test.modules.map((m) => ({ name: m.name, section: m.section, timeLimit: m.timeLimit, questions: m.questions.map((q) => ({ questionId: q.questionId })) })));
  const sectionText = (section: string) => (section === "MATH" ? "text-[var(--sat-area-math)]" : "text-[var(--sat-area-reading)]");

  return (
    <PageShell width="wide">
      <Breadcrumbs items={[{ label: "Home", href: "/teacher" }, { label: "Tests", href: "/teacher/tests" }, { label: test.name }]} />
      <PageHeader
        title={test.name}
        description={`4 modules · ${questionCount} questions · ${test.breakMinutes > 0 ? "optional break" : "no break"} · review ${test.reviewEnabled ? "on" : "off"} · see How scores work for the 200–800 calculation`}
        actions={
          <div className="flex flex-col items-end gap-2">
            <Badge variant={fullTestStatusBadgeVariant(test.status)}>
              {fullTestStatusLabel(test.status)}
            </Badge>
            <FullTestActions
              testId={test.id}
              status={test.status}
              hasAssignments={test._count.assignments > 0}
              hasAttempts={test._count.attempts > 0}
              variant="detail"
            />
          </div>
        }
      />
      <PageContent>
      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {moduleViews.map((m) => (
          <Card key={m.key} as="a" href={`#module-${m.key}`} padding="md" className="hover:border-gray-400">
            <p className={cn("text-sm font-semibold", sectionText(m.section))}>{m.short} <span className="font-normal text-gray-500">· {m.tier}</span></p>
            <p className="mt-1 text-xs text-gray-500">{m.name} · {m.minutes} min</p>
            <p className="mt-2 text-lg font-semibold text-gray-900">{m.questionCount} questions</p>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-4">
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

        <aside className="space-y-4">
          <Card>
            <CardHeader>
              <h2 className="text-sm font-semibold text-gray-900">Assignments</h2>
            </CardHeader>
            <CardBody className="space-y-2">
              {test.assignments.map((assignment) => {
                const attempt = assignment.attempts[0];
                const submitted = attempt?.status === "SUBMITTED";
                const completed = new Set(attempt ? completedModulesOf(attempt.moduleTimerState, test.modules.length) : []);
                const answered = new Set((attempt?.answers ?? []).filter((a) => a.answer).map((a) => a.questionId));
                return (
                  <div key={assignment.id} className="rounded-md border border-gray-100 px-3 py-2">
                    <Link href={`/teacher/students/${assignment.studentId}?area=tests`} className="text-sm font-medium text-gray-900 hover:underline">
                      {assignment.student.name}
                    </Link>
                    <p className="text-xs text-gray-500">
                      {assignmentStatusLabel(assignment.status)}
                      {assignment.dueDate ? ` · due ${assignment.dueDate.toLocaleDateString()}` : ""}
                    </p>
                    {attempt ? (
                      <div className="mt-1.5 grid grid-cols-2 gap-1">
                        {moduleViews.map((m, i) => {
                          const state = submitted || completed.has(i)
                            ? "done"
                            : test.modules[i].questions.some((q) => answered.has(q.questionId))
                              ? "progress"
                              : "todo";
                          return (
                            <span
                              key={m.key}
                              className={cn(
                                "rounded px-1.5 py-0.5 text-[11px]",
                                state === "done" ? "bg-green-50 text-green-700" : state === "progress" ? "bg-amber-50 text-amber-700" : "bg-gray-50 text-gray-500",
                              )}
                            >
                              {m.short}: {state === "done" ? "done" : state === "progress" ? "in progress" : "not started"}
                            </span>
                          );
                        })}
                      </div>
                    ) : null}
                    {attempt?.status === "SUBMITTED" && attempt.totalScore != null && (
                      <p className="mt-1 text-xs text-gray-600">Score {attempt.totalScore}</p>
                    )}
                  </div>
                );
              })}
              {test.assignments.length === 0 && <p className="text-sm text-gray-400">No assignments yet.</p>}
            </CardBody>
          </Card>

          <Card id="recent-attempts">
            <CardHeader>
              <h2 className="flex items-center justify-between text-sm font-semibold text-gray-900">
                Recent results <span className="text-xs font-normal text-gray-400">{test.attempts.length}</span>
              </h2>
            </CardHeader>
            <CardBody className="space-y-2">
              {attemptPage.items.map((attempt) => (
                <Link
                  key={attempt.id}
                  href={`/teacher/students/${attempt.studentId}/tests/${attempt.id}`}
                  className={`block rounded-md border border-gray-100 px-3 py-2 hover:border-gray-300 ${invalidatedRowClass(attempt.status) ?? ""}`}
                >
                  <p className="text-sm font-medium text-gray-900">{attempt.student.name}</p>
                  <p className="mt-0.5 flex items-center gap-2 text-xs text-gray-500">
                    <AttemptStatusBadge status={attempt.status} />
                    {attempt.totalScore != null ? <VoidableValue status={attempt.status}>{attempt.totalScore}</VoidableValue> : null}
                  </p>
                </Link>
              ))}
              {test.attempts.length === 0 && <p className="text-sm text-gray-400">Nobody has taken this test yet.</p>}
            </CardBody>
            <Pagination
              basePath={`/teacher/tests/${test.id}`}
              params={{ attemptsPage }}
              param="attemptsPage"
              anchor="recent-attempts"
              pageSize={ATTEMPTS_PAGE_SIZE}
              {...attemptPage}
              className="border-t border-gray-100"
            />
          </Card>
        </aside>
      </div>
      </PageContent>
    </PageShell>
  );
}
