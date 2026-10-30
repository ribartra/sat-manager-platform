import { Breadcrumbs } from "@/components/sat/breadcrumbs";
import { PageHeader, PageShell } from "@/components/sat";
import prisma from "@/lib/prisma";
import { QuestionEditor } from "../question-editor-client";
import { getFeatureSetting } from "@/lib/app-settings";
import { loadCandidateQuestionDraft } from "@/lib/ingest-promotion";
import { academicTopicWhere, buildTaxonomyTree, taxonomyPathLabel } from "@/lib/taxonomy";
import { domainSectionLabel } from "@/lib/practice-area";
import { questionCrumbs } from "@/lib/question-crumbs";

interface PageProps {
  searchParams: Promise<{ ingestCandidateId?: string; area?: string }>;
}

export default async function NewQuestionPage({ searchParams }: PageProps) {
  const { ingestCandidateId, area: areaParam } = await searchParams;
  // Opened from the Question Bank on an area: the breadcrumb and Save go back there.
  const crumbs = questionCrumbs(areaParam === "reading" || areaParam === "writing" ? areaParam : "math");
  const [topics, taxonomyNodes, ingestDraft, showGraphOption] = await Promise.all([
    prisma.topic.findMany({
      where: academicTopicWhere,
      include: { taxonomyNode: true, domain: { include: { section: true } }, subskills: true },
      orderBy: { name: "asc" },
    }),
    prisma.taxonomyNode.findMany({ where: { active: true }, orderBy: [{ sortOrder: "asc" }, { label: "asc" }] }),
    ingestCandidateId ? loadCandidateQuestionDraft(ingestCandidateId) : null,
    getFeatureSetting("QUESTION_GRAPH_VISUALIZATION"),
  ]);
  const { byId } = buildTaxonomyTree(taxonomyNodes);

  return (
    <PageShell>
      <Breadcrumbs items={[...crumbs.items, { label: "New question" }]} />
      <PageHeader title="New Question" />
      <QuestionEditor
        returnHref={crumbs.questionsHref}
        showGraphOption={showGraphOption}
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
          sectionLabel: domainSectionLabel({ practiceArea: t.domain.practiceArea }),
          domainName: t.domain.name,
          taxonomyLabel: taxonomyPathLabel(t.taxonomyNodeId, byId, `${t.domain.section.label} / ${t.domain.name} / ${t.name}`),
          subskills: t.subskills,
        }))}
      />
    </PageShell>
  );
}
