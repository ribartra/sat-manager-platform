import { Breadcrumbs } from "@/components/sat/breadcrumbs";
import { currentContentScope } from "@/lib/content-scope";
import { PageShell, PracticeAreaTabs } from "@/components/sat";
import { Pagination, pageFromParam } from "@/components/sat/pagination";
import prisma from "@/lib/prisma";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus } from "lucide-react";
import { academicTopicWhere } from "@/lib/taxonomy";
import {
  activeAreaTab,
  domainSectionLabel,
  practiceAreaFromTab,
  practiceSectionLabel,
  resolvePracticeArea,
} from "@/lib/practice-area";
import { QuestionsFilter } from "./questions-filter-client";
import { loadOptionImageUrlsByQuestionId } from "@/lib/question-list-media-query";
import { QuestionsTable, type QuestionBankRow } from "./questions-table-client";
import { resolveQuestionType } from "@/lib/question-type";

interface SearchParams { area?: string; section?: string; topic?: string; difficulty?: string; status?: string; page?: string; q?: string }

const TOPIC_IN_CHUNK = 400;
const PAGE_SIZE = 50;

export default async function QuestionBankPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const filters = await searchParams;
  const area = activeAreaTab(filters.area ?? filters.section, "math");
  // "Full Practice Tests" is an exam surface, not a question-bank area.
  if (area === "tests") redirect("/teacher/tests");
  const practiceArea = practiceAreaFromTab(area);
  const sectionLabel = practiceSectionLabel(practiceArea);

  const topics = await prisma.topic.findMany({
    where: academicTopicWhere,
    include: { domain: { include: { section: true } } },
    orderBy: { name: "asc" },
  });
  const visibleTopics = topics.filter(
    (t) =>
      resolvePracticeArea({
        practiceArea: t.domain.practiceArea,
      }) === practiceArea
  );
  const visibleTopicIds = [...new Set(visibleTopics.map((topic) => topic.id))];
  const selectedTopicId = filters.topic && visibleTopicIds.includes(filters.topic) ? filters.topic : undefined;

  const topicFilter = selectedTopicId
    ? selectedTopicId
    : visibleTopicIds.length <= TOPIC_IN_CHUNK
      ? { in: visibleTopicIds }
      : { in: visibleTopicIds.slice(0, TOPIC_IN_CHUNK) };

  // Text search: words of the stem / stimulus.
  const q = (filters.q ?? "").trim();
  const questionWhere = {
    // The bank of the programs the teacher teaches (shared by the program's teachers).
    ...(await currentContentScope()),
    topicId: topicFilter,
    difficulty: (filters.difficulty as string | undefined) || undefined,
    status: (filters.status as string | undefined) || undefined,
    ...(q ? { OR: [{ stem: { contains: q } }, { stimulus: { contains: q } }] } : {}),
  };
  const total = await prisma.question.count({ where: questionWhere });
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(pageFromParam(filters.page), pageCount);
  const questions = await prisma.question.findMany({
    where: questionWhere,
    include: {
      topic: { include: { domain: { include: { section: true } } } },
      options: { select: { text: true, imageUrl: true } },
      setItems: { select: { practiceSetId: true } },
      fullTestItems: { select: { moduleId: true } },
      _count: { select: { answers: true } },
    },
    orderBy: { createdAt: "desc" },
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
  });
  const optionImages = await loadOptionImageUrlsByQuestionId(questions.map((q) => q.id));

  return (
    <PageShell>
      <Breadcrumbs items={[{ label: "Home", href: "/teacher" }, { label: "Practice", href: "/teacher/practice-sets" }, { label: "Questions" }]} />
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-[26px] font-bold tracking-[-0.3px] text-gray-900">Question Bank</h1>
        <div className="flex items-center gap-2">
          <Link
            href="/teacher/questions/new"
            className="flex items-center gap-1.5 shrink-0 whitespace-nowrap rounded-lg bg-[var(--sat-primary)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--sat-primary-dark)]"
          >
            <Plus size={14} /> New Question
          </Link>
        </div>
      </div>

      <PracticeAreaTabs
        basePath="/teacher/questions"
        active={area}
        includeTests={false}
        preserve={{ difficulty: filters.difficulty, status: filters.status }}
      />
      <p className="-mt-3 mb-3 text-xs text-gray-500">
        Questions of the Tests are managed in <Link href="/teacher/tests" className="text-blue-600 hover:underline">Tests</Link>.
      </p>

      <QuestionsFilter
        area={area}
        initialQuery={q}
        sectionLabel={sectionLabel}
        topics={visibleTopics.map((t) => ({
          id: t.id,
          name: t.name,
          sectionLabel: domainSectionLabel({
            practiceArea: t.domain.practiceArea,
          }),
          domainName: t.domain.name,
        }))}
        initialTopicId={selectedTopicId}
        initialDifficulty={filters.difficulty}
        initialStatus={filters.status}
      />

      <QuestionsTable
        rows={questions.map((q): QuestionBankRow => {
          const setUses = new Set(q.setItems.map((s) => s.practiceSetId)).size;
          const fullUses = q.fullTestItems.length;
          return {
            id: q.id,
            stem: q.stem,
            imageUrl: q.imageUrl,
            stimulus: q.stimulus,
            optionImageUrls: optionImages.get(q.id) ?? [],
            skillSection: domainSectionLabel({
              practiceArea: q.topic.domain.practiceArea,
            }),
            skillDomain: q.topic.domain.name,
            skillName: q.topic.name,
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
        params={{ area: filters.area, section: filters.section, topic: filters.topic, difficulty: filters.difficulty, status: filters.status, q: q || undefined }}
        page={page}
        pageCount={pageCount}
        total={total}
        pageSize={PAGE_SIZE}
        className="mt-2"
      />
    </PageShell>
  );
}
