import { PageShell, PracticeAreaTabs } from "@/components/sat";
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

interface SearchParams { area?: string; section?: string; topic?: string; difficulty?: string; status?: string }

const TOPIC_IN_CHUNK = 400;

export default async function QuestionBankPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const filters = await searchParams;
  const area = activeAreaTab(filters.area ?? filters.section, "math");
  // "Full Practice Tests" is an exam surface, not a question-bank area.
  if (area === "mocks") redirect("/teacher/full-tests");
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
        sectionName: t.domain.section.name,
        sectionLabel: t.domain.section.label,
        domainName: t.domain.name,
      }) === practiceArea
  );
  const visibleTopicIds = [...new Set(visibleTopics.map((topic) => topic.id))];
  const selectedTopicId = filters.topic && visibleTopicIds.includes(filters.topic) ? filters.topic : undefined;

  const topicFilter = selectedTopicId
    ? selectedTopicId
    : visibleTopicIds.length <= TOPIC_IN_CHUNK
      ? { in: visibleTopicIds }
      : { in: visibleTopicIds.slice(0, TOPIC_IN_CHUNK) };

  const questions = await prisma.question.findMany({
    where: {
      topicId: topicFilter,
      difficulty: (filters.difficulty as string | undefined) || undefined,
      status: (filters.status as string | undefined) || undefined,
    },
    include: {
      topic: { include: { domain: { include: { section: true } } } },
      options: { select: { text: true, imageUrl: true } },
      setItems: { select: { practiceSetId: true } },
      fullTestItems: { select: { moduleId: true } },
      answers: { select: { id: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  const optionImages = await loadOptionImageUrlsByQuestionId(questions.map((q) => q.id));

  return (
    <PageShell>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Question Bank</h1>
        <div className="flex items-center gap-2">
          <Link href="/admin/import" className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
            Bulk Import
          </Link>
          <Link
            href="/teacher/questions/new"
            className="flex items-center gap-1.5 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            <Plus size={14} /> New Question
          </Link>
        </div>
      </div>

      <PracticeAreaTabs
        basePath="/teacher/questions"
        active={area}
        preserve={{ difficulty: filters.difficulty, status: filters.status }}
      />

      <QuestionsFilter
        area={area}
        sectionLabel={sectionLabel}
        topics={visibleTopics.map((t) => ({
          id: t.id,
          name: t.name,
          sectionLabel: domainSectionLabel({
            practiceArea: t.domain.practiceArea,
            sectionName: t.domain.section.name,
            sectionLabel: t.domain.section.label,
            domainName: t.domain.name,
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
              sectionName: q.topic.domain.section.name,
              sectionLabel: q.topic.domain.section.label,
              domainName: q.topic.domain.name,
            }),
            skillDomain: q.topic.domain.name,
            skillName: q.topic.name,
            difficulty: q.difficulty,
            type: resolveQuestionType(q.type, q.options),
            status: q.status,
            uses: setUses + fullUses,
            usedCount: setUses + fullUses + q.answers.length,
          };
        })}
      />
    </PageShell>
  );
}
