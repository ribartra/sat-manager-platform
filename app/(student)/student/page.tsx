import Link from "next/link";
import { redirect } from "next/navigation";
import { CheckCircle2, Clock, TrendingUp } from "lucide-react";
import {
  AreaPracticeRow,
  AreaSummaryCard,
  Breadcrumbs,
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
  TestAttemptResultCell,
  TestSectionScore,
  TestTotalCell,
  pageFromParam,
  paginate,
  studentAreaCardProps,
} from "@/components/sat";
import { Alert } from "@/components/sat/alert";
import { AreaTag, PctBars, PracticeSetRow } from "@/components/sat/practice-set-row";
import { Pct } from "@/components/sat/work-status";
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
import { formatDate, relativeDay } from "@/lib/utils";
import { ParentApprovalCard } from "./parent-approval-card";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ area?: string; skill?: string; difficulty?: string; status?: string; page?: string }>;
}

/**
 * Student Home (mockup index.html + area.html). Tabs: Summary · Math · Reading · Writing · Tests.
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
  const { pending: pendingTests } = sortTests(tests);

  return (
    <PageShell>
      <div className="mb-4">
        <h1 className="text-2xl font-semibold text-gray-900">Hello, {firstName}!</h1>
        <p className="mt-0.5 text-sm text-gray-500">
          {tab === "summary"
            ? `Today is ${new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}.`
            : area === "tests"
              ? "Your results in full-length SAT Tests."
              : `Your ${practiceAreaLabel(practiceArea)} practice.`}
        </p>
      </div>

      <PracticeAreaTabs basePath="/student" active={tab} includeSummary />

      {pendingTests.length > 0 && tab === "summary" ? <PendingTestsBanner tests={pendingTests} /> : null}

      {tab === "summary" ? (
        <SummaryView practice={practice} tests={tests} />
      ) : area === "tests" ? (
        <TestsTab tests={tests} />
      ) : practiceArea ? (
        <AreaPracticeView practice={practice} area={practiceArea} query={query} />
      ) : null}
    </PageShell>
  );
}

function PendingTestsBanner({ tests }: { tests: StudentTestItem[] }) {
  const overdue = tests.some((t) => t.overdue);
  return (
    <Alert
      tone={overdue ? "warning" : "info"}
      className="mb-5"
      action={
        <Button asChild size="sm" variant="secondary">
          <Link href="/student/tests?view=pending">See pending tests ›</Link>
        </Button>
      }
    >
      Pending tests:{" "}
      {tests.map((t, i) => (
        <span key={t.assignmentId}>
          {i > 0 ? " · " : ""}
          <Link href={`/student/tests?view=pending#test-${t.assignmentId}`} className="font-medium underline">{t.name}</Link>{" "}
          ({t.state === "progress" ? "in progress" : t.dueDate ? `due ${formatDate(t.dueDate)}${t.overdue ? ", overdue" : ""}` : "no due date"})
        </span>
      ))}
    </Alert>
  );
}

const AREA_TAB_HREF = (area: PracticeAreaCode) => `/student?area=${tabFromPracticeArea(area)}`;

function SummaryView({ practice, tests }: { practice: PracticeSetItem[]; tests: StudentTestItem[] }) {
  const recentPractice = practice.flatMap((item) => item.tries.map((t) => ({ kind: "practice" as const, when: t.submittedAt, item, t })));
  const recentTests = tests.flatMap((test) =>
    test.attempts.filter((a) => a.status !== "INVALIDATED").map((a) => ({ kind: "test" as const, when: a.submittedAt ?? a.startedAt, test, a })),
  );
  const recent = [...recentPractice, ...recentTests].sort((x, y) => y.when.getTime() - x.when.getTime()).slice(0, 6);
  const latestTest = tests
    .flatMap((t) => (t.lastSubmitted ? [{ t, a: t.lastSubmitted }] : []))
    .sort((x, y) => (y.a.submittedAt?.getTime() ?? 0) - (x.a.submittedAt?.getTime() ?? 0))[0];
  const todo = sortPracticeSets(practice.filter((p) => p.state !== "done"));

  return (
    <>
      <div className="grid gap-4 md:grid-cols-3">
        {PRACTICE_AREAS_IN_ORDER.map((area) => {
          const s = summarizeArea(practice, area);
          return <AreaSummaryCard key={area} {...studentAreaCardProps(s, AREA_TAB_HREF(area), `Open ${s.label}`)} />;
        })}
      </div>

      <section className="mt-6">
        <SectionHeader
          title="Recent attempts"
          description="Your latest practice sets and Tests"
          action={<Link href="/student/history" className="text-sm text-blue-600 hover:underline">View all ›</Link>}
        />
        {recent.length === 0 ? (
          <EmptyState title="No attempts yet" description="Your finished practice sets and Tests will appear here." />
        ) : (
          <SimpleTable head={["Date", "Activity", "Type", "Attempt", "Result", ""]}>
            {recent.map((r) =>
              r.kind === "practice" ? (
                <LinkTr key={r.t.id}>
                  <td className={`${TD} text-gray-600`}>{formatDate(r.when)}<span className="block text-xs text-gray-400">Completed {relativeDay(r.when)}</span></td>
                  <td className={TD}><RowLink href={`/student/results/${r.t.id}`}>{r.item.skill}</RowLink> <Badge variant={difficultyBadgeVariant(r.item.difficulty)}>{difficultyLabel(r.item.difficulty)}</Badge></td>
                  <td className={TD}><Badge>Practice</Badge> <AreaTag area={r.item.area} /></td>
                  <td className={TD}>Try {r.t.tryNumber}</td>
                  <td className={TD}>{r.t.correct} of {r.t.total} · <Pct value={r.t.pct} className="font-semibold" /></td>
                  <ChevronCell />
                </LinkTr>
              ) : (
                <LinkTr key={r.a.id}>
                  <td className={`${TD} text-gray-600`}>{formatDate(r.when)}<span className="block text-xs text-gray-400">{r.a.status === "IN_PROGRESS" ? "Started" : "Completed"} {relativeDay(r.when)}</span></td>
                  <td className={TD}><RowLink href={`/student/tests/results/${r.a.id}`}>{r.test.name}</RowLink> {r.a.status === "IN_PROGRESS" ? <Badge variant="warning">In progress</Badge> : null}</td>
                  <td className={TD}><Badge variant="test">Test</Badge></td>
                  <td className={TD}>Try {r.a.tryNumber}</td>
                  <td className={TD}><TestAttemptResultCell attempt={r.a} /></td>
                  <ChevronCell />
                </LinkTr>
              ),
            )}
          </SimpleTable>
        )}
      </section>

      <div className="mt-6 grid items-start gap-4 lg:grid-cols-[1fr_2fr]">
        <Card as={Link} href="/student?area=tests" padding="md" className="border-t-[6px] border-t-[var(--sat-area-tests)] hover:border-gray-400">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Tests</h2>
            <span aria-hidden className="text-gray-400">›</span>
          </div>
          {latestTest ? (
            <>
              <p className="text-xs text-gray-500">Latest test · {latestTest.t.name} · {formatDate(latestTest.a.submittedAt!)}</p>
              <p className="mt-1 text-4xl font-bold leading-none text-gray-900">{latestTest.a.totalScore ?? "—"}<span className="ml-1 text-sm font-normal text-gray-500">/ 1600</span></p>
              <p className="mt-1 text-xs text-gray-600">Reading &amp; Writing <b>{latestTest.a.rwScore ?? "—"}</b> · Math <b>{latestTest.a.mathScore ?? "—"}</b></p>
            </>
          ) : (
            <p className="mt-1 text-sm text-gray-500">No Test finished yet.</p>
          )}
          <p className="mt-2 text-xs text-gray-500">
            {tests.filter((t) => t.state !== "done").length} to take · {tests.filter((t) => t.lastSubmitted).length} completed
          </p>
        </Card>

        <Card padding="md" className="bg-gray-50">
          <SectionHeader
            title="Skill practice"
            description="Practice sets by skill"
            action={<Button asChild size="sm" variant="secondary"><Link href="/student/practice">Go to practice ›</Link></Button>}
          />
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1">
              {PRACTICE_AREAS_IN_ORDER.map((area) => {
                const s = summarizeArea(practice, area);
                return <AreaPracticeRow key={area} area={area} avgPct={s.avgPct} todo={s.todo} href={`/student/practice?area=${tabFromPracticeArea(area)}`} />;
              })}
            </div>
            <div>
              {todo.length === 0 ? (
                <p className="text-sm text-gray-500">Nothing pending. Great job!</p>
              ) : (
                <ul className="divide-y divide-gray-200">
                  {todo.slice(0, 3).map((item) => (
                    <li key={item.assignmentId}>
                      <Link href={`/student/practice/assignment/${item.assignmentId}`} className="block py-2 text-sm hover:underline">
                        <span className="flex flex-wrap items-center gap-2">
                          <AreaTag area={item.area} />
                          <span className="font-medium text-gray-900">{item.skill}</span>
                          <Badge variant={difficultyBadgeVariant(item.difficulty)}>{difficultyLabel(item.difficulty)}</Badge>
                          {item.overdue ? <Badge variant="danger">Overdue</Badge> : item.state === "progress" ? <Badge variant="warning">In progress</Badge> : null}
                        </span>
                        {item.dueDate ? <span className="text-xs text-gray-500">Due {formatDate(item.dueDate)} ({relativeDay(item.dueDate)})</span> : null}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
              {todo.length > 3 ? (
                <Link href="/student/practice" className="mt-1 inline-block text-xs text-blue-600 hover:underline">+ {todo.length - 3} more practice sets</Link>
              ) : null}
            </div>
          </div>
        </Card>
      </div>
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
  const bySkill = skills.map(([id, name]) => {
    const tries = mine.filter((p) => p.skillId === id).flatMap((p) => p.tries);
    const correct = tries.reduce((x, t) => x + t.correct, 0);
    const total = tries.reduce((x, t) => x + t.total, 0);
    return { id, name, pct: total ? Math.round((correct / total) * 100) : null, n: tries.length, assigned: mine.some((p) => p.skillId === id) };
  });
  const recent = mine
    .flatMap((item) => item.tries.map((t) => ({ item, t })))
    .sort((a, b) => b.t.submittedAt.getTime() - a.t.submittedAt.getTime())
    .slice(0, 4);
  const anyFilter = Boolean(query.skill || query.difficulty || query.status);

  return (
    <>
      <Breadcrumbs items={[{ label: "Home", href: "/student" }, { label: s.label }]} />
      <SectionHeader
        title={`${s.label} skill practice`}
        description="Optional practice sets assigned by your teacher, by skill. Results are % correct; Tests are scored separately."
      />
      <StatGrid cols={3}>
        <StatTile icon={<CheckCircle2 size={18} />} label="Sets completed" value={`${s.done} of ${s.total}`} sub="see them" href={filterHref({ status: "done", page: undefined })} />
        <StatTile
          icon={<TrendingUp size={18} />}
          label="Average score"
          value={<Pct value={s.avgPct} />}
          sub={`${s.attempts} attempt${s.attempts === 1 ? "" : "s"} · see history`}
          href={`/student/history?area=${tab}`}
        />
        <StatTile
          icon={<Clock size={18} />}
          tone={s.overdue ? "danger" : "default"}
          label="To do"
          value={s.todo}
          sub={`${s.overdue} overdue · see them`}
          href={filterHref({ status: "todo", page: undefined })}
        />
      </StatGrid>

      <section id="sets" className="mt-6 scroll-mt-6">
        <SectionHeader
          title="Your practice sets"
          description={`${filtered.length} set${filtered.length === 1 ? "" : "s"} · in progress first, then by due date`}
          action={<Button asChild size="sm" variant="secondary"><Link href={`/student/practice?area=${tab}`}>Open content map</Link></Button>}
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
          <Card padding="md" className="py-1">
            {setsPage.items.map((item) => <PracticeSetRow key={item.assignmentId} item={item} />)}
            <Pagination
              basePath="/student"
              params={{ area: tab, skill: query.skill, difficulty: query.difficulty, status: query.status }}
              anchor="sets"
              pageSize={SETS_PAGE_SIZE}
              {...setsPage}
            />
          </Card>
        )}
      </section>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card padding="md">
          <SectionHeader title="Score by skill" size="sm" description="% correct in your practice sets · click a skill to filter your sets" />
          {bySkill.length === 0 ? (
            <p className="text-sm text-gray-500">No skills in this area yet.</p>
          ) : (
            <PctBars
              rows={bySkill.map((r) => ({
                label: r.name,
                pct: r.pct,
                sub: r.n ? `${r.n} attempt${r.n === 1 ? "" : "s"}` : r.assigned ? "not finished yet" : "not assigned",
                href: r.assigned ? filterHref({ skill: r.id, page: undefined }) : undefined,
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
                    <span className="shrink-0 text-right text-xs text-gray-500">{t.correct} of {t.total}<Pct value={t.pct} className="block text-sm font-semibold" /></span>
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

function TestsTab({ tests }: { tests: StudentTestItem[] }) {
  const { pending } = sortTests(tests);
  const rows = tests
    .flatMap((t) => t.attempts.filter((a) => a.status !== "INVALIDATED").map((a) => ({ t, a })))
    .sort((x, y) => (y.a.submittedAt ?? y.a.startedAt).getTime() - (x.a.submittedAt ?? x.a.startedAt).getTime());
  const submitted = rows.filter((r) => r.a.status === "SUBMITTED");
  const best = (key: "rwScore" | "mathScore" | "totalScore") =>
    submitted.reduce<number | null>((m, r) => (r.a[key] !== null && (m === null || r.a[key]! > m) ? r.a[key] : m), null);
  return (
    <>
      <Breadcrumbs items={[{ label: "Home", href: "/student" }, { label: "Tests" }]} />
      <p className="mb-4 text-sm text-gray-600">
        Tests use SAT scores: each section (Reading &amp; Writing, Math) is scored 200–800 when both of its modules are done; the total (400–1600) needs all 4 modules.
      </p>
      <StatGrid cols={4}>
        <StatTile label="Tests to take" value={pending.length} sub={`${pending.filter((t) => t.state === "progress").length} in progress · ${pending.filter((t) => t.overdue).length} overdue`} href="/student/tests?view=pending" />
        <StatTile label="Tests completed" value={tests.filter((t) => t.lastSubmitted).length} href="/student/tests?view=completed" />
        <StatTile label="Best Reading & Writing" value={best("rwScore") ?? "—"} sub="out of 800" />
        <StatTile label="Best Math" value={best("mathScore") ?? "—"} sub="out of 800" />
      </StatGrid>
      <SectionHeader
        className="mt-6"
        title="Your Test attempts"
        action={<Button asChild size="sm"><Link href="/student/tests">Go to Tests ›</Link></Button>}
      />
      {rows.length === 0 ? (
        <EmptyState title="No Test attempts yet" description="Start a Test from the Tests page." />
      ) : (
        <SimpleTable head={["Date", "Test", "Attempt", "Reading & Writing", "Math", "Total", ""]}>
          {rows.map(({ t, a }) => (
            <LinkTr key={a.id}>
              <td className={`${TD} text-gray-600`}>
                {formatDate(a.submittedAt ?? a.startedAt)}
                <span className="block text-xs text-gray-400">{a.submittedAt ? "Completed" : "Started"} {relativeDay(a.submittedAt ?? a.startedAt)}</span>
              </td>
              <td className={TD}><RowLink href={`/student/tests/results/${a.id}`}>{t.name}</RowLink> {a.status === "IN_PROGRESS" ? <Badge variant="warning">In progress</Badge> : null}</td>
              <td className={TD}>Try {a.tryNumber} of {t.attempts.length}</td>
              <td className={TD}><TestSectionScore attempt={a} section="RW" /></td>
              <td className={TD}><TestSectionScore attempt={a} section="MATH" /></td>
              <td className={TD}><TestTotalCell attempt={a} /></td>
              <ChevronCell />
            </LinkTr>
          ))}
        </SimpleTable>
      )}
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
        <h1 className="text-2xl font-semibold text-gray-900">
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
