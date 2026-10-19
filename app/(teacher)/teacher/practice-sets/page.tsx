import { PageShell, PracticeAreaTabs, SkillsMap } from "@/components/sat";
import prisma from "@/lib/prisma";
import Link from "next/link";
import { Plus } from "lucide-react";
import { PracticeSetsFilter } from "./practice-sets-filter-client";
import { PracticeSetsTable, type PracticeSetRow } from "./practice-sets-table-client";
import { redirect } from "next/navigation";
import { Breadcrumbs } from "@/components/sat/breadcrumbs";
import { compareSkills } from "@/lib/taxonomy-order";
import { cn } from "@/lib/utils";
import { activeAreaTab, practiceAreaFromTab, practiceAreaLabel } from "@/lib/practice-area";
import { academicTopicWhere } from "@/lib/taxonomy";

interface SearchParams {
  area?: string;
  section?: string;
  topic?: string;
  difficulty?: string;
  status?: string;
  view?: string;
}

function tabPreserve(filters: SearchParams) {
  return { topic: filters.topic, difficulty: filters.difficulty, status: filters.status, view: filters.view };
}

const DIFFICULTIES = ["EASY", "MEDIUM", "HARD"] as const;

export default async function TeacherPracticeSetsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const filters = await searchParams;
  const area = activeAreaTab(filters.area ?? filters.section, "math");
  const practiceArea = practiceAreaFromTab(area);

  // Tests have their own section; old links to the Tests tab land there.
  if (area === "tests") redirect("/teacher/tests");
  const view = filters.view === "manage" ? "manage" : "skills";

  const topicWhere = practiceArea ? { AND: [academicTopicWhere, { domain: { practiceArea } }] } : academicTopicWhere;
  const topics = await prisma.topic.findMany({
    where: topicWhere,
    include: { domain: { include: { section: true } } },
    orderBy: { name: "asc" },
  });
  const topicIds = topics.map((topic) => topic.id);
  const selectedTopicId = filters.topic && topicIds.includes(filters.topic) ? filters.topic : undefined;
  const practiceSets = await prisma.practiceSet.findMany({
    where: { topicId: { in: topicIds } },
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

  const manageHref = (extra: Record<string, string>) =>
    `/teacher/practice-sets?${new URLSearchParams({ area, view: "manage", ...extra }).toString()}`;
  const domains = new Map<string, { name: string; topics: typeof topics }>();
  for (const topic of [...topics].sort(compareSkills)) {
    const entry = domains.get(topic.domain.id) ?? { name: topic.domain.name, topics: [] };
    entry.topics.push(topic);
    domains.set(topic.domain.id, entry);
  }

  return (
    <PageShell width="wide" density="compact" className="space-y-4">
      <Breadcrumbs items={[{ label: "Home", href: "/teacher" }, { label: "Practice sets" }]} />
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Practice sets</h1>
          <p className="mt-1 text-sm text-gray-500">
            Every SAT skill has Easy, Medium and Hard sets. Results show as % correct only (SAT scores are for Tests).
          </p>
        </div>
        <Link href="/teacher/practice-sets/new" className="inline-flex items-center gap-1.5 self-start rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"><Plus size={14} /> New Practice Set</Link>
      </header>
      <PracticeAreaTabs basePath="/teacher/practice-sets" active={area} includeTests={false} preserve={tabPreserve(filters)} />
      <nav aria-label="Practice sets view" className="flex gap-1 text-sm">
        {(["skills", "manage"] as const).map((v) => (
          <Link
            key={v}
            href={v === "skills" ? `/teacher/practice-sets?area=${area}` : manageHref({})}
            aria-current={view === v ? "page" : undefined}
            className={cn("rounded-md px-3 py-1.5 font-medium", view === v ? "bg-gray-900 text-white" : "text-gray-600 hover:bg-gray-100")}
          >
            {v === "skills" ? "By skill" : "Manage sets"}
          </Link>
        ))}
      </nav>
      {view === "skills" ? (
        <div className="space-y-3">
          <SkillsMap
            domains={[...domains.entries()].map(([domainId, domain]) => ({
              id: domainId,
              name: domain.name,
              skills: domain.topics.map((topic) => {
                const setsOfTopic = practiceSets.filter((set) => set.topicId === topic.id);
                const assigned = setsOfTopic.reduce((sum, set) => sum + set.assignments.length, 0);
                return {
                  id: topic.id,
                  name: topic.name,
                  sub: `Assigned ${assigned} time${assigned === 1 ? "" : "s"}`,
                  chips: DIFFICULTIES.map((difficulty) => {
                    const sets = setsOfTopic.filter((set) => set.difficulty === difficulty);
                    const published = sets.filter((set) => set.status === "PUBLISHED").length;
                    return sets.length > 0
                      ? {
                          difficulty,
                          state: "available" as const,
                          href: manageHref({ topic: topic.id, difficulty }),
                          title: `${sets.length} set${sets.length === 1 ? "" : "s"} (${published} published): edit, preview or change status`,
                          extra: <span className="text-gray-500">· {sets.length}</span>,
                        }
                      : {
                          difficulty,
                          state: null,
                          href: `/teacher/practice-sets/new?topicId=${topic.id}`,
                          title: "No set at this level yet: create one",
                          extra: " · +",
                        };
                  }),
                };
              }),
            }))}
          />
          <p className="text-xs text-gray-500">To assign a set, open a student (Students → Assign practice) or use a group.</p>
        </div>
      ) : (
        <>
          <PracticeSetsFilter
            area={area}
            sectionLabel={sectionLabel}
            topics={topics.map((topic) => ({ id: topic.id, name: topic.name, sectionLabel, domainName: topic.domain.name }))}
            initialTopicId={selectedTopicId}
            initialDifficulty={filters.difficulty}
            initialStatus={filters.status}
          />
          <PracticeSetsTable
            rows={practiceSets
              .filter((practiceSet) => (!selectedTopicId || practiceSet.topicId === selectedTopicId) && (!filters.difficulty || practiceSet.difficulty === filters.difficulty) && (!filters.status || practiceSet.status === filters.status))
              .map((practiceSet): PracticeSetRow => ({
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
        </>
      )}
    </PageShell>
  );
}
