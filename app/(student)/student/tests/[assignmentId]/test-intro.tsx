import Link from "next/link";
import { redirect } from "next/navigation";
import { PageShell } from "@/components/sat";
import { Breadcrumbs } from "@/components/sat/breadcrumbs";
import { ModuleTiles } from "@/components/sat/test-ui";
import { DueLine } from "@/components/sat/work-status";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import prisma from "@/lib/prisma";
import { getFeatureSetting } from "@/lib/app-settings";
import { fullTestModulesForAttempt } from "@/lib/full-test-snapshot";
import { buildTestAttemptView, moduleViewsForTest, type ModuleView } from "@/lib/test-view";

type IntroAssignment = {
  id: string;
  createdAt: Date;
  dueDate: Date | null;
  test: {
    id: string;
    name: string;
    modules: Parameters<typeof moduleViewsForTest>[0];
  };
};

type IntroAttempt = {
  id: string;
  testId: string;
  testSnapshot: string | null;
  status: string;
  moduleTimerState: string | null;
  answers: { questionId: string; answer: string | null; isCorrect: boolean | null }[];
};

const DIRECTIONS = {
  RW: "The questions in this section address reading and writing skills. Each question has one or more passages. Read each passage and question carefully, and choose the best answer.",
  MATH: "The questions in this section address math skills. For student-produced response questions, enter your answer in the box; fractions and decimals are accepted.",
} as const;

/** Module intro (mockup "test.html"): directions, the 4 module tiles and Start/Continue. */
export async function TestIntro({
  assignment,
  attempt,
  moduleIndex,
}: {
  assignment: IntroAssignment;
  attempt: IntroAttempt | null;
  moduleIndex: number | null;
}) {
  const modules: ModuleView[] = attempt
    ? buildTestAttemptView({
        modules: await fullTestModulesForAttempt(attempt),
        status: attempt.status,
        moduleTimerState: attempt.moduleTimerState,
        answers: attempt.answers,
      }).modules
    : moduleViewsForTest(assignment.test.modules);
  const fallback = modules.find((m) => m.state === "progress") ?? modules.find((m) => m.state === "todo") ?? modules[0];
  const current = (moduleIndex !== null ? modules[moduleIndex] : null) ?? fallback;
  if (!current) redirect("/student/tests");
  if (attempt && current.state === "done") redirect(`/student/tests/results/${attempt.id}#mod-${current.key}`);

  const base = `/student/tests/${assignment.id}`;
  const startHref = `${base}?module=${current.key}&start=1`;
  const [attemptCount, calculator] = await Promise.all([
    prisma.fullPracticeTestAttempt.count({ where: { assignmentId: assignment.id } }),
    getFeatureSetting("CALCULATOR_FULL_TESTS"),
  ]);
  // The open attempt is already counted; a first start is try 1.
  const tryNumber = attempt ? attemptCount : attemptCount + 1;
  const statusFor = (m: ModuleView) =>
    m.state === "done" ? (
      <span className="text-green-700">✓ Done · view results</span>
    ) : m.key === current.key ? (
      <span className="font-medium text-blue-700">Selected</span>
    ) : m.state === "progress" ? (
      <span className="text-amber-700">In progress</span>
    ) : (
      <>Not started · {m.questionCount} questions · {m.minutes} min</>
    );

  return (
    <PageShell>
      <Breadcrumbs
        items={[
          { label: "Home", href: "/student" },
          { label: "Tests", href: "/student/tests" },
          { label: assignment.test.name, href: `/student/tests#test-${assignment.id}` },
          { label: current.short },
        ]}
      />
      <Card padding="lg" className="mx-auto max-w-3xl">
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge className="bg-gray-900 text-white">{assignment.test.name}{tryNumber > 1 ? ` · try ${tryNumber}` : ""}</Badge>
          <Badge>{current.tier}</Badge>
          {current.state === "progress" ? <Badge variant="warning">In progress</Badge> : null}
        </div>
        <h1 className="mt-3 text-2xl font-semibold text-gray-900">{current.name}</h1>
        <p className="mt-1 text-sm text-gray-500">
          {current.questionCount} questions · {current.minutes} minutes · the timer keeps your remaining time if you leave
        </p>
        <DueLine assignedAt={assignment.createdAt} dueDate={assignment.dueDate} className="mt-1" />

        <div className="mt-5 rounded-lg border border-gray-200 bg-gray-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Directions</p>
          <p className="mt-1 text-sm text-gray-700">
            {DIRECTIONS[current.section]}
            {current.section === "MATH" && calculator ? " You may use a calculator." : ""}
          </p>
        </div>

        <h2 className="mt-6 text-sm font-semibold text-gray-900">Modules in this test</h2>
        <p className="mb-2 text-xs text-gray-500">You can take the modules in any order. A submitted module can&apos;t be changed.</p>
        <ModuleTiles
          detail
          modules={modules}
          selectedKey={current.key}
          statusFor={statusFor}
          hrefFor={(m) => (m.state === "done" && attempt ? `/student/tests/results/${attempt.id}#mod-${m.key}` : `${base}?module=${m.key}`)}
        />

        <div className="mt-6 flex flex-wrap gap-2">
          <Button asChild size="lg">
            <Link href={startHref}>{current.state === "progress" ? "Continue module" : "Start module"} ›</Link>
          </Button>
          <Button asChild variant="secondary" size="lg">
            <Link href={`/student/tests#test-${assignment.id}`}>Back</Link>
          </Button>
        </div>
      </Card>
    </PageShell>
  );
}
