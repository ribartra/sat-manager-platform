import Link from "next/link";
import { notFound } from "next/navigation";
import { PageContent, PageHeader, PageShell, SectionHeader } from "@/components/sat";
import { Breadcrumbs } from "@/components/sat/breadcrumbs";
import { HEADER_ACTION_CLASS, HeaderActions } from "@/components/sat/header-actions";
import { QuestionListItem, toQuestionListMedia } from "@/components/question-list-item";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { currentContentScope } from "@/lib/content-scope";
import { studentAccessWhereFor } from "@/lib/program-scope";
import { requireContentImporter } from "@/lib/rbac";
import { contentMediaLinks } from "@/lib/import-media.server";
import { assignHref } from "@/lib/assign-params";
import { assignmentCounts } from "@/lib/assignment-counts";
import { academicTopicWhere, buildTaxonomyTree, taxonomyPathLabel } from "@/lib/taxonomy";
import { domainSectionLabel, practiceAreaLabel, resolvePracticeArea, tabFromPracticeArea } from "@/lib/practice-area";
import { findQuestionsWithOptionMedia } from "@/lib/question-list-media-query";
import { listSources } from "@/lib/content-source";
import { difficultyBadgeVariant, difficultyLabel, practiceSetStatusBadgeVariant, practiceSetStatusLabel, questionTypeLabel } from "@/lib/domain-meta";
import { resolveQuestionType } from "@/lib/question-type";
import { PracticeSetEditor } from "../practice-set-editor-client";
import { PracticeSetOptionsMenu } from "../practice-set-options-menu-client";

interface PageProps {
  params: Promise<{ practiceSetId: string }>;
  /** `?edit`: the same page in edit mode (the summaries give way to the editor). */
  searchParams: Promise<{ edit?: string }>;
}

/**
 * One practice set's page (like a Test's): source, skill and level in the header; how it is going
 * with the teacher's students; its questions. With `?edit`, the same page and header with the editor
 * instead of the summaries.
 */
export default async function PracticeSetPage({ params, searchParams }: PageProps) {
  const { practiceSetId } = await params;
  const editing = (await searchParams).edit !== undefined;
  const session = await auth();
  const now = new Date();
  // The bank of the programs the teacher teaches (shared by the program's teachers).
  const scope = await currentContentScope();
  const practiceSet = await prisma.practiceSet.findFirst({
    where: { id: practiceSetId, ...scope },
    include: {
      source: { select: { name: true } },
      topic: { select: { id: true, name: true, domain: { select: { name: true, practiceArea: true } } } },
      questions: {
        orderBy: { order: "asc" },
        include: { question: { include: { topic: { include: { domain: { include: { section: true } } } }, options: { select: { text: true, imageUrl: true } } } } },
      },
      // How it is going with the teacher's students.
      assignments: {
        where: { student: session ? studentAccessWhereFor(session.user, now) : { id: "__no_session__" } },
        select: { status: true, dueDate: true, attempts: { where: { status: "IN_PROGRESS" }, select: { id: true } } },
      },
      _count: { select: { assignments: true, groupAssignments: true } },
    },
  });
  if (!practiceSet) notFound();
  const attempts = await prisma.attempt.count({ where: { practiceSetId } });
  const area = resolvePracticeArea(practiceSet.topic.domain);
  const tab = tabFromPracticeArea(area);
  const assignArea = tab === "reading" || tab === "writing" ? tab : "math";
  const sourceName = practiceSet.source?.name ?? "College Board";
  const counts = assignmentCounts(practiceSet.assignments, now);
  const catalogueHref = `/teacher/practice-sets?area=${assignArea}&topic=${practiceSet.topicId}#skill-${practiceSet.topicId}`;
  const levelTitle = `${practiceSet.topic.name} (${difficultyLabel(practiceSet.difficulty)})`;

  const header = (
    <>
      <Breadcrumbs
        items={[
          { label: "Home", href: "/teacher" },
          { label: "Practice", href: `/teacher/practice-sets?area=${assignArea}` },
          ...(area ? [{ label: practiceAreaLabel(area), href: `/teacher/practice-sets?area=${assignArea}` }] : []),
          { label: sourceName, href: catalogueHref },
          editing ? { label: levelTitle, href: `/teacher/practice-sets/${practiceSet.id}` } : { label: levelTitle },
          ...(editing ? [{ label: "Edit" }] : []),
        ]}
      />
      <PageHeader
        title={practiceSet.name}
        description={
          <>
            <b className="font-medium text-gray-700">Source: {sourceName}</b> · {practiceSet.topic.domain.name} · {practiceSet.topic.name} · {difficultyLabel(practiceSet.difficulty)} ·{" "}
            {practiceSet.questions.length} questions · {practiceSetStatusLabel(practiceSet.status)}
            {editing ? " · Editing: change the details and the questions, then save." : ""}
          </>
        }
        actions={
          editing ? (
            <HeaderActions>
              <Link href={`/teacher/practice-sets/${practiceSet.id}`} className={HEADER_ACTION_CLASS}>Back to the set</Link>
            </HeaderActions>
          ) : (
            // One row: main button + the options drop-down (same as a Test's page).
            <HeaderActions>
              {practiceSet.status !== "PUBLISHED" ? <Badge variant={practiceSetStatusBadgeVariant(practiceSet.status)}>{practiceSetStatusLabel(practiceSet.status)}</Badge> : null}
              <PracticeSetOptionsMenu
                set={{ id: practiceSet.id, name: practiceSet.name, status: practiceSet.status }}
                assignHref={assignHref({ area: assignArea, set: [practiceSet.id], topic: practiceSet.topicId })}
                // Same rule as DELETE /api/practice-sets/[id]: no assignments, group assignments or attempts.
                canDelete={practiceSet._count.assignments + practiceSet._count.groupAssignments + attempts === 0}
                afterDeleteHref={catalogueHref}
              />
              {practiceSet.status === "PUBLISHED" ? (
                <Button asChild size="sm"><Link href={assignHref({ area: assignArea, set: [practiceSet.id], topic: practiceSet.topicId })}>Assign this set</Link></Button>
              ) : null}
            </HeaderActions>
          )
        }
      />
    </>
  );

  if (editing) {
    const [topics, taxonomyNodes, questions, sources] = await Promise.all([
      prisma.topic.findMany({ where: academicTopicWhere, include: { taxonomyNode: true, domain: { include: { section: true } } }, orderBy: { name: "asc" } }),
      prisma.taxonomyNode.findMany({ where: { active: true }, orderBy: [{ sortOrder: "asc" }, { label: "asc" }] }),
      findQuestionsWithOptionMedia({ status: { in: ["PUBLISHED", "DRAFT"] }, topic: academicTopicWhere, ...scope }),
      listSources(),
    ]);
    const { byId } = buildTaxonomyTree(taxonomyNodes);
    return (
      <PageShell>
        {header}
        <PracticeSetEditor
          mediaLinks={(await requireContentImporter()) ? await contentMediaLinks("practice-sets", practiceSet.id, practiceSet.questions.map((item) => item.questionId)) : null}
          initial={{
            id: practiceSet.id,
            updatedAt: practiceSet.updatedAt.toISOString(),
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

  return (
    <PageShell>
      {header}
      <PageContent>
        <section>
          <SectionHeader title="Students" description="How this set is going with your students." />
          <div className="flex flex-wrap gap-x-5 gap-y-1 rounded-[var(--sat-radius)] border border-[var(--sat-border)] bg-white px-4 py-3 text-sm">
            <span className="text-gray-700">Assigned <b>{counts.assigned}</b></span>
            <span className="text-green-700">Completed <b>{counts.completed}</b></span>
            <span className="text-amber-700">In progress <b>{counts.inProgress}</b></span>
            <span className="text-red-600">Overdue <b>{counts.overdue}</b></span>
          </div>
        </section>
        <Card>
          <CardHeader>
            <h2 className="text-sm font-semibold text-gray-900">Questions</h2>
            <p className="text-xs text-gray-500">
              {practiceSet.questions.length} questions · {difficultyLabel(practiceSet.difficulty)}
            </p>
          </CardHeader>
          <CardBody className="divide-y divide-gray-100 p-0">
            {practiceSet.questions.map((item, index) => (
              <div key={item.questionId} className="px-5 py-3">
                <QuestionListItem
                  question={toQuestionListMedia(item.question)}
                  href={`/teacher/questions/${item.question.id}/edit`}
                  indexLabel={<span className="text-xs font-medium text-gray-400">Q{index + 1}</span>}
                  meta={
                    <>
                      <Badge variant={difficultyBadgeVariant(item.question.difficulty)}>{difficultyLabel(item.question.difficulty)}</Badge>
                      <Badge variant="default">{questionTypeLabel(resolveQuestionType(item.question.type, item.question.options), true)}</Badge>
                    </>
                  }
                />
              </div>
            ))}
            {practiceSet.questions.length === 0 ? <div className="px-5 py-8 text-center text-sm text-gray-400">No questions in this set.</div> : null}
          </CardBody>
        </Card>
      </PageContent>
    </PageShell>
  );
}
