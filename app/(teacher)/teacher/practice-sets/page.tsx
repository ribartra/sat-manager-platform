import { PageShell, PracticeAreaTabs, SkillsMap, matchesQuery } from "@/components/sat";
import prisma from "@/lib/prisma";
import Link from "next/link";
import { Plus } from "lucide-react";
import { PracticeSetsFilter } from "./practice-sets-filter-client";
import { PracticeSetsTable, type PracticeSetRow } from "./practice-sets-table-client";
import { redirect } from "next/navigation";
import { Breadcrumbs } from "@/components/sat/breadcrumbs";
import { compareSkills } from "@/lib/taxonomy-order";
import { cn } from "@/lib/utils";
import { activeAreaTab, practiceAreaFromTab, practiceSectionLabel, resolvePracticeArea, tabFromPracticeArea } from "@/lib/practice-area";
import { academicTopicWhere } from "@/lib/taxonomy";
import { MoreLinks } from "@/components/sat/more-links";
import { auth } from "@/lib/auth";
import { getFeatureFlagValues } from "@/lib/feature-flags";
import { TEACHER_MORE_LINKS, resolveLinks } from "@/lib/nav-config";

interface SearchParams {
  area?: string;
  section?: string;
  topic?: string;
  difficulty?: string;
  status?: string;
  view?: string;
  q?: string;
}

function tabPreserve(filters: SearchParams) {
  return { topic: filters.topic, difficulty: filters.difficulty, status: filters.status, view: filters.view };
}

const DIFFICULTIES = ["EASY", "MEDIUM", "HARD"] as const;

export default async function TeacherPracticeSetsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const filters = await searchParams;
  // Links that only know the skill (editor after saving, old Content map URLs) land on its area.
  const topicArea =
    !filters.area && !filters.section && filters.topic
      ? tabFromPracticeArea(
          resolvePracticeArea(
            (await prisma.topic.findUnique({ where: { id: filters.topic }, select: { domain: { select: { practiceArea: true } } } }))?.domain ?? {},
          ),
        )
      : null;
  const area = activeAreaTab(filters.area ?? filters.section ?? topicArea ?? undefined, "math");
  const practiceArea = practiceAreaFromTab(area);

  // Tests have their own section; old links to the Tests tab land there.
  if (area === "tests") redirect("/teacher/tests");
  const view = filters.view === "manage" ? "manage" : "skills";
  const session = await auth();
  const moreLinks = resolveLinks(TEACHER_MORE_LINKS.practice, {
    role: session?.user.role,
    flags: await getFeatureFlagValues({ role: session?.user.role, userId: session?.user.id }),
  });

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
  const sectionLabel = practiceSectionLabel(practiceArea);

  const manageHref = (extra: Record<string, string>) =>
    `/teacher/practice-sets?${new URLSearchParams({ area, view: "manage", ...extra }).toString()}`;
  const domains = new Map<string, { name: string; topics: typeof topics }>();
  for (const topic of [...topics].sort(compareSkills)) {
    const entry = domains.get(topic.domain.id) ?? { name: topic.domain.name, topics: [] };
    entry.topics.push(topic);
    domains.set(topic.domain.id, entry);
  }

  return (
    <PageShell maxWidth={1000} width="wide" density="compact" className="space-y-4">
      <Breadcrumbs items={[{ label: "Home", href: "/teacher" }, { label: "Practice" }]} />
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-[26px] font-bold tracking-[-0.3px] text-gray-900">Practice</h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage practice sets: every SAT skill in Math, Reading and Writing has Easy, Medium and Hard levels, each with any number of sets. Results show as % correct only
            (SAT scores are for Tests).
          </p>
        </div>
        <Link href="/teacher/practice-sets/new" className="inline-flex items-center gap-1.5 self-start shrink-0 whitespace-nowrap rounded-lg bg-[var(--sat-primary)] px-3 py-2 text-sm font-semibold text-white hover:bg-[var(--sat-primary-dark)]"><Plus size={14} /> New Practice Set</Link>
      </header>
      <MoreLinks links={moreLinks} />
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
                          extra: (
                            <span className="text-[var(--sat-muted)]">
                              {sets.length} set{sets.length === 1 ? "" : "s"}
                              {sets.length > published ? ` · ${sets.length - published} draft` : ""}
                            </span>
                          ),
                        }
                      : {
                          difficulty,
                          state: null,
                          href: `/teacher/practice-sets/new?topicId=${topic.id}`,
                          title: "No set at this level yet: create one",
                          extra: <span className="text-[var(--sat-muted)]">+ New</span>,
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
            initialQuery={filters.q}
          />
          <PracticeSetsTable
            rows={practiceSets
              .filter((practiceSet) => (!selectedTopicId || practiceSet.topicId === selectedTopicId) && (!filters.difficulty || practiceSet.difficulty === filters.difficulty) && (!filters.status || practiceSet.status === filters.status) && matchesQuery(filters.q, practiceSet.name, practiceSet.topic.name))
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
