import Link from "next/link";
import { redirect } from "next/navigation";
import { BookOpen, CheckCircle2, ClipboardList, Clock, Map as MapIcon, TrendingUp } from "lucide-react";
import {
  AreaBoxGrid,
  Breadcrumbs,
  CompactAreaBox,
  ContinueCard,
  ChevronCell,
  EmptyState,
  LinkTr,
  PageShell,
  Pagination,
  PracticeAreaTabs,
  RowLink,
  SectionHeader,
  SimpleTable,
  StatGrid,
  StatTile,
  TD,
  TestSectionScore,
  pageFromParam,
  paginate,
} from "@/components/sat";
import { LineChart } from "@/components/sat/line-chart";
import { ListStack } from "@/components/sat/list";
import { PctBars, PracticeSetRow } from "@/components/sat/practice-set-row";
import { Pct, WorkStatusBadges } from "@/components/sat/work-status";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { refreshAssignmentStates } from "@/lib/assignments";
import { difficultyBadgeVariant, difficultyLabel, enrollmentStatusLabel } from "@/lib/domain-meta";
import {
  activeAreaTab,
  activeHomeTab,
  practiceAreaFromTab,
  practiceAreaLabel,
  tabFromPracticeArea,
  type PracticeAreaCode,
} from "@/lib/practice-area";
import { loadStudentPractice, sortPracticeSets, summarizeArea, PRACTICE_AREAS_IN_ORDER, type PracticeSetItem } from "@/lib/student-practice";
import { loadStudentTests, sortTests, type StudentTestItem } from "@/lib/test-assignments";
import { officialSkillsFor } from "@/lib/taxonomy-order";
import { loadContinueWork } from "@/lib/continue-work";
import { formatDate, relativeDay } from "@/lib/utils";
import { ParentApprovalCard } from "./parent-approval-card";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ area?: string; skill?: string; difficulty?: string; status?: string; page?: string }>;
}

/**
 * Student Home (mockup `mejorada` index.html + area.html). Tabs: Summary · Math · Reading · Writing · Tests.
 * Math/Reading/Writing show practice only (% correct, never SAT scores); Test results live in the
 * Tests tab (rule: practice and Tests are never mixed).
 */
export default async function StudentDashboard({ searchParams }: PageProps) {
  const session = await auth();
  const userId = session!.user.id;
  await refreshAssignmentStates();

  // Parents see their own dashboard with children's enrollment requests
  if (session!.user.role === "PARENT") {
    return <ParentDashboard parentId={userId} parentName={session!.user.name} />;
  }

  // Guard: only students without an active enrollment land on /student/program
  if (session!.user.role === "STUDENT") {
    const now = new Date();
    const activeEnrollment = await prisma.programEnrollment.findFirst({
      where: {
        studentId: userId,
        status: "APPROVED",
        active: true,
        program: {
          active: true,
          startDate: { lte: now },
          OR: [{ endDate: null }, { endDate: { gt: now } }],
        },
      },
    });
    if (!activeEnrollment) redirect("/student/program");
  }

  const query = await searchParams;
  const tab = activeHomeTab(query.area);
  const area = tab === "summary" ? null : activeAreaTab(tab);
  const practiceArea = area ? practiceAreaFromTab(area) : null;
  const firstName = session!.user.name.split(" ")[0];
  const [practice, tests] = await Promise.all([loadStudentPractice(userId), loadStudentTests(userId)]);
  const continueWork = tab === "summary" ? await loadContinueWork(userId, practice, tests) : null;

  return (
    <PageShell>
      {tab !== "summary" ? (
        <Breadcrumbs items={[{ label: "Home", href: "/student" }, { label: area === "tests" ? "Tests" : practiceAreaLabel(practiceArea) }]} />
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

      {tab === "summary" ? <ContinueCard work={continueWork} /> : null}

      <PracticeAreaTabs basePath="/student" active={tab} includeSummary />

      {tab === "summary" ? (
        <SummaryView practice={practice} tests={tests} />
      ) : area === "tests" ? (
        <TestsTab tests={tests} page={pageFromParam(query.page)} />
      ) : practiceArea ? (
        <AreaPracticeView practice={practice} area={practiceArea} query={query} />
      ) : null}
    </PageShell>
  );
}

/** Summary (mockup index.html): compact practice boxes, a Tests strip and the last 4 attempts. */
function SummaryView({ practice, tests }: { practice: PracticeSetItem[]; tests: StudentTestItem[] }) {
  const recentPractice = practice.flatMap((item) => item.tries.map((t) => ({ kind: "practice" as const, when: t.submittedAt, item, t })));
  const recentTests = tests.flatMap((test) =>
    test.attempts.filter((a) => a.status !== "INVALIDATED").map((a) => ({ kind: "test" as const, when: a.submittedAt ?? a.startedAt, test, a })),
  );
  const recent = [...recentPractice, ...recentTests].sort((x, y) => y.when.getTime() - x.when.getTime()).slice(0, 4);
  const latestTest = tests
    .flatMap((t) => (t.lastSubmitted ? [{ t, a: t.lastSubmitted }] : []))
    .sort((x, y) => (y.a.submittedAt?.getTime() ?? 0) - (x.a.submittedAt?.getTime() ?? 0))[0];
  const pendingTests = tests.filter((t) => t.state !== "done");
  const overdueTests = pendingTests.filter((t) => t.overdue).length;

  return (
    <>
      <SectionHeader
        title={<span className="inline-flex items-center gap-1.5"><BookOpen size={16} /> Practice</span>}
        action={<Link href="/student/practice" className="text-sm text-blue-600 hover:underline">All practice ›</Link>}
      />
      <AreaBoxGrid>
        {PRACTICE_AREAS_IN_ORDER.map((code) => {
          const s = summarizeArea(practice, code);
          return (
            <CompactAreaBox
              key={code}
              area={code}
              label={s.label}
              href={`/student?area=${tabFromPracticeArea(code)}`}
              pct={s.latest?.attempt.pct ?? null}
              line1={s.lastPracticed ? `Latest practice · ${relativeDay(s.lastPracticed)}` : "Not practiced yet"}
              delta={s.delta}
              line2={`${s.todo} set${s.todo === 1 ? "" : "s"} to do`}
            />
          );
        })}
      </AreaBoxGrid>

      <Card
        as={Link}
        href="/student?area=tests"
        padding="md"
        className="mt-6 flex flex-wrap items-center justify-between gap-3.5 border-t-[5px] border-t-[var(--sat-area-tests)] hover:border-gray-400"
      >
        <div>
          <h2 className="inline-flex items-center gap-1.5 text-base font-semibold text-gray-900"><ClipboardList size={16} /> Tests</h2>
          <p className="text-sm text-gray-500">
            {pendingTests.length} pending
            {overdueTests ? <> · <b className="text-red-600">{overdueTests} overdue</b></> : null}
          </p>
        </div>
        {latestTest ? (
          <div className="flex items-center gap-[18px]">
            <span className="text-xs text-gray-500">Latest · {latestTest.t.name}</span>
            <div>
              <p className="text-xs font-semibold text-[var(--sat-area-reading)]">R&amp;W</p>
              <b className="text-xl tabular-nums">{latestTest.a.rwScore ?? "—"}</b>
            </div>
            <div>
              <p className="text-xs font-semibold text-[var(--sat-area-math)]">Math</p>
              <b className="text-xl tabular-nums">{latestTest.a.mathScore ?? "—"}</b>
            </div>
            <span aria-hidden className="text-gray-400">›</span>
          </div>
        ) : (
          <span className="text-sm text-gray-500">No tests finished yet</span>
        )}
      </Card>

      <section className="mt-6">
        <SectionHeader title="Recent attempts" action={<Link href="/student/history" className="text-sm text-blue-600 hover:underline">View all ›</Link>} />
        {recent.length === 0 ? (
          <EmptyState title="No attempts yet" description="Your finished practice sets and Tests will appear here." />
        ) : (
          <Card className="divide-y divide-gray-100">
            {recent.map((r) => {
              const href = r.kind === "practice" ? `/student/results/${r.t.id}` : `/student/tests/results/${r.a.id}`;
              return (
                <Link key={r.kind === "practice" ? r.t.id : r.a.id} href={href} className="flex items-center justify-between gap-3 px-3 py-2.5 hover:bg-gray-50">
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
                </Link>
              );
            })}
          </Card>
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
}: {
  practice: PracticeSetItem[];
  area: PracticeAreaCode;
  query: { skill?: string; difficulty?: string; status?: string; page?: string };
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
    return `/student?${params.toString()}#sets`;
  };
  // % correct by skill: skills with sets or attempts, in taxonomy order.
  const bySkill = skills
    .map(([id, name]) => {
      const tries = mine.filter((p) => p.skillId === id).flatMap((p) => p.tries);
      const correct = tries.reduce((x, t) => x + t.correct, 0);
      const total = tries.reduce((x, t) => x + t.total, 0);
      return { id, name, pct: total ? Math.round((correct / total) * 100) : null, n: tries.length, assigned: mine.some((p) => p.skillId === id) };
    })
    .filter((r) => r.n > 0 || r.assigned);
  const recent = mine
    .flatMap((item) => item.tries.map((t) => ({ item, t })))
    .sort((a, b) => b.t.submittedAt.getTime() - a.t.submittedAt.getTime())
    .slice(0, 4);
  const anyFilter = Boolean(query.skill || query.difficulty || query.status);

  return (
    <>
      <StatGrid cols={3}>
        <StatTile icon={<CheckCircle2 size={18} />} iconTone="ok" label="Sets completed · see them" value={<>{s.done} <span className="text-[15px] font-normal text-gray-500">of {s.total}</span></>} href={filterHref({ status: "done", page: undefined })} />
        <StatTile
          icon={<TrendingUp size={18} />}
          iconTone="info"
          label={`Average correct · ${s.attempts} attempt${s.attempts === 1 ? "" : "s"} · see history`}
          value={<Pct value={s.avgPct} />}
          href={`/student/history?area=${tab}`}
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
          action={<Button asChild size="sm" variant="ghost"><Link href={`/student/practice?area=${tab}`}><MapIcon size={14} /> Skills map</Link></Button>}
        />
        <form action="/student" className="mb-3 flex flex-wrap items-end gap-2 text-sm">
          <input type="hidden" name="area" value={tab} />
          <label className="flex min-w-0 max-w-full flex-col text-xs text-gray-500">Skill
            <select name="skill" defaultValue={query.skill ?? ""} className="mt-0.5 w-full max-w-[18rem] rounded-md border border-gray-300 px-2 py-1.5 text-sm text-gray-800">
              <option value="">All skills</option>
              {skills.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
            </select>
          </label>
          <label className="flex flex-col text-xs text-gray-500">Difficulty
            <select name="difficulty" defaultValue={query.difficulty ?? ""} className="mt-0.5 rounded-md border border-gray-300 px-2 py-1.5 text-sm text-gray-800">
              <option value="">All levels</option>
              <option value="EASY">Easy</option>
              <option value="MEDIUM">Medium</option>
              <option value="HARD">Hard</option>
            </select>
          </label>
          <label className="flex flex-col text-xs text-gray-500">Status
            <select name="status" defaultValue={query.status ?? ""} className="mt-0.5 rounded-md border border-gray-300 px-2 py-1.5 text-sm text-gray-800">
              {STATUS_FILTERS.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
            </select>
          </label>
          <Button type="submit" size="sm" variant="secondary">Apply</Button>
          {anyFilter ? <Link href={`/student?area=${tab}#sets`} className="pb-1.5 text-xs text-blue-600 hover:underline">Clear filters</Link> : null}
        </form>
        {filtered.length === 0 ? (
          <EmptyState title="No practice sets match these filters." />
        ) : (
          <ListStack>
            {setsPage.items.map((item) => <PracticeSetRow key={item.assignmentId} item={item} />)}
            <Pagination
              basePath="/student"
              params={{ area: tab, skill: query.skill, difficulty: query.difficulty, status: query.status }}
              anchor="sets"
              pageSize={SETS_PAGE_SIZE}
              {...setsPage}
            />
          </ListStack>
        )}
      </section>

      <div className="mt-6 grid items-start gap-4 lg:grid-cols-2">
        <Card padding="md">
          <SectionHeader title="% correct by skill" size="sm" action={<span className="text-xs text-gray-500">Practice only · click a skill to filter</span>} />
          {bySkill.length === 0 ? (
            <p className="text-sm text-gray-500">No practice sets in this area yet.</p>
          ) : (
            <PctBars
              rows={bySkill.map((r) => ({
                label: r.name,
                pct: r.pct,
                sub: r.n ? `${r.n} attempt${r.n === 1 ? "" : "s"}` : undefined,
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
            action={<Link href={`/student/history?area=${tab}`} className="text-xs text-blue-600 hover:underline">View all</Link>}
          />
          {recent.length === 0 ? (
            <p className="text-sm text-gray-500">No finished {s.label} sets yet.</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {recent.map(({ item, t }) => (
                <li key={t.id}>
                  <Link href={`/student/results/${t.id}`} className="flex items-center justify-between gap-3 py-2 text-sm hover:bg-gray-50">
                    <span>
                      <span className="font-medium text-gray-900">{item.skill}</span>{" "}
                      <Badge variant={difficultyBadgeVariant(item.difficulty)}>{difficultyLabel(item.difficulty)}</Badge>
                      <span className="block text-xs text-gray-500">Completed {formatDate(t.submittedAt)} ({relativeDay(t.submittedAt)}) · Try {t.tryNumber}</span>
                    </span>
                    <span className="flex shrink-0 items-center gap-2 text-xs text-gray-500">
                      {t.correct} of {t.total}
                      <Pct value={t.pct} className="text-sm font-semibold" />
                      <span aria-hidden className="text-gray-400">›</span>
                    </span>
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

const TEST_ROWS_PAGE_SIZE = 10;

/** Tests tab (mockup area.html testsView): pending tests, section results, section scores chart. */
function TestsTab({ tests, page }: { tests: StudentTestItem[]; page: number }) {
  const { pending } = sortTests(tests);
  const rows = tests
    .flatMap((t) => t.attempts.filter((a) => a.status !== "INVALIDATED").map((a) => ({ t, a })))
    .sort((x, y) => (y.a.submittedAt ?? y.a.startedAt).getTime() - (x.a.submittedAt ?? x.a.startedAt).getTime());
  const rowsPage = paginate(rows, page, TEST_ROWS_PAGE_SIZE);
  const finished = rows.filter((r) => r.a.status === "SUBMITTED").reverse();
  return (
    <>
      <SectionHeader
        title={<span className="inline-flex items-center gap-1.5"><ClipboardList size={16} /> Pending tests</span>}
        description="Each test has 4 modules: 2 of Reading & Writing and 2 of Math."
        action={<Link href="/student/tests?view=pending" className="text-sm text-blue-600 hover:underline">All tests ›</Link>}
      />
      {pending.length === 0 ? (
        <Card padding="md" className="text-sm text-gray-500">No pending tests.</Card>
      ) : (
        <Card className="divide-y divide-gray-100">
          {pending.map((t) => {
            const next = t.openAttempt?.view?.nextModule ?? t.modules[0];
            const done = t.openAttempt?.view?.modulesDone ?? 0;
            return (
              <Link key={t.assignmentId} href={`/student/tests/${t.assignmentId}?module=${next?.key ?? "rw1"}`} className="flex items-center justify-between gap-3 px-3 py-2.5 hover:bg-gray-50">
                <span className="flex min-w-0 flex-wrap items-center gap-1.5">
                  <b className="text-sm text-gray-900">{t.name}</b>
                  <WorkStatusBadges state={t.state} overdue={t.overdue} />
                  <span className="text-xs text-gray-500">{done} of 4 modules{t.dueDate ? ` · due ${formatDate(t.dueDate)}` : ""}</span>
                </span>
                <span className="shrink-0 rounded-md bg-blue-600 px-3 py-1 text-xs font-medium text-white">{t.openAttempt ? "Continue" : "Start"}</span>
              </Link>
            );
          })}
        </Card>
      )}

      <section className="mt-6">
        <SectionHeader title="Test results" description="SAT section scores (200–800) for each test. Click a row to see your answers." />
        {rows.length === 0 ? (
          <Card padding="md" className="text-sm text-gray-500">No tests taken yet.</Card>
        ) : (
          <>
            <SimpleTable
              head={[
                "Date",
                "Test",
                "Attempt",
                <span key="rw" className="text-[var(--sat-area-reading)]">Reading &amp; Writing</span>,
                <span key="m" className="text-[var(--sat-area-math)]">Math</span>,
                "",
              ]}
            >
              {rowsPage.items.map(({ t, a }) => (
                <LinkTr key={a.id}>
                  <td className={TD}>
                    <b className="font-medium text-gray-800">{formatDate(a.submittedAt ?? a.startedAt)}</b>
                    <span className="block text-xs text-gray-400">{relativeDay(a.submittedAt ?? a.startedAt)}</span>
                  </td>
                  <td className={TD}><RowLink href={`/student/tests/results/${a.id}`}>{t.name}</RowLink> {a.status === "IN_PROGRESS" ? <Badge variant="warning">In progress</Badge> : null}</td>
                  <td className={TD}>Try {a.tryNumber}</td>
                  <td className={TD}><TestSectionScore attempt={a} section="RW" /></td>
                  <td className={TD}><TestSectionScore attempt={a} section="MATH" /></td>
                  <ChevronCell />
                </LinkTr>
              ))}
            </SimpleTable>
            <Pagination basePath="/student" params={{ area: "tests" }} pageSize={TEST_ROWS_PAGE_SIZE} {...rowsPage} />
          </>
        )}
      </section>

      {finished.length > 1 ? (
        <Card padding="md" className="mt-6 max-w-[640px]">
          <SectionHeader size="sm" title="Section scores over time" description="Each section is scored 200–800" />
          <LineChart
            title="Section scores over time"
            min={200}
            max={800}
            labels={finished.map(({ t, a }) => `${t.name.replace(/^TEST\s*/i, "T")} · ${a.tryNumber}`)}
            series={[
              { name: "Reading & Writing", color: "var(--sat-area-reading)", values: finished.map(({ a }) => a.rwScore) },
              { name: "Math", color: "var(--sat-area-math)", values: finished.map(({ a }) => a.mathScore), dashed: true },
            ]}
          />
        </Card>
      ) : null}
    </>
  );
}

// ─── Parent Dashboard ─────────────────────────────────────────────────────────

async function ParentDashboard({ parentId, parentName }: { parentId: string; parentName: string }) {
  const children = await prisma.parentStudent.findMany({
    where: { parentId },
    include: {
      student: {
        select: {
          id: true,
          name: true,
          email: true,
          active: true,
          programEnrollments: {
            include: { program: { select: { id: true, name: true } } },
            orderBy: { enrolledAt: "desc" },
          },
        },
      },
    },
  });

  const pendingApprovals = children.flatMap((link) =>
    link.student.programEnrollments
      .filter((e) => e.parentApprovalStatus === "PENDING")
      .map((e) => ({ student: link.student, enrollment: e }))
  );

  return (
    <PageShell width="narrow">
      <div className="mb-6">
        <h1 className="text-[26px] font-bold tracking-[-0.3px] text-gray-900">
          Hello, {parentName.split(" ")[0]}!
        </h1>
        <p className="mt-0.5 text-sm text-gray-500">Parent dashboard</p>
      </div>

      {pendingApprovals.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 text-base font-semibold text-gray-900">
            Waiting for your approval
          </h2>
          <div className="space-y-3">
            {pendingApprovals.map(({ student, enrollment }) => (
              <ParentApprovalCard
                key={`${enrollment.programId}-${student.id}`}
                student={student}
                enrollment={enrollment}
              />
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="mb-3 text-base font-semibold text-gray-900">Your children</h2>
        {children.length === 0 ? (
          <p className="text-sm text-gray-400">No students are linked to your account yet.</p>
        ) : (
          <div className="space-y-3">
            {children.map((link) => (
              <Card key={link.student.id} className="px-4 py-3">
                <p className="text-sm font-medium text-gray-900">{link.student.name}</p>
                <p className="mt-0.5 text-xs text-gray-500">{link.student.email}</p>
                {link.student.programEnrollments.length > 0 ? (
                  <div className="mt-2 space-y-1">
                    {link.student.programEnrollments.map((e) => (
                      <div key={e.programId} className="flex items-center gap-2 text-xs">
                        <span className="text-gray-600">{e.program.name}</span>
                        <span
                          className={`font-medium ${
                            e.status === "APPROVED"
                              ? "text-green-600"
                              : e.status === "PENDING"
                                ? "text-amber-600"
                                : "text-red-500"
                          }`}
                        >
                          {enrollmentStatusLabel(e.status)}
                        </span>
                        {e.parentApprovalStatus === "PENDING" && (
                          <span className="text-amber-500">· waiting for your OK</span>
                        )}
                        {e.parentApprovalStatus === "APPROVED" && (
                          <span className="text-green-500">· you approved</span>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-1 text-xs text-gray-400">Not in any program yet.</p>
                )}
              </Card>
            ))}
          </div>
        )}
      </section>
    </PageShell>
  );
}
