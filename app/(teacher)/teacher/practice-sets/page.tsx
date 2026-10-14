import { PageShell, PracticeAreaTabs } from "@/components/sat";
import prisma from "@/lib/prisma";
import Link from "next/link";
import { Plus } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PracticeSetsFilter } from "./practice-sets-filter-client";
import { PracticeSetsTable, type PracticeSetRow } from "./practice-sets-table-client";
import { FullTestActions } from "../full-tests/full-test-actions-client";
import { fullTestStatusBadgeVariant, fullTestStatusLabel } from "@/lib/domain-meta";
import { activeAreaTab, practiceAreaFromTab, practiceAreaLabel } from "@/lib/practice-area";
import { academicTopicWhere } from "@/lib/taxonomy";

interface SearchParams {
  area?: string;
  section?: string;
  topic?: string;
  difficulty?: string;
  status?: string;
}

function tabPreserve(filters: SearchParams) {
  return { topic: filters.topic, difficulty: filters.difficulty, status: filters.status };
}

export default async function TeacherPracticeSetsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const filters = await searchParams;
  const area = activeAreaTab(filters.area ?? filters.section, "math");
  const practiceArea = practiceAreaFromTab(area);

  if (area === "tests") {
    const tests = await prisma.fullPracticeTest.findMany({
      include: { modules: { include: { questions: true } }, assignments: true, attempts: true },
      orderBy: { createdAt: "desc" },
    });

    return (
      <PageShell width="wide" density="compact" className="space-y-4">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Practice &amp; Exams</h1>
            <p className="mt-1 text-sm text-gray-500">Manage practice content and Full Practice Tests in one place.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/teacher/full-tests/scoring" className="rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">How scores work</Link>
            <Link href="/teacher/full-tests/new" className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"><Plus size={14} /> New Exam</Link>
          </div>
        </header>
        <PracticeAreaTabs basePath="/teacher/practice-sets" active={area} preserve={tabPreserve(filters)} />
        <Card>
          {tests.map((test) => {
            const questionCount = test.modules.reduce((sum, module) => sum + module.questions.length, 0);
            return (
              <div key={test.id} className="grid gap-3 border-b border-gray-100 px-4 py-3 last:border-b-0 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-sm font-medium text-gray-900" title={test.name}>{test.name}</p>
                    <Badge variant={fullTestStatusBadgeVariant(test.status)}>{fullTestStatusLabel(test.status)}</Badge>
                  </div>
                  <p className="mt-1 text-xs text-gray-500">{questionCount} questions · {test.assignments.length} assignments</p>
                </div>
                <FullTestActions testId={test.id} status={test.status} hasAssignments={test.assignments.length > 0} hasAttempts={test.attempts.length > 0} variant="list" />
              </div>
            );
          })}
          {tests.length === 0 && <div className="p-10 text-center text-sm text-gray-400">No Exams yet.</div>}
        </Card>
      </PageShell>
    );
  }

  const topicWhere = practiceArea ? { AND: [academicTopicWhere, { domain: { practiceArea } }] } : academicTopicWhere;
  const topics = await prisma.topic.findMany({
    where: topicWhere,
    include: { domain: { include: { section: true } } },
    orderBy: { name: "asc" },
  });
  const topicIds = topics.map((topic) => topic.id);
  const selectedTopicId = filters.topic && topicIds.includes(filters.topic) ? filters.topic : undefined;
  const practiceSets = await prisma.practiceSet.findMany({
    where: {
      topicId: selectedTopicId || { in: topicIds },
      difficulty: filters.difficulty || undefined,
      status: filters.status || undefined,
    },
    include: {
      topic: { include: { domain: { include: { section: true } } } },
      questions: { select: { questionId: true } },
      assignments: { select: { id: true, studentId: true, status: true } },
    },
    orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
  });
  // Practice areas are shown separately (Math / Reading / Writing); "Reading & Writing"
  // stays only in exam/full-test surfaces.
  const sectionLabel = practiceArea === "MATH" ? "Mathematics" : practiceAreaLabel(practiceArea);

  return (
    <PageShell width="wide" density="compact" className="space-y-4">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Practice &amp; Exams</h1>
          <p className="mt-1 text-sm text-gray-500">Manage practice content and Full Practice Tests in one place.</p>
        </div>
        <Link href="/teacher/practice-sets/new" className="inline-flex items-center gap-1.5 self-start rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"><Plus size={14} /> New Practice Set</Link>
      </header>
      <PracticeAreaTabs basePath="/teacher/practice-sets" active={area} preserve={tabPreserve(filters)} />
      <PracticeSetsFilter
        area={area}
        sectionLabel={sectionLabel}
        topics={topics.map((topic) => ({ id: topic.id, name: topic.name, sectionLabel, domainName: topic.domain.name }))}
        initialTopicId={selectedTopicId}
        initialDifficulty={filters.difficulty}
        initialStatus={filters.status}
      />
      <PracticeSetsTable
        rows={practiceSets.map((practiceSet): PracticeSetRow => ({
          id: practiceSet.id,
          name: practiceSet.name,
          skillSection: sectionLabel,
          skillDomain: practiceSet.topic.domain.name,
          skillName: practiceSet.topic.name,
          difficulty: practiceSet.difficulty,
          questionCount: practiceSet.questions.length,
          assignmentCount: practiceSet.assignments.length,
          status: practiceSet.status,
        }))}
      />
    </PageShell>
  );
}
