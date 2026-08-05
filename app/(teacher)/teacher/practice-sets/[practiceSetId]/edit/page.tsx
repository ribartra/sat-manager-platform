import prisma from "@/lib/prisma";
import { notFound } from "next/navigation";
import { PracticeSetEditor } from "../../practice-set-editor-client";
import { buildTaxonomyTree, taxonomyPathLabel } from "@/lib/taxonomy";

interface PageProps {
  params: Promise<{ practiceSetId: string }>;
}

export default async function EditPracticeSetPage({ params }: PageProps) {
  const { practiceSetId } = await params;
  const [practiceSet, topics, taxonomyNodes, questions] = await Promise.all([
    prisma.practiceSet.findUnique({
      where: { id: practiceSetId },
      include: { questions: { orderBy: { order: "asc" } } },
    }),
    prisma.topic.findMany({ include: { taxonomyNode: true, domain: { include: { section: true } } }, orderBy: { name: "asc" } }),
    prisma.taxonomyNode.findMany({ where: { active: true }, orderBy: [{ sortOrder: "asc" }, { label: "asc" }] }),
    prisma.question.findMany({ where: { status: { in: ["PUBLISHED", "DRAFT"] } }, orderBy: { createdAt: "desc" } }),
  ]);
  const { byId } = buildTaxonomyTree(taxonomyNodes);

  if (!practiceSet) notFound();

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="mb-6 text-xl font-semibold text-gray-900">Edit Practice Set</h1>
      <PracticeSetEditor
        initial={{
          id: practiceSet.id,
          name: practiceSet.name,
          topicId: practiceSet.topicId,
          difficulty: practiceSet.difficulty,
          status: practiceSet.status,
          explanationVisibility: practiceSet.explanationVisibility,
          questionIds: practiceSet.questions.map((q) => q.questionId),
        }}
        topics={topics.map((t) => ({
          id: t.id,
          name: t.name,
          domainName: t.domain.name,
          sectionLabel: t.domain.section.label,
          taxonomyLabel: taxonomyPathLabel(t.taxonomyNodeId, byId, `${t.domain.section.label} / ${t.domain.name} / ${t.name}`),
        }))}
        questions={questions.map((q) => ({ id: q.id, stem: q.stem, topicId: q.topicId, difficulty: q.difficulty, type: q.type, status: q.status }))}
      />
    </div>
  );
}
