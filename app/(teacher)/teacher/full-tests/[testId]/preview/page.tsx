import { notFound } from "next/navigation";
import prisma from "@/lib/prisma";
import { requireTeacherOrAdmin } from "@/lib/rbac";
import { FullTestPlayer } from "@/app/(student)/student/full-tests/[assignmentId]/player-client";
import { getPublicCalculatorConfig } from "@/lib/calculator-config";
import { getFeatureSetting } from "@/lib/app-settings";
import { extractQuestionGraphArtifacts } from "@/lib/question-graph";

interface PageProps {
  params: Promise<{ testId: string }>;
}

export default async function FullTestPreviewPage({ params }: PageProps) {
  const session = await requireTeacherOrAdmin();
  if (!session) notFound();
  const { testId } = await params;

  const test = await prisma.fullPracticeTest.findUnique({
    where: { id: testId },
    include: {
      modules: {
        include: {
          questions: {
            include: { question: { include: { options: { orderBy: { label: "asc" } } } } },
            orderBy: { order: "asc" },
          },
        },
        orderBy: { order: "asc" },
      },
    },
  });
  if (!test) notFound();

  const showCalculator = await getFeatureSetting("CALCULATOR_FULL_TESTS");

  return (
    <FullTestPlayer
      attemptId="preview"
      assignmentId=""
      testName={test.name}
      breakMinutes={test.breakMinutes}
      modules={test.modules.map((module) => ({
        id: module.id,
        name: module.name,
        section: module.section,
        timeLimit: module.timeLimit,
        questions: module.questions.map((item) => ({
          id: item.question.id,
          stem: item.question.stem,
          stimulus: item.question.stimulus,
          type: item.question.type,
          imageUrl: item.question.imageUrl,
          options: item.question.options,
          graphArtifacts: item.question.supportsGraph ? extractQuestionGraphArtifacts(item.question) : [],
        })),
      }))}
      savedAnswers={{}}
      savedTimeSpent={{}}
      savedModule={0}
      savedQuestion={0}
      savedExpiredEvents={0}
      savedExtraTimeUsed={0}
      savedProgressState={null}
      calculatorConfig={getPublicCalculatorConfig()}
      showCalculator={showCalculator}
      previewMode
      exitHref={`/teacher/full-tests/${testId}`}
    />
  );
}
