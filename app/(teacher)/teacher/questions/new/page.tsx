import prisma from "@/lib/prisma";
import { QuestionEditor } from "../question-editor-client";
import { loadCandidateQuestionDraft } from "@/lib/ingest-promotion";
import { academicTopicWhere, buildTaxonomyTree, taxonomyPathLabel } from "@/lib/taxonomy";

interface PageProps {
  searchParams: Promise<{ ingestCandidateId?: string }>;
}

export default async function NewQuestionPage({ searchParams }: PageProps) {
  const { ingestCandidateId } = await searchParams;
  const [topics, taxonomyNodes, ingestDraft] = await Promise.all([
    prisma.topic.findMany({
      where: academicTopicWhere,
      include: { taxonomyNode: true, domain: { include: { section: true } }, subskills: true },
      orderBy: { name: "asc" },
    }),
    prisma.taxonomyNode.findMany({ where: { active: true }, orderBy: [{ sortOrder: "asc" }, { label: "asc" }] }),
    ingestCandidateId ? loadCandidateQuestionDraft(ingestCandidateId) : null,
  ]);
  const { byId } = buildTaxonomyTree(taxonomyNodes);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-xl font-semibold text-gray-900 mb-6">New Question</h1>
      <QuestionEditor
        initial={ingestDraft?.initial}
        sourceContext={
          ingestDraft
            ? {
                ingestCandidateId: ingestDraft.candidate.id,
                batchId: ingestDraft.candidate.batchId,
                sourceFileId: ingestDraft.candidate.sourceFileId,
              }
            : undefined
        }
        topics={topics.map((t) => ({
          id: t.id,
          name: t.name,
          sectionLabel: t.domain.section.label,
          domainName: t.domain.name,
          taxonomyLabel: taxonomyPathLabel(t.taxonomyNodeId, byId, `${t.domain.section.label} / ${t.domain.name} / ${t.name}`),
          subskills: t.subskills,
        }))}
      />
    </div>
  );
}
