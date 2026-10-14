import Link from "next/link";
import { redirect } from "next/navigation";
import { EmptyState, PageShell, PracticeAreaTabs } from "@/components/sat";
import { Alert } from "@/components/sat/alert";
import { AreaTag, PctBars, PracticeSetRow } from "@/components/sat/practice-set-row";
import { Pct } from "@/components/sat/work-status";
import { SectionCell } from "@/components/sat/test-ui";
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
import { formatDate, relativeDay } from "@/lib/utils";
import { ParentApprovalCard } from "./parent-approval-card";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ area?: string; skill?: string; difficulty?: string; status?: string }>;
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

      {pendingTests.length > 0 && area !== "tests" ? <PendingTestsBanner tests={pendingTests} /> : null}

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
          const tab = tabFromPracticeArea(area)!;
          return (
            <Card
              as={Link}
              key={area}
              href={AREA_TAB_HREF(area)}
              padding="md"
              className="flex min-h-[15rem] flex-col gap-2 border-t-4 hover:border-gray-400"
              style={{ borderTopColor: `var(--sat-area-${tab})` }}
            >
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold" style={{ color: `var(--sat-area-${tab})` }}>{s.label}</h2>
                <span aria-hidden className="text-gray-400">›</span>
              </div>
              {s.latest ? (
                <div>
                  <p className="text-xs text-gray-500">Latest practice · {s.latest.item.skill} · {formatDate(s.latest.attempt.submittedAt)}</p>
                  <p className="mt-1 flex items-end gap-2">
                    <Pct value={s.latest.attempt.pct} className="text-4xl font-bold leading-none" />
                    <span className="text-xs text-gray-500">{s.latest.attempt.correct} of {s.latest.attempt.total} correct</span>
                  </p>
                  {s.delta !== null ? (
                    <p className={`mt-1 text-xs ${s.delta >= 0 ? "text-green-700" : "text-red-600"}`}>
                      {s.delta >= 0 ? "▲" : "▼"} {Math.abs(s.delta)} points vs. previous practice
                    </p>
                  ) : null}
                </div>
              ) : (
                <p className="text-sm text-gray-500">No {s.label} practice finished yet.</p>
              )}
              <div className="flex flex-wrap gap-1.5 text-xs">
                <span className="rounded-md bg-gray-100 px-2 py-1">Completed <b>{s.done} of {s.total}</b></span>
                <span className="rounded-md bg-gray-100 px-2 py-1">To do <b>{s.todo}</b></span>
                <span className={`rounded-md px-2 py-1 ${s.overdue ? "bg-red-50 text-red-700" : "bg-gray-100"}`}>Overdue <b>{s.overdue}</b></span>
              </div>
              {s.weakest ? <p className="text-xs text-gray-600">Weakest skill: <b>{s.weakest.skill}</b> ({s.weakest.pct}%)</p> : null}
              <div className="mt-auto flex items-center justify-between border-t border-gray-100 pt-2 text-xs text-gray-500">
                <span>{s.lastPracticed ? `Last practiced ${relativeDay(s.lastPracticed)}` : "Not practiced yet"}</span>
                <span className="font-medium text-blue-600">Open {s.label}</span>
              </div>
            </Card>
          );
        })}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_1.4fr]">
        <Card as={Link} href="/student?area=tests" padding="md" className="border-t-4 border-t-[var(--sat-area-tests)] hover:border-gray-400">
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
            {tests.filter((t) => t.state !== "done").length} to take · {tests.filter((t) => t.state === "done").length} completed
          </p>
        </Card>

        <Card padding="md" className="bg-gray-50">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-gray-900">Skill practice</h2>
              <p className="text-xs text-gray-500">Practice sets to do next</p>
            </div>
            <Button asChild size="sm" variant="secondary"><Link href="/student/practice">Go to practice ›</Link></Button>
          </div>
          {todo.length === 0 ? (
            <p className="mt-3 text-sm text-gray-500">Nothing pending. Great job!</p>
          ) : (
            <ul className="mt-2 divide-y divide-gray-200">
              {todo.slice(0, 3).map((item) => (
                <li key={item.assignmentId}>
                  <Link href={`/student/practice/assignment/${item.assignmentId}`} className="flex flex-wrap items-center gap-2 py-2 text-sm hover:underline">
                    <AreaTag area={item.area} />
                    <span className="font-medium text-gray-900">{item.skill}</span>
                    <Badge variant={difficultyBadgeVariant(item.difficulty)}>{difficultyLabel(item.difficulty)}</Badge>
                    {item.overdue ? <Badge variant="danger">Overdue</Badge> : item.state === "progress" ? <Badge variant="warning">In progress</Badge> : null}
                    {item.dueDate ? <span className="text-xs text-gray-500">Due {formatDate(item.dueDate)} ({relativeDay(item.dueDate)})</span> : null}
                  </Link>
                </li>
              ))}
            </ul>
          )}
          {todo.length > 3 ? (
            <Link href="/student/practice" className="mt-1 inline-block text-xs text-blue-600 hover:underline">+ {todo.length - 3} more practice sets</Link>
          ) : null}
        </Card>
      </div>

      <section className="mt-6">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900">Recent attempts</h2>
          <Link href="/student/history" className="text-sm text-blue-600 hover:underline">View all ›</Link>
        </div>
        {recent.length === 0 ? (
          <EmptyState title="No attempts yet" description="Your finished practice sets and Tests will appear here." />
        ) : (
          <Card className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs text-gray-500">
                <tr>
                  <th className="px-4 py-2">Date</th>
                  <th className="px-4 py-2">Activity</th>
                  <th className="px-4 py-2">Type</th>
                  <th className="px-4 py-2">Attempt</th>
                  <th className="px-4 py-2">Result</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {recent.map((r) =>
                  r.kind === "practice" ? (
                    <tr key={r.t.id} className="hover:bg-gray-50">
                      <td className="px-4 py-2 text-gray-600">{formatDate(r.when)}<span className="block text-xs text-gray-400">Completed {relativeDay(r.when)}</span></td>
                      <td className="px-4 py-2"><Link href={`/student/results/${r.t.id}`} className="font-medium text-gray-900 hover:underline">{r.item.skill}</Link> <Badge variant={difficultyBadgeVariant(r.item.difficulty)}>{difficultyLabel(r.item.difficulty)}</Badge></td>
                      <td className="px-4 py-2"><Badge>Practice</Badge> <AreaTag area={r.item.area} /></td>
                      <td className="px-4 py-2">Try {r.t.tryNumber}</td>
                      <td className="px-4 py-2">{r.t.correct} of {r.t.total} · <Pct value={r.t.pct} className="font-semibold" /></td>
                    </tr>
                  ) : (
                    <tr key={r.a.id} className="hover:bg-gray-50">
                      <td className="px-4 py-2 text-gray-600">{formatDate(r.when)}<span className="block text-xs text-gray-400">{r.a.status === "IN_PROGRESS" ? "Started" : "Completed"} {relativeDay(r.when)}</span></td>
                      <td className="px-4 py-2"><Link href={`/student/tests/results/${r.a.id}`} className="font-medium text-gray-900 hover:underline">{r.test.name}</Link> {r.a.status === "IN_PROGRESS" ? <Badge variant="warning">In progress</Badge> : null}</td>
                      <td className="px-4 py-2"><Badge className="bg-gray-900 text-white">Test</Badge></td>
                      <td className="px-4 py-2">Try {r.a.tryNumber}</td>
                      <td className="px-4 py-2">
                        {r.a.view ? (
                          <span className="text-xs text-gray-500">{r.a.view.modulesDone} of 4 modules done</span>
                        ) : (
                          <><b>{r.a.totalScore ?? "—"}</b> <span className="text-xs text-gray-500">R&amp;W {r.a.rwScore ?? "—"} · Math {r.a.mathScore ?? "—"}</span></>
                        )}
                      </td>
                    </tr>
                  ),
                )}
              </tbody>
            </table>
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

function AreaPracticeView({
  practice,
  area,
  query,
}: {
  practice: PracticeSetItem[];
  area: PracticeAreaCode;
  query: { skill?: string; difficulty?: string; status?: string };
}) {
  const tab = tabFromPracticeArea(area)!;
  const mine = practice.filter((p) => p.area === area);
  const s = summarizeArea(practice, area);
  const skills = [...new Map(mine.map((p) => [p.skillId, p.skill])).entries()].sort((a, b) => a[1].localeCompare(b[1]));
  const filtered = sortPracticeSets(
    mine.filter(
      (p) =>
        (!query.skill || p.skillId === query.skill) &&
        (!query.difficulty || p.difficulty === query.difficulty) &&
        (!query.status || (query.status === "todo" ? p.state !== "done" : p.state === query.status)),
    ),
  );
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
    return { id, name, pct: total ? Math.round((correct / total) * 100) : null, n: tries.length };
  });
  const recent = mine
    .flatMap((item) => item.tries.map((t) => ({ item, t })))
    .sort((a, b) => b.t.submittedAt.getTime() - a.t.submittedAt.getTime())
    .slice(0, 4);
  const anyFilter = Boolean(query.skill || query.difficulty || query.status);

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-3">
        <Card as={Link} href={filterHref({ status: "done" })} padding="md" className="hover:border-gray-400">
          <p className="text-2xl font-semibold text-gray-900">{s.done} of {s.total}</p>
          <p className="text-xs text-gray-500">Sets completed · see them</p>
        </Card>
        <Card as={Link} href={`/student/history?area=${tab}`} padding="md" className="hover:border-gray-400">
          <p className="text-2xl font-semibold"><Pct value={s.avgPct} /></p>
          <p className="text-xs text-gray-500">Average score · {s.attempts} attempt{s.attempts === 1 ? "" : "s"} · see history</p>
        </Card>
        <Card as={Link} href={filterHref({ status: "todo" })} padding="md" className="hover:border-gray-400">
          <p className="text-2xl font-semibold text-gray-900">{s.todo}</p>
          <p className="text-xs text-gray-500">To do · {s.overdue} overdue · see them</p>
        </Card>
      </div>

      <section id="sets" className="mt-6 scroll-mt-20">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-semibold text-gray-900">Your practice sets</h2>
          <Button asChild size="sm" variant="secondary"><Link href={`/student/practice?area=${tab}`}>Open skills map</Link></Button>
        </div>
        <form action="/student" className="mb-3 flex flex-wrap items-end gap-2 text-sm">
          <input type="hidden" name="area" value={tab} />
          <label className="flex flex-col text-xs text-gray-500">Skill
            <select name="skill" defaultValue={query.skill ?? ""} className="mt-0.5 rounded-md border border-gray-300 px-2 py-1.5 text-sm text-gray-800">
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
            {filtered.map((item) => <PracticeSetRow key={item.assignmentId} item={item} />)}
          </Card>
        )}
      </section>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card padding="md">
          <h2 className="text-sm font-semibold text-gray-900">Score by skill</h2>
          <p className="mb-3 text-xs text-gray-500">Click a skill to filter your sets</p>
          {bySkill.length === 0 ? (
            <p className="text-sm text-gray-500">No sets in this area yet.</p>
          ) : (
            <PctBars
              rows={bySkill
                .sort((a, b) => (a.pct ?? 101) - (b.pct ?? 101))
                .map((r) => ({ label: r.name, pct: r.pct, sub: `${r.n} attempt${r.n === 1 ? "" : "s"}`, href: filterHref({ skill: r.id }), color: `var(--sat-area-${tab})` }))}
            />
          )}
        </Card>
        <Card padding="md">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-900">Recent results · {s.label}</h2>
            <Link href={`/student/history?area=${tab}`} className="text-xs text-blue-600 hover:underline">View all</Link>
          </div>
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
  const { pending, done } = sortTests(tests);
  const rows = tests
    .flatMap((t) => t.attempts.filter((a) => a.status !== "INVALIDATED").map((a) => ({ t, a })))
    .sort((x, y) => (y.a.submittedAt ?? y.a.startedAt).getTime() - (x.a.submittedAt ?? x.a.startedAt).getTime());
  const submitted = rows.filter((r) => r.a.status === "SUBMITTED");
  const best = (key: "rwScore" | "mathScore" | "totalScore") =>
    submitted.reduce<number | null>((m, r) => (r.a[key] !== null && (m === null || r.a[key]! > m) ? r.a[key] : m), null);
  return (
    <>
      <p className="mb-4 text-sm text-gray-600">
        Tests use SAT scores: each section (Reading &amp; Writing, Math) is scored 200–800 when both of its modules are done; the total (400–1600) needs all 4 modules.
      </p>
      <div className="grid gap-3 sm:grid-cols-4">
        <Card padding="md"><p className="text-xs text-gray-500">Tests to take</p><p className="mt-1 text-2xl font-semibold">{pending.length}</p></Card>
        <Card padding="md"><p className="text-xs text-gray-500">Tests completed</p><p className="mt-1 text-2xl font-semibold">{done.length}</p></Card>
        <Card padding="md"><p className="text-xs text-gray-500">Best Reading &amp; Writing</p><p className="mt-1 text-2xl font-semibold">{best("rwScore") ?? "—"}</p></Card>
        <Card padding="md"><p className="text-xs text-gray-500">Best Math</p><p className="mt-1 text-2xl font-semibold">{best("mathScore") ?? "—"}</p></Card>
      </div>
      <div className="mb-2 mt-6 flex items-center justify-between">
        <h2 className="text-base font-semibold text-gray-900">Your Test attempts</h2>
        <Button asChild size="sm"><Link href="/student/tests">Go to Tests ›</Link></Button>
      </div>
      {rows.length === 0 ? (
        <EmptyState title="No Test attempts yet" description="Start a Test from the Tests page." />
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs text-gray-500">
              <tr><th className="px-4 py-2">Date</th><th className="px-4 py-2">Test</th><th className="px-4 py-2">Attempt</th><th className="px-4 py-2">Reading &amp; Writing</th><th className="px-4 py-2">Math</th><th className="px-4 py-2">Total</th></tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map(({ t, a }) => (
                <tr key={a.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2 text-gray-600">{formatDate(a.submittedAt ?? a.startedAt)}</td>
                  <td className="px-4 py-2"><Link href={`/student/tests/results/${a.id}`} className="font-medium text-gray-900 hover:underline">{t.name}</Link> {a.status === "IN_PROGRESS" ? <Badge variant="warning">In progress</Badge> : null}</td>
                  <td className="px-4 py-2">Try {a.tryNumber} of {t.attempts.length}</td>
                  <td className="px-4 py-2">{a.view ? <SectionCell section={a.view.sections.RW} /> : a.rwScore ?? "—"}</td>
                  <td className="px-4 py-2">{a.view ? <SectionCell section={a.view.sections.MATH} /> : a.mathScore ?? "—"}</td>
                  <td className="px-4 py-2 font-semibold">{a.view ? <span className="text-xs font-normal text-gray-400">Not available until all modules are done</span> : a.totalScore ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
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
