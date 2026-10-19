import Link from "next/link";
import { redirect } from "next/navigation";
import {
  AreaSummaryCard,
  DIFFICULTIES,
  EmptyState,
  PageShell,
  Pagination,
  PracticeAreaTabs,
  SectionHeader,
  SkillsMap,
  SkillsMapLegend,
  pageFromParam,
  paginate,
  studentAreaCardProps,
  type ChipState,
  type SkillsMapChip,
} from "@/components/sat";
import { Breadcrumbs } from "@/components/sat/breadcrumbs";
import { AreaTag, PracticeSetRow } from "@/components/sat/practice-set-row";
import { Pct } from "@/components/sat/work-status";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { auth } from "@/lib/auth";
import { refreshAssignmentStates } from "@/lib/assignments";
import { difficultyBadgeVariant, difficultyLabel } from "@/lib/domain-meta";
import { activeHomeTab, practiceAreaFromTab, practiceAreaLabel, tabFromPracticeArea, type PracticeAreaCode } from "@/lib/practice-area";
import { loadStudentPractice, sortPracticeSets, summarizeArea, PRACTICE_AREAS_IN_ORDER, type PracticeSetItem } from "@/lib/student-practice";
import { officialSkillsFor } from "@/lib/taxonomy-order";
import { formatDate, relativeDay } from "@/lib/utils";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ area?: string; page?: string }>;
}

/**
 * Practice (mockup content-map.html): Summary · Math · Reading · Writing. Practice sets by skill,
 * assigned by the teacher. Percentages only — SAT scores belong to Tests.
 */
export default async function StudentPracticePage({ searchParams }: PageProps) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  await refreshAssignmentStates();
  const query = await searchParams;
  const tab = activeHomeTab(query.area === "tests" ? undefined : query.area);
  if (query.area === "tests" || query.area === "mocks") redirect("/student/tests");
  const area = tab === "summary" ? null : practiceAreaFromTab(tab);
  const practice = await loadStudentPractice(session.user.id);

  return (
    <PageShell>
      <Breadcrumbs
        items={[
          { label: "Home", href: "/student" },
          ...(area ? [{ label: "Practice", href: "/student/practice" }, { label: practiceAreaLabel(area) }] : [{ label: "Practice" }]),
        ]}
      />
      <h1 className="text-2xl font-semibold text-gray-900">Practice</h1>
      <p className="mb-4 mt-1 text-sm text-gray-500">Practice sets by skill, assigned by your teacher. Use them to prepare for your Tests.</p>
      <PracticeAreaTabs basePath="/student/practice" active={tab} includeSummary includeTests={false} />
      {area ? <AreaView practice={practice} area={area} page={pageFromParam(query.page)} /> : <SummaryView practice={practice} />}
    </PageShell>
  );
}

function SummaryView({ practice }: { practice: PracticeSetItem[] }) {
  const todo = sortPracticeSets(practice.filter((p) => p.state !== "done"));
  const recent = practice
    .flatMap((item) => item.tries.map((t) => ({ item, t })))
    .sort((a, b) => b.t.submittedAt.getTime() - a.t.submittedAt.getTime())
    .slice(0, 5);
  return (
    <>
      <div className="grid gap-4 md:grid-cols-3">
        {PRACTICE_AREAS_IN_ORDER.map((area) => {
          const s = summarizeArea(practice, area);
          return <AreaSummaryCard key={area} {...studentAreaCardProps(s, `/student/practice?area=${tabFromPracticeArea(area)}`, `Open ${s.label} practice`)} />;
        })}
      </div>
      <div className="mt-6 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Card padding="md">
          <SectionHeader title="Practice to do" description={`${todo.length} set${todo.length === 1 ? "" : "s"} · in progress first, then by due date`} />
          {todo.length === 0 ? <p className="py-3 text-sm text-gray-500">Nothing pending.</p> : todo.map((item) => <PracticeSetRow key={item.assignmentId} item={item} showArea />)}
        </Card>
        <Card padding="md">
          <SectionHeader title="Recent practice results" action={<Link href="/student/history" className="text-xs text-blue-600 hover:underline">History ›</Link>} />
          {recent.length === 0 ? (
            <p className="py-3 text-sm text-gray-500">No finished practice yet.</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {recent.map(({ item, t }) => (
                <li key={t.id}>
                  <Link href={`/student/results/${t.id}`} className="flex items-center justify-between gap-3 py-2 text-sm hover:bg-gray-50">
                    <span>
                      <AreaTag area={item.area} /> <span className="font-medium text-gray-900">{item.skill}</span>{" "}
                      <Badge variant={difficultyBadgeVariant(item.difficulty)}>{difficultyLabel(item.difficulty)}</Badge>
                      <span className="block text-xs text-gray-500">Completed {formatDate(t.submittedAt)} ({relativeDay(t.submittedAt)}) · Try {t.tryNumber}</span>
                    </span>
                    <Pct value={t.pct} className="shrink-0 font-semibold" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}

const SETS_PAGE_SIZE = 10;

async function AreaView({ practice, area, page }: { practice: PracticeSetItem[]; area: PracticeAreaCode; page: number }) {
  const tab = tabFromPracticeArea(area)!;
  const mine = sortPracticeSets(practice.filter((p) => p.area === area));
  const setsPage = paginate(mine, page, SETS_PAGE_SIZE);
  const skills = await officialSkillsFor(area);
  const domains = [...new Map(skills.map((s) => [s.domainId, s.domain])).entries()];
  const setsFor = (skillId: string, diff: string) => mine.filter((p) => p.skillId === skillId && p.difficulty === diff);

  const chipFor = (skillId: string, diff: string): SkillsMapChip => {
    const sets = setsFor(skillId, diff);
    if (sets.length === 0) return { difficulty: diff, state: null, title: `Your teacher hasn't assigned a ${difficultyLabel(diff)} set for this skill yet` };
    const one = sets.length === 1 ? sets[0] : null;
    const state: ChipState = sets.some((s) => s.overdue) ? "overdue" : sets.every((s) => s.state === "done") ? "done" : sets.some((s) => s.state === "progress") ? "progress" : "todo";
    const best = sets.reduce<number | null>((m, s) => (s.best !== null && (m === null || s.best > m) ? s.best : m), null);
    return {
      difficulty: diff,
      state,
      href: one
        ? one.state === "done" && one.last
          ? `/student/results/${one.last.id}`
          : `/student/practice/assignment/${one.assignmentId}`
        : `/student/content-map/${skillId}/${diff.toLowerCase()}?area=${tab}`,
      title: one ? (one.state === "done" ? "View results" : one.state === "progress" ? "Continue" : "Start") : `${sets.length} sets`,
      extra: (
        <>
          {sets.length > 1 ? ` ×${sets.length}` : ""}
          {state === "done" && best !== null ? <span className="text-gray-500">· {best}%</span> : null}
        </>
      ),
    };
  };

  return (
    <>
      <section id="sets" className="mb-6 scroll-mt-20">
        <SectionHeader
          title={`Your ${practiceAreaLabel(area)} practice sets`}
          description={`${mine.length} set${mine.length === 1 ? "" : "s"} · in progress first, then by due date`}
          action={<Link href={`/student/history?area=${tab}`} className="text-xs text-blue-600 hover:underline">History ›</Link>}
        />
        {mine.length === 0 ? (
          <EmptyState title={`No ${practiceAreaLabel(area)} practice sets yet.`} description="Your teacher assigns practice sets for each skill." />
        ) : (
          <Card padding="md" className="py-1">
            {setsPage.items.map((item) => <PracticeSetRow key={item.assignmentId} item={item} />)}
            <Pagination basePath="/student/practice" params={{ area: tab }} anchor="sets" pageSize={SETS_PAGE_SIZE} {...setsPage} />
          </Card>
        )}
      </section>

      <section>
        <SectionHeader title="Skills map" description={`Every SAT skill in ${practiceAreaLabel(area)} and the sets assigned for each one.`} className="mb-0" />
        <SkillsMapLegend />
        <SkillsMap
          domains={domains.map(([domainId, domainName]) => ({
            id: domainId,
            name: domainName,
            skills: skills
              .filter((s) => s.domainId === domainId)
              .map((skill) => {
                const assigned = mine.filter((p) => p.skillId === skill.id).length;
                return {
                  id: skill.id,
                  name: skill.name,
                  sub: assigned ? `${assigned} set${assigned === 1 ? "" : "s"} assigned` : "No sets assigned yet",
                  chips: DIFFICULTIES.map((d) => chipFor(skill.id, d)),
                };
              }),
          }))}
        />
      </section>
    </>
  );
}
