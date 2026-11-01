import { ListFilters, PageHeader, PageShell, PracticeAreaTabs, SkillsSourceMap, matchesQuery, type SkillsMapChip } from "@/components/sat";
import { contentScopeFor } from "@/lib/program-scope";
import prisma from "@/lib/prisma";
import Link from "next/link";
import { Sparkles } from "lucide-react";
import { PracticeSetsMenu } from "./practice-sets-menu-client";
import { HEADER_ACTION_CLASS, HEADER_SHORTCUT_CLASS, HeaderActions } from "@/components/sat/header-actions";
import { assignHref } from "@/lib/assign-params";
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
import { addCounts, assignmentCounts } from "@/lib/assignment-counts";
import { studentAccessWhereFor } from "@/lib/program-scope";
import { suggestionValues } from "@/lib/search-suggestions";

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
  // Admin and master teacher import content with AI ("+ Easy" on a source's empty level, header button).
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
  const now = new Date();
  // Only sources used for Practice Sets (Innovator is Tests-only).
  const sources = await listSources({ kind: "practice" });
  const practiceSets = await prisma.practiceSet.findMany({
    // The sets of the programs the teacher teaches (shared bank).
    where: { topicId: { in: topicIds }, ...(session ? contentScopeFor(session.user) : { id: "__no_session__" }) },
    include: {
      topic: { include: { domain: { include: { section: true } } } },
      source: { select: { id: true, name: true } },
      questions: { select: { questionId: true } },
      // How each set is going with the teacher's students (hover: assigned, completed, in progress, overdue).
      assignments: {
        where: { student: session ? studentAccessWhereFor(session.user, now) : { id: "__no_session__" } },
        select: { status: true, dueDate: true, attempts: { where: { status: "IN_PROGRESS" }, select: { id: true } } },
      },
      // Every assignment (any teacher): a set that has them can't be deleted.
      _count: { select: { assignments: true } },
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
    <PageShell className="space-y-4">
      <Breadcrumbs items={[{ label: "Home", href: "/teacher" }, { label: "Practice" }]} />
      <PageHeader
        title="Practice"
        description="Manage practice sets: every SAT skill in Math, Reading and Writing has Easy, Medium and Hard levels, each with any number of sets. Results show as % correct only (SAT scores are for Tests)."
        actions={
          <HeaderActions>
            {/* This area's questions in the Question Bank (with the way back here). */}
            <Link href={`/teacher/questions?area=${area}`} className={HEADER_SHORTCUT_CLASS}>Questions →</Link>
            {canImport ? (
              <Link href="/teacher/import?kind=PRACTICE_SET" className={HEADER_ACTION_CLASS}>
                <Sparkles size={14} aria-hidden /> Import with AI
              </Link>
            ) : null}
          </HeaderActions>
        }
      />
      <MoreLinks links={moreLinks} />
      <PracticeAreaTabs basePath="/teacher/practice-sets" active={area} includeTests={false} preserve={{ q: search || undefined }} />
      <ListFilters
        action="/teacher/practice-sets"
        q={search}
        placeholder="Skill or practice set name"
        hidden={{ area }}
        suggestions={suggestionValues([...topics.map((t) => t.name), ...practiceSets.map((set) => set.name)])}
      />
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
              const countsOf = (set: (typeof setsOfTopic)[number]) => assignmentCounts(set.assignments, now);
              const isSelected = selectedTopicId === topic.id;
              const searchHit = Boolean(search) && setsOfTopic.some(setMatches);
              // Chip of one level: a drop-down of its sets (all sources, or one); empty: "—" (skill row) or "+ Easy" (source row).
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
                        counts={addCounts(sets.map(countsOf))}
                        sets={sets.map((set) => ({
                          id: set.id,
                          name: set.name,
                          status: set.status,
                          questions: set.questions.length,
                          assignments: set._count.assignments,
                          counts: countsOf(set),
                          assignHref: set.status === "PUBLISHED" ? assignHref({ area, set: [set.id], topic: topic.id }) : null,
                        }))}
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
                // Empty level on the skill row (every source): "Easy —", like Assign. The "+" is only per source.
                if (!source) return { difficulty, state: "none", title: "No set at this level yet" };
                // Empty level of one active source: admin / master teacher import it with AI (pre-filled "+ Easy").
                if (canImport && source.active) {
                  return {
                    difficulty,
                    state: null,
                    href: `/teacher/import?${new URLSearchParams({ kind: "PRACTICE_SET", topic: topic.id, difficulty, source: source.id }).toString()}`,
                    title: `No ${source.name} set at this level yet: import one with AI`,
                  };
                }
                return { difficulty, state: "none", title: `No ${source.name} set at this level yet` };
              };
              // Rows: every active practice source (its empty levels offer "+ Easy"), plus an inactive one that still has sets here.
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
        <p className="text-xs text-gray-500">Click a level to open its sets: preview, assign, edit or change their status.</p>
      </div>
    </PageShell>
  );
}
