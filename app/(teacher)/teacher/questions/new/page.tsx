import prisma from "@/lib/prisma";
import { QuestionEditor } from "../question-editor-client";

export default async function NewQuestionPage() {
  const topics = await prisma.topic.findMany({
    include: { domain: { include: { section: true } }, subskills: true },
    orderBy: { name: "asc" },
  });

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-xl font-semibold text-gray-900 mb-6">New Question</h1>
      <QuestionEditor
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
