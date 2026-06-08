import prisma from "@/lib/prisma";
import { PracticeSetEditor } from "../practice-set-editor-client";

interface PageProps {
  searchParams: Promise<{ topicId?: string }>;
}

export default async function NewPracticeSetPage({ searchParams }: PageProps) {
  const { topicId } = await searchParams;
  const [topics, questions] = await Promise.all([
    prisma.topic.findMany({ include: { domain: { include: { section: true } } }, orderBy: { name: "asc" } }),
    prisma.question.findMany({ where: { status: "PUBLISHED" }, orderBy: { createdAt: "desc" } }),
  ]);

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="mb-6 text-xl font-semibold text-gray-900">New Practice Set</h1>
      <PracticeSetEditor
        initial={{ topicId }}
        topics={topics.map((t) => ({ id: t.id, name: t.name, domainName: t.domain.name, sectionLabel: t.domain.section.label }))}
        questions={questions.map((q) => ({ id: q.id, stem: q.stem, topicId: q.topicId, difficulty: q.difficulty, type: q.type, status: q.status }))}
      />
    </div>
  );
}
