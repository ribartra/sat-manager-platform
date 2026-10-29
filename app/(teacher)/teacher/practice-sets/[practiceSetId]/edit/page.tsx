import { Breadcrumbs } from "@/components/sat/breadcrumbs";
import { requireContentImporter } from "@/lib/rbac";
import { importArtifactsFor } from "@/lib/quick-import.server";
import { currentContentScope } from "@/lib/content-scope";
import { PageShell } from "@/components/sat";
import prisma from "@/lib/prisma";
import { notFound } from "next/navigation";
import { PracticeSetEditor } from "../../practice-set-editor-client";
import { academicTopicWhere, buildTaxonomyTree, taxonomyPathLabel } from "@/lib/taxonomy";
import { domainSectionLabel } from "@/lib/practice-area";
import { findQuestionsWithOptionMedia } from "@/lib/question-list-media-query";
import { listSources } from "@/lib/content-source";

interface PageProps {
  params: Promise<{ practiceSetId: string }>;
}

export default async function EditPracticeSetPage({ params }: PageProps) {
  const { practiceSetId } = await params;
  // The bank of the programs the teacher teaches (shared by the program's teachers).
  const scope = await currentContentScope();
  const [practiceSet, topics, taxonomyNodes, questions, sources] = await Promise.all([
    prisma.practiceSet.findFirst({
      where: { id: practiceSetId, ...scope },
      include: { questions: { orderBy: { order: "asc" } } },
    }),
    prisma.topic.findMany({ where: academicTopicWhere, include: { taxonomyNode: true, domain: { include: { section: true } } }, orderBy: { name: "asc" } }),
    prisma.taxonomyNode.findMany({ where: { active: true }, orderBy: [{ sortOrder: "asc" }, { label: "asc" }] }),
    findQuestionsWithOptionMedia({ status: { in: ["PUBLISHED", "DRAFT"] }, topic: academicTopicWhere, ...scope }),
    listSources(),
  ]);
  const { byId } = buildTaxonomyTree(taxonomyNodes);

  if (!practiceSet) notFound();

  return (
    <PageShell>
      <Breadcrumbs items={[{ label: "Home", href: "/teacher" }, { label: "Practice", href: "/teacher/practice-sets" }, { label: practiceSet.name }, { label: "Edit" }]} />
      <h1 className="mb-6 text-[26px] font-bold tracking-[-0.3px] text-gray-900">Edit Practice Set</h1>
      <PracticeSetEditor
        canImport={Boolean(await requireContentImporter())}
        importArtifacts={await importArtifactsFor(practiceSet.id)}
        initial={{
          id: practiceSet.id,
          name: practiceSet.name,
          topicId: practiceSet.topicId,
          difficulty: practiceSet.difficulty,
          sourceId: practiceSet.sourceId,
          status: practiceSet.status,
          explanationVisibility: practiceSet.explanationVisibility,
          questionIds: practiceSet.questions.map((q) => q.questionId),
        }}
        sources={sources.filter((s) => s.id === practiceSet.sourceId || (s.active && s.forPracticeSets))}
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
