import { Breadcrumbs } from "@/components/sat/breadcrumbs";
import { currentContentScope } from "@/lib/content-scope";
import { PageShell } from "@/components/sat";
import prisma from "@/lib/prisma";
import { PracticeSetEditor } from "../practice-set-editor-client";
import { academicTopicWhere, buildTaxonomyTree, taxonomyPathLabel } from "@/lib/taxonomy";
import { domainSectionLabel } from "@/lib/practice-area";
import { findQuestionsWithOptionMedia } from "@/lib/question-list-media-query";

interface PageProps {
  searchParams: Promise<{ topicId?: string }>;
}

export default async function NewPracticeSetPage({ searchParams }: PageProps) {
  const { topicId } = await searchParams;
  const [topics, taxonomyNodes, questions] = await Promise.all([
    prisma.topic.findMany({ where: academicTopicWhere, include: { taxonomyNode: true, domain: { include: { section: true } } }, orderBy: { name: "asc" } }),
    prisma.taxonomyNode.findMany({ where: { active: true }, orderBy: [{ sortOrder: "asc" }, { label: "asc" }] }),
    findQuestionsWithOptionMedia({ status: "PUBLISHED", topic: academicTopicWhere, ...(await currentContentScope()) }),
  ]);
  const { byId } = buildTaxonomyTree(taxonomyNodes);

  return (
    <PageShell>
      <Breadcrumbs items={[{ label: "Home", href: "/teacher" }, { label: "Practice", href: "/teacher/practice-sets" }, { label: "New practice set" }]} />
      <h1 className="mb-6 text-[26px] font-bold tracking-[-0.3px] text-gray-900">New Practice Set</h1>
      <PracticeSetEditor
        initial={{ topicId }}
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
