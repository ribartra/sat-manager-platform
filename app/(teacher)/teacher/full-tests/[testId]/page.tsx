import Link from "next/link";
import { AttemptStatusBadge, PageShell, PageHeader, PageContent, Pagination, VoidableValue, invalidatedRowClass, pageFromParam, paginate } from "@/components/sat";
import { notFound } from "next/navigation";
import prisma from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { QuestionListItem, toQuestionListMedia } from "@/components/question-list-item";
import { fullTestAttemptProgress } from "@/lib/attempt-progress";
import { parseFullTestProgressState } from "@/lib/full-test-progress";
import { moduleKeyFromOrder } from "@/lib/full-test-modules";
import {
  difficultyBadgeVariant,
  difficultyLabel,
  fullTestStatusBadgeVariant,
  fullTestStatusLabel,
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
      assignments: {
        include: {
          student: true,
          // Latest attempt that still counts: an invalidated one never drives progress or score.
          attempts: { where: { status: { not: "INVALIDATED" } }, orderBy: { startedAt: "desc" }, take: 1, include: { answers: true } },
        },
        orderBy: { createdAt: "desc" },
      },
      attempts: { include: { student: true }, orderBy: { startedAt: "desc" } },
    },
  });
  if (!test) notFound();

  const attemptPage = paginate(test.attempts, pageFromParam(attemptsPage), ATTEMPTS_PAGE_SIZE);
  const questionCount = test.modules.reduce((sum, module) => sum + module.questions.length, 0);

  return (
    <PageShell width="wide">
      <PageHeader
        title={test.name}
        description={`4 SAT groups · ${questionCount} questions · ${test.breakMinutes > 0 ? "optional break" : "no break"} · review ${test.reviewEnabled ? "on" : "off"} · see How scores work for the 200–800 calculation`}
        actions={
          <div className="flex flex-col items-end gap-2">
            <Badge variant={fullTestStatusBadgeVariant(test.status)}>
              {fullTestStatusLabel(test.status)}
            </Badge>
            <FullTestActions
              testId={test.id}
              status={test.status}
              hasAssignments={test.assignments.length > 0}
              hasAttempts={test.attempts.length > 0}
              variant="detail"
            />
          </div>
        }
      />
      <PageContent>
      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {test.modules.map((module) => {
          const moduleKey = moduleKeyFromOrder(module.order);
          return (
            <Card key={module.id} padding="md">
              <p className="text-sm font-semibold text-gray-900">{module.name}</p>
              <p className="mt-1 text-xs text-gray-500">
                {module.section} · skill {moduleKey} · {Math.round(module.timeLimit / 60)} min
              </p>
              <p className="mt-2 text-lg font-semibold text-gray-900">{module.questions.length} Q</p>
              <p className="text-[11px] text-gray-400">Pretest exclusion follows Admin Settings</p>
            </Card>
          );
        })}
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-4">
          {test.modules.map((module) => {
            const moduleKey = moduleKeyFromOrder(module.order);
            return (
              <Card key={module.id}>
                <CardHeader className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-sm font-semibold text-gray-900">{module.name}</h2>
                    <p className="text-xs text-gray-500">
                      {module.section} · skill {moduleKey} · {Math.round(module.timeLimit / 60)} min ·{" "}
                      {module.questions.length} questions
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
                            <Badge variant="default">{resolveQuestionType(item.question.type, item.question.options)}</Badge>
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
                const progress =
                  attempt && attempt.status === "IN_PROGRESS"
                    ? fullTestAttemptProgress({
                        modules: test.modules.map((module) => ({
                          name: module.name,
                          section: module.section,
                          questionIds: module.questions.map((item) => item.questionId),
                        })),
                        answers: attempt.answers,
                        currentModule: attempt.currentModule,
                        currentQuestion: attempt.currentQuestion,
                        status: attempt.status,
                        phase: parseFullTestProgressState(attempt.moduleTimerState, test.modules.length)?.phase,
                      })
                    : null;
                return (
                  <div key={assignment.id} className="rounded-md border border-gray-100 px-3 py-2">
                    <p className="text-sm font-medium text-gray-900">{assignment.student.name}</p>
                    <p className="text-xs text-gray-500">
                      {assignment.status}
                      {assignment.dueDate ? ` · due ${assignment.dueDate.toLocaleDateString()}` : ""}
                    </p>
                    {progress && (
                      <div className="mt-2 space-y-1">
                        <p className="text-xs text-gray-700">
                          {progress.percent}% · {progress.positionLabel}
                        </p>
                        <div className="grid grid-cols-2 gap-1">
                          {progress.modules.map((module) => (
                            <p key={module.moduleIndex} className="text-[10px] text-gray-500">
                              {module.name.replace("Reading & Writing ", "RW ").replace("Math ", "M ")}{" "}
                              {module.percent}%
                            </p>
                          ))}
                        </div>
                      </div>
                    )}
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
                Recent Attempts <span className="text-xs font-normal text-gray-400">{test.attempts.length}</span>
              </h2>
            </CardHeader>
            <CardBody className="space-y-2">
              {attemptPage.items.map((attempt) => (
                <Link
                  key={attempt.id}
                  href={`/teacher/students/${attempt.studentId}/full-tests/${attempt.id}`}
                  className={`block rounded-md border border-gray-100 px-3 py-2 hover:border-gray-300 ${invalidatedRowClass(attempt.status) ?? ""}`}
                >
                  <p className="text-sm font-medium text-gray-900">{attempt.student.name}</p>
                  <p className="mt-0.5 flex items-center gap-2 text-xs text-gray-500">
                    <AttemptStatusBadge status={attempt.status} />
                    {attempt.totalScore != null ? <VoidableValue status={attempt.status}>{attempt.totalScore}</VoidableValue> : null}
                  </p>
                </Link>
              ))}
              {test.attempts.length === 0 && <p className="text-sm text-gray-400">No attempts yet.</p>}
            </CardBody>
            <Pagination
              basePath={`/teacher/full-tests/${test.id}`}
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
