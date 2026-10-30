import { Breadcrumbs } from "@/components/sat/breadcrumbs";
import { currentContentScope } from "@/lib/content-scope";
import { PageHeader, PageShell, PracticeAreaTabs } from "@/components/sat";
import { HEADER_ACTION_CLASS, HeaderActions } from "@/components/sat/header-actions";
import { PAGE_SIZE, Pagination, pageFromParam } from "@/components/sat/pagination";
import prisma from "@/lib/prisma";
import Link from "next/link";
import { ArrowLeft, Plus } from "lucide-react";
import { academicTopicWhere } from "@/lib/taxonomy";
import {
  activeAreaTab,
  domainSectionLabel,
  practiceAreaFromTab,
  practiceAreaLabel,
  practiceSectionLabel,
  resolvePracticeArea,
} from "@/lib/practice-area";
import { QuestionsFilter, QuestionsTestFilter } from "./questions-filter-client";
import { QUESTION_STATUS_DEFAULT } from "@/lib/domain-meta";
import { questionCrumbs } from "@/lib/question-crumbs";
import { loadOptionImageUrlsByQuestionId } from "@/lib/question-list-media-query";
import { QuestionsTable, type QuestionBankRow } from "./questions-table-client";
import { resolveQuestionType } from "@/lib/question-type";

interface SearchParams { area?: string; section?: string; domain?: string; topic?: string; test?: string; module?: string; difficulty?: string; status?: string; page?: string }

const TOPIC_IN_CHUNK = 400;

/** The 4 modules of every Test, by their order (0–3). */
const TEST_MODULES = [
  { value: "0", label: "R&W 1" },
  { value: "1", label: "R&W 2" },
  { value: "2", label: "Math 1" },
  { value: "3", label: "Math 2" },
];

/**
 * Question Bank: Math, Reading and Writing (practice questions, by Domain / Skill) and Tests (the
 * questions of the Tests, by Test / module). Opened from Practice or Tests ("Questions →") on the same
 * area, with the way back to it. Published by default; filters apply on change; 25 per page.
 */
export default async function QuestionBankPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const filters = await searchParams;
  const area = activeAreaTab(filters.area ?? filters.section, "math");
  const isTests = area === "tests";
  const practiceArea = practiceAreaFromTab(area);
  const sectionLabel = practiceSectionLabel(practiceArea);
  const scope = await currentContentScope();

  const topics = isTests
    ? []
    : await prisma.topic.findMany({
        where: academicTopicWhere,
        include: { domain: { include: { section: true } } },
        orderBy: { name: "asc" },
      });
  const visibleTopics = topics.filter((t) => resolvePracticeArea({ practiceArea: t.domain.practiceArea }) === practiceArea);
  // Domain (`domain` = domain id): the skill's domain, or a domain chosen with no skill.
  const topicDomain = visibleTopics.find((t) => t.id === filters.topic)?.domainId;
  const selectedDomainId = topicDomain ?? (filters.domain && visibleTopics.some((t) => t.domainId === filters.domain) ? filters.domain : undefined);
  const domainTopics = selectedDomainId ? visibleTopics.filter((t) => t.domainId === selectedDomainId) : visibleTopics;
  const visibleTopicIds = [...new Set(domainTopics.map((topic) => topic.id))];
  const selectedTopicId = filters.topic && visibleTopicIds.includes(filters.topic) ? filters.topic : undefined;
  const topicFilter = selectedTopicId
    ? selectedTopicId
    : visibleTopicIds.length <= TOPIC_IN_CHUNK
      ? { in: visibleTopicIds }
      : { in: visibleTopicIds.slice(0, TOPIC_IN_CHUNK) };

  // Tests tab: the Tests of the teacher's programs, one module or all.
  const tests = isTests
    ? await prisma.fullPracticeTest.findMany({
        where: scope,
        select: { id: true, name: true, number: true, source: { select: { name: true, sortOrder: true } } },
      })
    : [];
  tests.sort((a, b) => (a.number ?? 999) - (b.number ?? 999) || (a.source?.sortOrder ?? 999) - (b.source?.sortOrder ?? 999));
  const selectedTestId = isTests && tests.some((t) => t.id === filters.test) ? filters.test : undefined;
  const selectedModule = isTests && TEST_MODULES.some((m) => m.value === filters.module) ? filters.module : undefined;

  // Consolidation table: no free-text search, 25 per page.
  const pageSize = PAGE_SIZE;
  const statusParam = filters.status || QUESTION_STATUS_DEFAULT;
  const statusFilter = statusParam === "all" ? undefined : statusParam;
  const questionWhere = {
    // The bank of the programs the teacher teaches (shared by the program's teachers).
    ...scope,
    ...(isTests
      ? {
          fullTestItems: {
            some: {
              module: {
                ...(selectedModule ? { order: Number(selectedModule) } : {}),
                test: selectedTestId ? { id: selectedTestId } : { id: { in: tests.map((t) => t.id) } },
              },
            },
          },
        }
      : { topicId: topicFilter }),
    difficulty: (filters.difficulty as string | undefined) || undefined,
    // Published by default; `status=all` shows every status.
    status: statusFilter,
  };
  const total = await prisma.question.count({ where: questionWhere });
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(pageFromParam(filters.page), pageCount);
  const questions = await prisma.question.findMany({
    where: questionWhere,
    include: {
      topic: { include: { domain: { include: { section: true } } } },
      options: { select: { text: true, imageUrl: true } },
      setItems: { select: { practiceSetId: true } },
      fullTestItems: { select: { moduleId: true, module: { select: { order: true, testId: true, test: { select: { name: true, source: { select: { name: true } } } } } } } },
      _count: { select: { answers: true } },
    },
    orderBy: { createdAt: "desc" },
    skip: (page - 1) * pageSize,
    take: pageSize,
  });
  const optionImages = await loadOptionImageUrlsByQuestionId(questions.map((q) => q.id));

  // Back to where the Question Bank was opened from: Practice (same area) or Tests.
  const back = isTests
    ? { label: "Tests", href: "/teacher/tests" }
    : { label: `Practice · ${practiceAreaLabel(practiceArea)}`, href: `/teacher/practice-sets?area=${area}` };
  const testLabel = (t: { name: string; source: { name: string } | null }) => `${t.name} · ${t.source?.name ?? "No source"}`;

  return (
    <PageShell>
      <Breadcrumbs items={[...questionCrumbs(area).items.slice(0, 2), { label: "Questions" }]} />
      <PageHeader
        title="Question Bank"
        description={isTests ? "The questions of the Tests, by Test and module." : "Practice questions by domain and skill."}
        actions={
          <HeaderActions>
            <Link href={back.href} className={HEADER_ACTION_CLASS}>
              <ArrowLeft size={14} aria-hidden /> Back to {back.label}
            </Link>
            {isTests ? null : (
              <Link href={`/teacher/questions/new?area=${area}`} className={HEADER_ACTION_CLASS}>
                <Plus size={14} aria-hidden /> New Question
              </Link>
            )}
          </HeaderActions>
        }
      />

      <PracticeAreaTabs basePath="/teacher/questions" active={area} preserve={{ difficulty: filters.difficulty, status: filters.status }} />

      {isTests ? (
        <QuestionsTestFilter
          key={[selectedTestId, selectedModule, filters.difficulty, filters.status].join("|")}
          tests={tests.map((t) => ({ value: t.id, label: testLabel(t) }))}
          modules={TEST_MODULES}
          initialTestId={selectedTestId}
          initialModule={selectedModule}
          initialDifficulty={filters.difficulty}
          initialStatus={filters.status}
        />
      ) : (
        <QuestionsFilter
          // Remount on a new URL (Clear / tab) so the fields show the applied filters.
          key={[area, selectedDomainId, filters.topic, filters.difficulty, filters.status].join("|")}
          area={area}
          sectionLabel={sectionLabel}
          topics={visibleTopics.map((t) => ({
            id: t.id,
            name: t.name,
            sectionLabel: domainSectionLabel({ practiceArea: t.domain.practiceArea }),
            domainName: t.domain.name,
            domainId: t.domainId,
          }))}
          initialTopicId={selectedTopicId}
          initialDomainId={selectedDomainId}
          initialDifficulty={filters.difficulty}
          initialStatus={filters.status}
        />
      )}

      <QuestionsTable
        // A filter fixed to one value hides its column (Domain / Test only trims the first line of the cell).
        fixed={
          isTests
            ? { domain: Boolean(selectedTestId), skill: Boolean(selectedTestId && selectedModule), difficulty: Boolean(filters.difficulty), status: Boolean(statusFilter) }
            : { domain: Boolean(selectedDomainId), skill: Boolean(selectedTopicId), difficulty: Boolean(filters.difficulty), status: Boolean(statusFilter) }
        }
        labels={isTests ? { both: "Test / Module", inner: "Module" } : undefined}
        editQuery={isTests ? "?area=tests" : ""}
        rows={questions.map((q): QuestionBankRow => {
          const setUses = new Set(q.setItems.map((s) => s.practiceSetId)).size;
          const fullUses = q.fullTestItems.length;
          // The chosen Test's copy (a question can sit in more than one Test).
          const testItem = q.fullTestItems.find((item) => item.module.testId === selectedTestId) ?? q.fullTestItems[0];
          return {
            id: q.id,
            stem: q.stem,
            imageUrl: q.imageUrl,
            stimulus: q.stimulus,
            optionImageUrls: optionImages.get(q.id) ?? [],
            skillSection: isTests ? "Tests" : domainSectionLabel({ practiceArea: q.topic.domain.practiceArea }),
            skillDomain: isTests ? (testItem ? testLabel(testItem.module.test) : "") : q.topic.domain.name,
            skillName: isTests ? (TEST_MODULES.find((m) => m.value === String(testItem?.module.order))?.label ?? "") : q.topic.name,
            difficulty: q.difficulty,
            type: resolveQuestionType(q.type, q.options),
            status: q.status,
            uses: setUses + fullUses,
            usedCount: setUses + fullUses + q._count.answers,
          };
        })}
      />
      <Pagination
        basePath="/teacher/questions"
        params={{
          area,
          domain: selectedDomainId,
          topic: isTests ? undefined : filters.topic,
          test: selectedTestId,
          module: selectedModule,
          difficulty: filters.difficulty,
          status: filters.status,
        }}
        page={page}
        pageCount={pageCount}
        total={total}
        pageSize={pageSize}
      />
    </PageShell>
  );
}
