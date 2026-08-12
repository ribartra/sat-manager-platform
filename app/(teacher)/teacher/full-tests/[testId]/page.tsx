import Link from "next/link";
import { notFound } from "next/navigation";
import prisma from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MathContent } from "@/components/math-content";
import { fullTestAttemptProgress } from "@/lib/attempt-progress";
import { parseFullTestProgressState } from "@/lib/full-test-progress";
import { moduleKeyFromOrder } from "@/lib/full-test-modules";

interface PageProps {
  params: Promise<{ testId: string }>;
}

export default async function FullTestDetailPage({ params }: PageProps) {
  const { testId } = await params;
  const test = await prisma.fullPracticeTest.findUnique({
    where: { id: testId },
    include: {
      modules: {
        include: {
          questions: {
            include: { question: { include: { topic: { include: { domain: { include: { section: true } } } } } } },
            orderBy: { order: "asc" },
          },
        },
        orderBy: { order: "asc" },
      },
      assignments: {
        include: {
          student: true,
          attempts: { orderBy: { startedAt: "desc" }, take: 1, include: { answers: true } },
        },
        orderBy: { createdAt: "desc" },
      },
      attempts: { include: { student: true }, orderBy: { startedAt: "desc" }, take: 10 },
    },
  });
  if (!test) notFound();

  const questionCount = test.modules.reduce((sum, module) => sum + module.questions.length, 0);
  const pretestCount = test.modules.reduce(
    (sum, module) => sum + module.questions.filter((item) => item.isPretest).length,
    0,
  );

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold text-gray-900">{test.name}</h1>
            <Badge variant={test.status === "PUBLISHED" ? "success" : test.status === "ARCHIVED" ? "default" : "warning"}>
              {test.status}
            </Badge>
          </div>
          <p className="mt-1 text-sm text-gray-500">
            4 grupos SAT · {questionCount} preguntas ({pretestCount} pretest operativos excluidos del raw) · break{" "}
            {test.breakMinutes} min · review {test.reviewEnabled ? "on" : "off"}
          </p>
          <p className="mt-1 text-xs text-gray-400">
            Score conversion:{" "}
            <Link href="/teacher/full-tests/scoring" className="text-blue-600 hover:underline">
              /teacher/full-tests/scoring
            </Link>{" "}
            (RW 0–50 · Math 0–40)
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild variant="secondary">
            <Link href={`/teacher/full-tests/${test.id}/edit`}>Edit / opciones</Link>
          </Button>
          {test.status === "PUBLISHED" ? (
            <Button asChild>
              <Link href={`/teacher/full-tests/${test.id}/assign`}>Assign</Link>
            </Button>
          ) : (
            <Button type="button" disabled title="Publish the exam before assigning.">
              Assign
            </Button>
          )}
        </div>
      </div>

      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {test.modules.map((module) => {
          const moduleKey = moduleKeyFromOrder(module.order);
          const pretest = module.questions.filter((item) => item.isPretest).length;
          return (
            <Card key={module.id} padding="md">
              <p className="text-sm font-semibold text-gray-900">{module.name}</p>
              <p className="mt-1 text-xs text-gray-500">
                {module.section} · skill {moduleKey} · {Math.round(module.timeLimit / 60)} min
              </p>
              <p className="mt-2 text-lg font-semibold text-gray-900">{module.questions.length} Q</p>
              <p className="text-[11px] text-gray-400">{pretest} pretest (no puntúan)</p>
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
                      <div className="mb-1 flex flex-wrap items-center gap-2">
                        <span className="text-xs font-medium text-gray-400">Q{index + 1}</span>
                        <Badge
                          variant={
                            item.question.difficulty === "EASY"
                              ? "easy"
                              : item.question.difficulty === "MEDIUM"
                                ? "medium"
                                : "hard"
                          }
                        >
                          {item.question.difficulty}
                        </Badge>
                        <Badge variant="default">{item.question.type}</Badge>
                        <Badge variant="default">{item.question.topic.name}</Badge>
                      </div>
                      <MathContent content={item.question.stem} className="line-clamp-2 text-sm text-gray-800" />
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

          <Card>
            <CardHeader>
              <h2 className="text-sm font-semibold text-gray-900">Recent Attempts</h2>
            </CardHeader>
            <CardBody className="space-y-2">
              {test.attempts.map((attempt) => (
                <div key={attempt.id} className="rounded-md border border-gray-100 px-3 py-2">
                  <p className="text-sm font-medium text-gray-900">{attempt.student.name}</p>
                  <p className="text-xs text-gray-500">
                    {attempt.status}
                    {attempt.totalScore ? ` · ${attempt.totalScore}` : ""}
                  </p>
                </div>
              ))}
              {test.attempts.length === 0 && <p className="text-sm text-gray-400">No attempts yet.</p>}
            </CardBody>
          </Card>
        </aside>
      </div>
    </div>
  );
}
