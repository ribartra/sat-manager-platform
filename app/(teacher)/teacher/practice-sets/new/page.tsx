import { Breadcrumbs } from "@/components/sat/breadcrumbs";
import { requireContentImporter } from "@/lib/rbac";
import { currentContentScope } from "@/lib/content-scope";
import { PageShell } from "@/components/sat";
import prisma from "@/lib/prisma";
import { PracticeSetEditor } from "../practice-set-editor-client";
import { academicTopicWhere, buildTaxonomyTree, taxonomyPathLabel } from "@/lib/taxonomy";
import { domainSectionLabel } from "@/lib/practice-area";
import { findQuestionsWithOptionMedia } from "@/lib/question-list-media-query";
import { DEFAULT_PRACTICE_SOURCE_ID, listSources } from "@/lib/content-source";

interface PageProps {
  searchParams: Promise<{ topicId?: string; difficulty?: string; sourceId?: string }>;
}

export default async function NewPracticeSetPage({ searchParams }: PageProps) {
  const { topicId, difficulty, sourceId } = await searchParams;
  const [topics, taxonomyNodes, questions, sources] = await Promise.all([
    prisma.topic.findMany({ where: academicTopicWhere, include: { taxonomyNode: true, domain: { include: { section: true } } }, orderBy: { name: "asc" } }),
    prisma.taxonomyNode.findMany({ where: { active: true }, orderBy: [{ sortOrder: "asc" }, { label: "asc" }] }),
    findQuestionsWithOptionMedia({ status: "PUBLISHED", topic: academicTopicWhere, ...(await currentContentScope()) }),
    listSources({ activeOnly: true, kind: "practice" }),
  ]);
  const { byId } = buildTaxonomyTree(taxonomyNodes);

  return (
    <PageShell>
      <Breadcrumbs items={[{ label: "Home", href: "/teacher" }, { label: "Practice", href: "/teacher/practice-sets" }, { label: "New practice set" }]} />
      <h1 className="mb-6 text-[26px] font-bold tracking-[-0.3px] text-gray-900">New Practice Set</h1>
      <PracticeSetEditor
        canImport={Boolean(await requireContentImporter())}
        initial={{
          topicId,
          difficulty: difficulty && ["EASY", "MEDIUM", "HARD"].includes(difficulty) ? difficulty : undefined,
          // From a Source × level cell of Practice › By skill; otherwise College Board.
          sourceId: sources.find((s) => s.id === sourceId)?.id ?? sources.find((s) => s.id === DEFAULT_PRACTICE_SOURCE_ID)?.id,
        }}
        sources={sources}
        topics={topics.map((t) => ({
          id: t.id,
          name: t.name,
          domainName: t.domain.name,
          sectionLabel: domainSectionLabel({ practiceArea: t.domain.practiceArea }),
          taxonomyLabel: taxonomyPathLabel(t.taxonomyNodeId, byId, `${t.domain.section.label} / ${t.domain.name} / ${t.name}`),
        }))}
        questions={questions}
      />
    </PageShell>
  );
}
