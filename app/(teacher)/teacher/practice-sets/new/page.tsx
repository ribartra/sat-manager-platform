import prisma from "@/lib/prisma";
import { PracticeSetEditor } from "../practice-set-editor-client";
import { academicTopicWhere, buildTaxonomyTree, taxonomyPathLabel } from "@/lib/taxonomy";

interface PageProps {
  searchParams: Promise<{ topicId?: string }>;
}

export default async function NewPracticeSetPage({ searchParams }: PageProps) {
  const { topicId } = await searchParams;
  const [topics, taxonomyNodes, questions] = await Promise.all([
    prisma.topic.findMany({ where: academicTopicWhere, include: { taxonomyNode: true, domain: { include: { section: true } } }, orderBy: { name: "asc" } }),
    prisma.taxonomyNode.findMany({ where: { active: true }, orderBy: [{ sortOrder: "asc" }, { label: "asc" }] }),
    prisma.question.findMany({
      where: { status: "PUBLISHED", topic: academicTopicWhere },
      include: { options: { select: { imageUrl: true }, where: { imageUrl: { not: null } } } },
      orderBy: { createdAt: "desc" },
    }),
  ]);
  const { byId } = buildTaxonomyTree(taxonomyNodes);

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="mb-6 text-xl font-semibold text-gray-900">New Practice Set</h1>
      <PracticeSetEditor
        initial={{ topicId }}
        topics={topics.map((t) => ({
          id: t.id,
          name: t.name,
          domainName: t.domain.name,
          sectionLabel: t.domain.section.label,
          taxonomyLabel: taxonomyPathLabel(t.taxonomyNodeId, byId, `${t.domain.section.label} / ${t.domain.name} / ${t.name}`),
        }))}
        questions={questions.map((q) => ({
          id: q.id,
          stem: q.stem,
          topicId: q.topicId,
          difficulty: q.difficulty,
          type: q.type,
          status: q.status,
          imageUrl: q.imageUrl,
          stimulus: q.stimulus,
          optionImageUrls: q.options.map((o) => o.imageUrl).filter((u): u is string => Boolean(u)),
        }))}
      />
    </div>
  );
}
