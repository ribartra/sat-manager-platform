import { Breadcrumbs } from "@/components/sat/breadcrumbs";
import { requireContentImporter } from "@/lib/rbac";
import { contentMediaLinks } from "@/lib/import-media.server";
import { currentContentScope } from "@/lib/content-scope";
import { PageHeader, PageShell } from "@/components/sat";
import { Badge } from "@/components/ui/badge";
import { PracticeSetActions } from "../../practice-set-actions-client";
import { assignHref } from "@/lib/assign-params";
import { practiceSetStatusBadgeVariant, practiceSetStatusLabel } from "@/lib/domain-meta";
import prisma from "@/lib/prisma";
import { notFound } from "next/navigation";
import { PracticeSetEditor } from "../../practice-set-editor-client";
import { academicTopicWhere, buildTaxonomyTree, taxonomyPathLabel } from "@/lib/taxonomy";
import { domainSectionLabel, resolvePracticeArea, tabFromPracticeArea } from "@/lib/practice-area";
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
      include: {
        questions: { orderBy: { order: "asc" } },
        topic: { select: { domain: { select: { practiceArea: true } } } },
        _count: { select: { assignments: true, groupAssignments: true } },
      },
    }),
    prisma.topic.findMany({ where: academicTopicWhere, include: { taxonomyNode: true, domain: { include: { section: true } } }, orderBy: { name: "asc" } }),
    prisma.taxonomyNode.findMany({ where: { active: true }, orderBy: [{ sortOrder: "asc" }, { label: "asc" }] }),
    findQuestionsWithOptionMedia({ status: { in: ["PUBLISHED", "DRAFT"] }, topic: academicTopicWhere, ...scope }),
    listSources(),
  ]);
  const { byId } = buildTaxonomyTree(taxonomyNodes);

  if (!practiceSet) notFound();
  const attempts = await prisma.attempt.count({ where: { practiceSetId } });
  const tab = tabFromPracticeArea(resolvePracticeArea(practiceSet.topic.domain));
  const assignArea = tab === "reading" || tab === "writing" ? tab : "math";

  return (
    <PageShell>
      <Breadcrumbs items={[{ label: "Home", href: "/teacher" }, { label: "Practice", href: `/teacher/practice-sets?topic=${practiceSet.topicId}#skill-${practiceSet.topicId}` }, { label: practiceSet.name }, { label: "Edit" }]} />
      <PageHeader
        title="Edit Practice Set"
        description={
          <span className="inline-flex items-center gap-2">
            {practiceSet.name} <Badge variant={practiceSetStatusBadgeVariant(practiceSet.status)}>{practiceSetStatusLabel(practiceSet.status)}</Badge>
          </span>
        }
        actions={
          <PracticeSetActions
            set={{ id: practiceSet.id, name: practiceSet.name, status: practiceSet.status }}
            assignHref={assignHref({ area: assignArea, set: [practiceSet.id], topic: practiceSet.topicId })}
            // Same rule as DELETE /api/practice-sets/[id]: no assignments, group assignments or attempts.
            canDelete={practiceSet._count.assignments + practiceSet._count.groupAssignments + attempts === 0}
            backHref={`/teacher/practice-sets?topic=${practiceSet.topicId}#skill-${practiceSet.topicId}`}
          />
        }
      />
      <PracticeSetEditor
        mediaLinks={(await requireContentImporter()) ? await contentMediaLinks("practice-sets", practiceSet.id, practiceSet.questions.map((item) => item.questionId)) : null}
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
