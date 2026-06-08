import prisma from "@/lib/prisma";
import { notFound } from "next/navigation";
import { QuestionEditor } from "../../question-editor-client";

interface PageProps {
  params: Promise<{ questionId: string }>;
}

export default async function EditQuestionPage({ params }: PageProps) {
  const { questionId } = await params;

  const [question, topics] = await Promise.all([
    prisma.question.findUnique({
      where: { id: questionId },
      include: { options: { orderBy: { label: "asc" } } },
    }),
    prisma.topic.findMany({
      include: { domain: { include: { section: true } }, subskills: true },
      orderBy: { name: "asc" },
    }),
  ]);

  if (!question) notFound();

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="mb-6 text-xl font-semibold text-gray-900">Edit Question</h1>
      <QuestionEditor
        initial={{
          id: question.id,
          topicId: question.topicId,
          subskillId: question.subskillId,
          difficulty: question.difficulty,
          type: question.type,
          stem: question.stem,
          stimulus: question.stimulus ?? "",
          explanation: question.explanation ?? "",
          correctAnswer: question.correctAnswer,
          status: question.status,
          options: question.options.map((o) => ({ label: o.label, text: o.text })),
        }}
        topics={topics.map((t) => ({
          id: t.id,
          name: t.name,
          sectionLabel: t.domain.section.label,
          domainName: t.domain.name,
          subskills: t.subskills,
        }))}
      />
    </div>
  );
}
