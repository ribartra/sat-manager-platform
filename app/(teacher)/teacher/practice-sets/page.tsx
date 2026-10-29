import { ListFilters, PageShell, PracticeAreaTabs, SkillsSourceMap, matchesQuery, type SkillsMapChip } from "@/components/sat";
import { contentScopeFor } from "@/lib/program-scope";
import prisma from "@/lib/prisma";
import Link from "next/link";
import { Sparkles } from "lucide-react";
import { PracticeSetsMenu } from "./practice-sets-menu-client";
import { redirect } from "next/navigation";
import { Breadcrumbs } from "@/components/sat/breadcrumbs";
import { compareSkills } from "@/lib/taxonomy-order";
import { activeAreaTab, practiceAreaFromTab, resolvePracticeArea, tabFromPracticeArea } from "@/lib/practice-area";
import { academicTopicWhere } from "@/lib/taxonomy";
import { MoreLinks } from "@/components/sat/more-links";
import { auth } from "@/lib/auth";
import { requireContentImporter } from "@/lib/rbac";
import { getFeatureFlagValues } from "@/lib/feature-flags";
import { TEACHER_MORE_LINKS, resolveLinks } from "@/lib/nav-config";
import { DEFAULT_PRACTICE_SOURCE_ID, listSources } from "@/lib/content-source";

interface SearchParams {
  area?: string;
  section?: string;
  topic?: string;
  difficulty?: string;
  source?: string;
  q?: string;
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
  const session = await auth();
  // Admin and master teacher import content with AI ("+ Import" on empty levels, header button).
  const canImport = Boolean(await requireContentImporter());
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
  // A skill named in the URL (editor after saving, old links) starts opened.
  const selectedTopicId = filters.topic && topicIds.includes(filters.topic) ? filters.topic : undefined;
  const search = filters.q?.trim() ?? "";
  // Only sources used for Practice Sets (Innovator is Tests-only).
  const sources = await listSources({ kind: "practice" });
  const practiceSets = await prisma.practiceSet.findMany({
    // The sets of the programs the teacher teaches (shared bank).
    where: { topicId: { in: topicIds }, ...(session ? contentScopeFor(session.user) : { id: "__no_session__" }) },
    include: {
      topic: { include: { domain: { include: { section: true } } } },
      source: { select: { id: true, name: true } },
      questions: { select: { questionId: true } },
      assignments: { select: { id: true, studentId: true, status: true } },
    },
    orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
  });
  // One search box (SAT-042): a skill shows when its name or one of its sets matches.
  const setMatches = (set: (typeof practiceSets)[number]) => matchesQuery(search, set.name);
  const domains = new Map<string, { name: string; topics: typeof topics }>();
  for (const topic of [...topics].sort(compareSkills)) {
    if (search && !matchesQuery(search, topic.name) && !practiceSets.some((set) => set.topicId === topic.id && setMatches(set))) continue;
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
        <div className="flex shrink-0 flex-wrap gap-2 self-start">
          {canImport ? (
            <Link href="/teacher/import?kind=PRACTICE_SET" className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-[var(--sat-border)] bg-white px-3 py-2 text-sm font-semibold text-gray-800 hover:bg-[var(--sat-primary-soft)]"><Sparkles size={14} /> Import with AI</Link>
          ) : null}
        </div>
      </header>
      <MoreLinks links={moreLinks} />
      <PracticeAreaTabs basePath="/teacher/practice-sets" active={area} includeTests={false} preserve={{ q: search || undefined }} />
      <ListFilters action="/teacher/practice-sets" q={search} placeholder="Skill or practice set name" hidden={{ area }} />
      <div className="space-y-3">
        <SkillsSourceMap
          emptyText={search ? "No skill or practice set matches the search." : "No skills in this area yet."}
          domains={[...domains.entries()].map(([domainId, domain]) => ({
            id: domainId,
            name: domain.name,
            skills: domain.topics.map((topic) => {
              // A set saved without a source (seed data) counts as College Board, like the migration backfill.
              const setsOfTopic = practiceSets
                .filter((set) => set.topicId === topic.id)
                .map((set) => ({ ...set, sourceId: set.sourceId ?? DEFAULT_PRACTICE_SOURCE_ID }));
              const assigned = setsOfTopic.reduce((sum, set) => sum + set.assignments.length, 0);
              const isSelected = selectedTopicId === topic.id;
              const searchHit = Boolean(search) && setsOfTopic.some(setMatches);
              // Chip of one level: a drop-down of its sets (all sources, or one); an empty level offers "+ Import".
              const chipFor = (difficulty: string, source?: { id: string; name: string; active: boolean }): SkillsMapChip => {
                const sets = setsOfTopic.filter((set) => set.difficulty === difficulty && (!source || set.sourceId === source.id));
                const published = sets.filter((set) => set.status === "PUBLISHED").length;
                const prefix = source ? `${source.name}: ` : "";
                if (sets.length > 0) {
                  return {
                    difficulty,
                    state: "available",
                    render: (
                      <PracticeSetsMenu
                        difficulty={difficulty}
                        title={`${prefix}${sets.length} set${sets.length === 1 ? "" : "s"} (${published} published): preview, edit or change status`}
                        sets={sets.map((set) => ({ id: set.id, name: set.name, status: set.status, questions: set.questions.length, assignments: set.assignments.length }))}
                        extra={
                          <span className="text-[var(--sat-muted)]">
                            {sets.length} set{sets.length === 1 ? "" : "s"}
                            {sets.length > published ? ` · ${sets.length - published} draft` : ""}
                          </span>
                        }
                      />
                    ),
                  };
                }
                if (source && !source.active) return { difficulty, state: null, title: `No ${source.name} set at this level` };
                // Empty level: admin / master teacher import it with AI (pre-filled); others just see it's empty.
                if (canImport) {
                  return {
                    difficulty,
                    state: null,
                    href: `/teacher/import?${new URLSearchParams({ kind: "PRACTICE_SET", topic: topic.id, difficulty, ...(source ? { source: source.id } : {}) }).toString()}`,
                    title: source ? `No ${source.name} set at this level yet: import one with AI` : "No set at this level yet: import one with AI",
                  };
                }
                return { difficulty, state: null, title: source ? `No ${source.name} set at this level yet` : "No set at this level yet" };
              };
              // Rows: every active practice source (empty levels offer "+ Import"), plus an inactive one that still has sets here.
              const rows = sources.filter((source) => source.active || setsOfTopic.some((set) => set.sourceId === source.id));
              return {
                id: topic.id,
                name: topic.name,
                sub: `Assigned ${assigned} time${assigned === 1 ? "" : "s"}`,
                open: isSelected || searchHit,
                chips: DIFFICULTIES.map((difficulty) => chipFor(difficulty)),
                rows: rows.map((source) => ({
                  id: source.id,
                  name: source.active ? source.name : `${source.name} (inactive)`,
                  chips: DIFFICULTIES.map((difficulty) => chipFor(difficulty, source)),
                })),
              };
            }),
          }))}
        />
        <p className="text-xs text-gray-500">Click a level to open its sets (preview, edit, status). To assign a set, open a student (Students → Assign practice).</p>
      </div>
    </PageShell>
  );
}
