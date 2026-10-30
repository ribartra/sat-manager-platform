import Link from "next/link";
import { BookOpen, CheckCircle2, ClipboardList, Clock, Map as MapIcon, TrendingUp } from "lucide-react";
import {
  AreaBoxGrid,
  Breadcrumbs,
  CompactAreaBox,
  ContinueCard,
  EmptyState,
  Pagination,
  PracticeAreaTabs,
  PracticeSetAttemptsAccordion,
  SectionHeader,
  StatGrid,
  StatTile,
  TestAttemptsAccordion,
  TestCardsByNumber,
  type TestCardLinks,
  pageFromParam,
  paginate,
} from "@/components/sat";
import type { Crumb } from "@/components/sat/breadcrumbs";
import { practiceSetGroups, setsFromStudentPractice, testGroups as groupTests } from "@/lib/attempt-groups";
import { ListItem, ListStack } from "@/components/sat/list";
import { FilterActions, FilterBar, FilterField } from "@/components/sat/filter-bar";
import { Select } from "@/components/ui/select";
import { PctBars, PracticeSetRow } from "@/components/sat/practice-set-row";
import { Pct } from "@/components/sat/work-status";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { difficultyLabel } from "@/lib/domain-meta";
import {
  activeAreaTab,
  activeHomeTab,
  practiceAreaFromTab,
  practiceAreaLabel,
  tabFromPracticeArea,
  type AreaTabKey,
  type PracticeAreaCode,
} from "@/lib/practice-area";
import { loadStudentPractice, sortPracticeSets, summarizeArea, PRACTICE_AREAS_IN_ORDER, type PracticeSetItem } from "@/lib/student-practice";
import { loadStudentTests, sortTests, type StudentTestItem } from "@/lib/test-assignments";
import { officialSkillsFor } from "@/lib/taxonomy-order";
import { loadContinueWork } from "@/lib/continue-work";
import { formatDate, relativeDay } from "@/lib/utils";
import { historyHref } from "@/lib/history-params";

/**
 * Student Home (mockup `mejorada` index.html + area.html). Tabs: Summary · Math · Reading · Writing · Tests.
 * Math/Reading/Writing show practice only (% correct, never SAT scores); Test results live in the
 * Tests tab (rule: practice and Tests are never mixed).
 *
 * Rendered for the student at /student and, read-only, for the teacher's "Student view"
 * (/teacher/impersonate/[studentId]): the same page, only the links change (see HomeLinks).
 */

/** Where the Home links go: the student's own pages, or the teacher's pages in "Student view". */
export interface HomeLinks {
  /** Base path of the Home itself (tabs, filters, pagination). */
  home: string;
  tab: (tab: AreaTabKey | "summary") => string;
  practiceResult: (attemptId: string) => string;
  testResult: (attemptId: string) => string;
  history: (tab?: string) => string;
  /** Practice skills map; null when there is no equivalent (Student view). */
  practice: (tab?: string) => string | null;
  /** No Start / Continue / Try again (teacher "Student view"). */
  readOnly: boolean;
  /** Breadcrumb trail up to the Home (Student view: Home › Students › {name} › View as student). */
  crumbs?: Crumb[];
}

/** Test card links for the Home: the student starts and retakes; the teacher's Student view only looks. */
function testCardLinks(links: HomeLinks): TestCardLinks {
  return {
    attempt: links.testResult,
    module: links.readOnly ? null : (assignmentId, moduleKey) => `/student/tests/${assignmentId}?module=${moduleKey}`,
    canRetake: !links.readOnly,
  };
}

export const STUDENT_HOME_LINKS: HomeLinks = {
  home: "/student",
  tab: (tab) => (tab === "summary" ? "/student" : `/student?area=${tab}`),
  practiceResult: (id) => `/student/results/${id}`,
  testResult: (id) => `/student/tests/results/${id}`,
  history: (tab) => (tab ? `/student/history?area=${tab}` : "/student/history"),
  practice: (tab) => (tab ? `/student/practice?area=${tab}` : "/student/practice"),
  readOnly: false,
};

/** Teacher "Student view": tabs stay on the impersonate URL, results open the teacher attempt pages. */
export function teacherViewLinks(studentId: string, studentName: string): HomeLinks {
  const home = `/teacher/impersonate/${studentId}`;
  const student = `/teacher/students/${studentId}`;
  return {
    home,
    tab: (tab) => (tab === "summary" ? home : `${home}?area=${tab}`),
    practiceResult: (id) => `${student}/attempts/${id}`,
    testResult: (id) => `${student}/tests/${id}`,
    // From an area tab: that area on the student page, at its recent attempts.
    history: (tab) => (tab ? `${student}?area=${tab}#recent-attempts` : historyHref({ student: studentId })),
    practice: () => null,
    readOnly: true,
    crumbs: [
      { label: "Home", href: "/teacher" },
      { label: "Students", href: "/teacher/students" },
      { label: studentName, href: student },
      { label: "View as student", href: home },
    ],
  };
}

export async function StudentHome({
  studentId,
  firstName,
  query,
  links = STUDENT_HOME_LINKS,
}: {
  studentId: string;
  firstName: string;
  query: { area?: string; skill?: string; difficulty?: string; status?: string; page?: string };
  links?: HomeLinks;
}) {
  const tab = activeHomeTab(query.area);
  const area = tab === "summary" ? null : activeAreaTab(tab);
  const practiceArea = area ? practiceAreaFromTab(area) : null;
  const [practice, tests] = await Promise.all([loadStudentPractice(studentId), loadStudentTests(studentId)]);
  const continueWork = tab === "summary" ? await loadContinueWork(studentId, practice, tests) : null;

  return (
    <>
      {tab !== "summary" ? (
        <Breadcrumbs items={[...(links.crumbs ?? [{ label: "Home", href: links.tab("summary") }]), { label: area === "tests" ? "Tests" : practiceAreaLabel(practiceArea) }]} />
      ) : links.crumbs ? (
        <Breadcrumbs items={links.crumbs.map((c, i) => (i === links.crumbs!.length - 1 ? { label: c.label } : c))} />
      ) : null}
      <div className="mb-4">
        <h1 className="text-[26px] font-bold tracking-[-0.3px] text-gray-900">Hello, {firstName}!</h1>
        <p className="mt-0.5 text-sm text-gray-500">
          {tab === "summary"
            ? `Today is ${new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}.`
            : area === "tests"
              ? "Your test results by SAT section."
              : `Your ${practiceAreaLabel(practiceArea)} practice.`}
        </p>
      </div>

      {tab === "summary" ? <ContinueCard work={continueWork} readOnly={links.readOnly} /> : null}

      <PracticeAreaTabs basePath={links.home} active={tab} includeSummary />

      {tab === "summary" ? (
        <SummaryView practice={practice} tests={tests} links={links} />
      ) : area === "tests" ? (
        <TestsTab tests={tests} page={pageFromParam(query.page)} links={links} />
      ) : practiceArea ? (
        <AreaPracticeView practice={practice} area={practiceArea} query={query} links={links} />
      ) : null}
    </>
  );
}

/** Summary (mockup index.html): compact practice boxes, the Test cards and the last 4 attempts. */
function SummaryView({ practice, tests, links }: { practice: PracticeSetItem[]; tests: StudentTestItem[]; links: HomeLinks }) {
  const recentPractice = practice.flatMap((item) => item.tries.map((t) => ({ kind: "practice" as const, when: t.submittedAt, item, t })));
  const recentTests = tests.flatMap((test) =>
    test.attempts.filter((a) => a.status !== "INVALIDATED").map((a) => ({ kind: "test" as const, when: a.submittedAt ?? a.startedAt, test, a })),
  );
  const recent = [...recentPractice, ...recentTests].sort((x, y) => y.when.getTime() - x.when.getTime()).slice(0, 4);
  const pendingTests = tests.filter((t) => t.state !== "done");
  // Test cards (same component as every view): pending first, then the finished ones.
  const testCards = [...sortTests(tests).pending, ...sortTests(tests).done];
  const overdueTests = pendingTests.filter((t) => t.overdue).length;

  return (
    <>
      <SectionHeader
        title={<span className="inline-flex items-center gap-1.5"><BookOpen size={16} /> Practice</span>}
        action={links.practice() ? <Link href={links.practice()!} className="text-sm text-blue-600 hover:underline">All practice ›</Link> : undefined}
      />
      <AreaBoxGrid>
        {PRACTICE_AREAS_IN_ORDER.map((code) => {
          const s = summarizeArea(practice, code);
          return (
            <CompactAreaBox
              key={code}
              area={code}
              label={s.label}
              href={links.tab(tabFromPracticeArea(code)!)}
              pct={s.latest?.attempt.pct ?? null}
              line1={s.latest ? `Latest practice · ${s.latest.item.name} · ${relativeDay(s.latest.attempt.submittedAt)}` : "Not practiced yet"}
              line2={`${s.todo} set${s.todo === 1 ? "" : "s"} to do`}
            />
          );
        })}
      </AreaBoxGrid>

      <section className="mt-6">
        <SectionHeader
          title={<span className="inline-flex items-center gap-1.5"><ClipboardList size={16} /> Tests</span>}
          description={`${pendingTests.length} pending${overdueTests ? ` · ${overdueTests} overdue` : ""}`}
          action={<Link href={links.tab("tests")} className="text-sm text-blue-600 hover:underline">All tests ›</Link>}
        />
        {testCards.length === 0 ? (
          <Card padding="md" className="text-sm text-gray-500">No tests assigned.</Card>
        ) : (
          <TestCardsByNumber items={testCards} links={testCardLinks(links)} layout="compact" openPending />
        )}
      </section>

      <section className="mt-6">
        <SectionHeader title="Recent attempts" action={<Link href={links.history()} className="text-sm text-blue-600 hover:underline">View all ›</Link>} />
        {recent.length === 0 ? (
          <EmptyState title="No attempts yet" description="Your finished practice sets and Tests will appear here." />
        ) : (
          <ListStack>
            {recent.map((r) => {
              const href = r.kind === "practice" ? links.practiceResult(r.t.id) : links.testResult(r.a.id);
              return (
                <ListItem compact key={r.kind === "practice" ? r.t.id : r.a.id} href={href}>
                  <span className="flex min-w-0 flex-wrap items-center gap-1.5">
                    {r.kind === "test" ? <Badge variant="test">Test</Badge> : <Badge>Practice</Badge>}
                    <b className="text-sm text-gray-900">{r.kind === "test" ? r.test.name : `${r.item.skill} · ${difficultyLabel(r.item.difficulty)}`}</b>
                    <span className="text-xs text-gray-500">{formatDate(r.when)}</span>
                    {r.kind === "test" && r.a.status === "IN_PROGRESS" ? <Badge variant="warning">In progress</Badge> : null}
                  </span>
                  <span className="flex shrink-0 items-center gap-2 text-sm">
                    {r.kind === "practice" ? (
                      <Pct value={r.t.pct} className="font-semibold" />
                    ) : r.a.view ? (
                      <span className="text-xs text-gray-500">{r.a.view.modulesDone} of 4 modules</span>
                    ) : (
                      <span>
                        <b className="text-[var(--sat-area-reading)]">R&amp;W {r.a.rwScore ?? "—"}</b> · <b className="text-[var(--sat-area-math)]">Math {r.a.mathScore ?? "—"}</b>
                      </span>
                    )}
                    <span aria-hidden className="text-gray-400">›</span>
                  </span>
                </ListItem>
              );
            })}
          </ListStack>
        )}
      </section>
    </>
  );
}

const STATUS_FILTERS = [
  { key: "", label: "All" },
  { key: "todo", label: "To do" },
  { key: "progress", label: "In progress" },
  { key: "done", label: "Completed" },
] as const;

const SETS_PAGE_SIZE = 10;

/** Math / Reading / Writing tab (mockup area.html practiceView): practice only, % correct. */
async function AreaPracticeView({
  practice,
  area,
  query,
  links,
}: {
  practice: PracticeSetItem[];
  area: PracticeAreaCode;
  query: { skill?: string; difficulty?: string; status?: string; page?: string };
  links: HomeLinks;
}) {
  const tab = tabFromPracticeArea(area)!;
  const mine = practice.filter((p) => p.area === area);
  const s = summarizeArea(practice, area);
  // Every official skill of the area, in taxonomy order (mockup: the filter lists them all).
  const official = await officialSkillsFor(area);
  const extra = [...new Map(mine.filter((p) => !official.some((o) => o.id === p.skillId)).map((p) => [p.skillId, p.skill])).entries()];
  const skills: [string, string][] = [...official.map((o) => [o.id, o.name] as [string, string]), ...extra];
  const filtered = sortPracticeSets(
    mine.filter(
      (p) =>
        (!query.skill || p.skillId === query.skill) &&
        (!query.difficulty || p.difficulty === query.difficulty) &&
        (!query.status || (query.status === "todo" ? p.state !== "done" : p.state === query.status)),
    ),
  );
  const setsPage = paginate(filtered, pageFromParam(query.page), SETS_PAGE_SIZE);
  const filterHref = (patch: Record<string, string | undefined>) => {
    const params = new URLSearchParams({ area: tab });
    const next = { skill: query.skill, difficulty: query.difficulty, status: query.status, ...patch };
    for (const [k, v] of Object.entries(next)) if (v) params.set(k, v);
    return `${links.home}?${params.toString()}#sets`;
  };
  // Last attempt by skill (attempt level, never pooled), skills A–Z.
  const bySkill = skills
    .map(([id, name]) => {
      const sets = mine.filter((p) => p.skillId === id);
      const last = sets
        .filter((p) => p.last)
        .sort((a, b) => b.last!.submittedAt.getTime() - a.last!.submittedAt.getTime())[0];
      return { id, name, pct: last?.last?.pct ?? null, setName: last?.name ?? null, assigned: sets.length > 0 };
    })
    .filter((r) => r.pct !== null || r.assigned)
    .sort((a, b) => a.name.localeCompare(b.name, "en", { numeric: true, sensitivity: "base" }));
  // Practice sets with their last attempt (same accordion as the teacher), most recently practiced first.
  const recentSets = practiceSetGroups(setsFromStudentPractice(mine)).slice(0, 4);
  const anyFilter = Boolean(query.skill || query.difficulty || query.status);

  return (
    <>
      <StatGrid cols={3}>
        <StatTile icon={<CheckCircle2 size={18} />} iconTone="ok" label="Sets completed · see them" value={<>{s.done} <span className="text-[15px] font-normal text-gray-500">of {s.total}</span></>} href={filterHref({ status: "done", page: undefined })} />
        <StatTile
          icon={<TrendingUp size={18} />}
          iconTone="info"
          label={s.latest ? `Last attempt · ${s.latest.item.name} · see history` : "Last attempt · see history"}
          value={<Pct value={s.latest?.attempt.pct ?? null} />}
          href={links.history(tab)}
        />
        <StatTile
          icon={<Clock size={18} />}
          iconTone="warn"
          label={`To do · ${s.overdue} overdue · see them`}
          value={s.todo}
          href={filterHref({ status: "todo", page: undefined })}
        />
      </StatGrid>

      <section id="sets" className="mt-6 scroll-mt-6">
        <SectionHeader
          title={`Your ${s.label} practice sets`}
          action={links.practice(tab) ? <Button asChild size="sm" variant="ghost"><Link href={links.practice(tab)!}><MapIcon size={14} /> Skills map</Link></Button> : undefined}
        />
        <FilterBar action={links.home}>
          <input type="hidden" name="area" value={tab} />
          <FilterField label="Skill" htmlFor="f-skill" className="@md:flex-[2]">
            <Select id="f-skill" name="skill" defaultValue={query.skill ?? ""}>
              <option value="">All skills</option>
              {skills.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
            </Select>
          </FilterField>
          <FilterField label="Difficulty" htmlFor="f-difficulty">
            <Select id="f-difficulty" name="difficulty" defaultValue={query.difficulty ?? ""}>
              <option value="">All levels</option>
              <option value="EASY">Easy</option>
              <option value="MEDIUM">Medium</option>
              <option value="HARD">Hard</option>
            </Select>
          </FilterField>
          <FilterField label="Status" htmlFor="f-status">
            <Select id="f-status" name="status" defaultValue={query.status ?? ""}>
              {STATUS_FILTERS.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
            </Select>
          </FilterField>
          <FilterActions clearHref={anyFilter ? `${links.home}?area=${tab}#sets` : null} />
        </FilterBar>
        {filtered.length === 0 ? (
          <EmptyState title="No practice sets match these filters." />
        ) : (
          <ListStack>
            {setsPage.items.map((item) => <PracticeSetRow key={item.assignmentId} item={item} resultHref={links.practiceResult} readOnly={links.readOnly} />)}
            <Pagination
              basePath={links.home}
              params={{ area: tab, skill: query.skill, difficulty: query.difficulty, status: query.status }}
              anchor="sets"
              pageSize={SETS_PAGE_SIZE}
              {...setsPage}
            />
          </ListStack>
        )}
      </section>

      <div className="mt-6 space-y-4">
        <Card padding="md">
          <SectionHeader title="Last attempt by skill" size="sm" action={<span className="text-xs text-gray-500">Practice only · click a skill to filter</span>} />
          {bySkill.length === 0 ? (
            <p className="text-sm text-gray-500">No practice sets in this area yet.</p>
          ) : (
            <PctBars
              rows={bySkill.map((r) => ({
                label: r.name,
                pct: r.pct,
                sub: r.setName ?? undefined,
                href: filterHref({ skill: r.id, page: undefined }),
                color: `var(--sat-area-${tab})`,
              }))}
            />
          )}
        </Card>
        <Card padding="md">
          <SectionHeader
            title={`Recent results · ${s.label}`}
            size="sm"
            action={<Link href={links.history(tab)} className="text-xs text-blue-600 hover:underline">View all</Link>}
          />
          {recentSets.length === 0 ? (
            <p className="text-sm text-gray-500">No finished {s.label} sets yet.</p>
          ) : (
            <PracticeSetAttemptsAccordion sets={recentSets} hrefFor={links.practiceResult} historyHref={links.history(tab)} />
          )}
        </Card>
      </div>
    </>
  );
}

const TEST_ROWS_PAGE_SIZE = 10;

/** Tests tab (mockup area.html testsView): pending tests, then results grouped per Test (no chart across Tests). */
function TestsTab({ tests, page, links }: { tests: StudentTestItem[]; page: number; links: HomeLinks }) {
  const { pending } = sortTests(tests);
  // One row per Test (its last try), opening to every try; no chart across different Tests.
  const groups = groupTests(tests, (a) => a.status !== "INVALIDATED");
  const rowsPage = paginate(groups, page, TEST_ROWS_PAGE_SIZE);
  return (
    <>
      <SectionHeader
        title={<span className="inline-flex items-center gap-1.5"><ClipboardList size={16} /> Pending tests</span>}
        description="Each test has 4 modules: 2 of Reading & Writing and 2 of Math."
        action={links.readOnly ? undefined : <Link href="/student/tests?view=pending" className="text-sm text-blue-600 hover:underline">All tests ›</Link>}
      />
      {pending.length === 0 ? (
        <Card padding="md" className="text-sm text-gray-500">No pending tests.</Card>
      ) : (
        <TestCardsByNumber items={pending} links={testCardLinks(links)} openPending />
      )}

      <section className="mt-6">
        <SectionHeader title="Test results" description="One row per test with its last try (SAT section scores, 200–800). Open a test to see every try." />
        {groups.length === 0 ? (
          <Card padding="md" className="text-sm text-gray-500">No tests taken yet.</Card>
        ) : (
          <>
            <TestAttemptsAccordion tests={rowsPage.items} hrefFor={links.testResult} />
            <Pagination basePath={links.home} params={{ area: "tests" }} pageSize={TEST_ROWS_PAGE_SIZE} {...rowsPage} />
          </>
        )}
      </section>

    </>
  );
}
