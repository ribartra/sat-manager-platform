import Link from "next/link";
import { redirect } from "next/navigation";
import { Lock } from "lucide-react";
import { EmptyState, PageShell, PracticeAreaTabs } from "@/components/sat";
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
import { cn, formatDate, relativeDay } from "@/lib/utils";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ area?: string }>;
}

const DIFFICULTIES = ["EASY", "MEDIUM", "HARD"] as const;

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
      {area ? <AreaView practice={practice} area={area} /> : <SummaryView practice={practice} />}
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
          const tab = tabFromPracticeArea(area)!;
          return (
            <Card
              as={Link}
              key={area}
              href={`/student/practice?area=${tab}`}
              padding="md"
              className="flex flex-col gap-2 border-t-4 hover:border-gray-400"
              style={{ borderTopColor: `var(--sat-area-${tab})` }}
            >
              <h2 className="text-lg font-semibold" style={{ color: `var(--sat-area-${tab})` }}>{s.label}</h2>
              {s.latest ? (
                <div>
                  <p className="text-xs text-gray-500">Latest practice · {s.latest.item.skill} · {formatDate(s.latest.attempt.submittedAt)}</p>
                  <p className="mt-1 flex items-end gap-2">
                    <Pct value={s.latest.attempt.pct} className="text-3xl font-bold leading-none" />
                    <span className="text-xs text-gray-500">{s.latest.attempt.correct} of {s.latest.attempt.total} correct</span>
                  </p>
                  {s.delta !== null ? (
                    <p className={`mt-1 text-xs ${s.delta >= 0 ? "text-green-700" : "text-red-600"}`}>{s.delta >= 0 ? "▲" : "▼"} {Math.abs(s.delta)} points vs. previous practice</p>
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
                <span className="font-medium text-blue-600">Open {s.label} practice</span>
              </div>
            </Card>
          );
        })}
      </div>
      <div className="mt-6 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Card padding="md">
          <h2 className="text-base font-semibold text-gray-900">Practice to do</h2>
          <p className="mb-1 text-xs text-gray-500">{todo.length} set{todo.length === 1 ? "" : "s"} · in progress first, then by due date</p>
          {todo.length === 0 ? <p className="py-3 text-sm text-gray-500">Nothing pending.</p> : todo.map((item) => <PracticeSetRow key={item.assignmentId} item={item} showArea />)}
        </Card>
        <Card padding="md">
          <div className="mb-1 flex items-center justify-between">
            <h2 className="text-base font-semibold text-gray-900">Recent practice results</h2>
            <Link href="/student/history" className="text-xs text-blue-600 hover:underline">History ›</Link>
          </div>
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
                      <span className="block text-xs text-gray-500">Completed {formatDate(t.submittedAt)} · Try {t.tryNumber}</span>
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

async function AreaView({ practice, area }: { practice: PracticeSetItem[]; area: PracticeAreaCode }) {
  const tab = tabFromPracticeArea(area)!;
  const mine = sortPracticeSets(practice.filter((p) => p.area === area));
  const skills = await officialSkillsFor(area);
  const domains = [...new Map(skills.map((s) => [s.domainId, s.domain])).entries()];
  const setsFor = (skillId: string, diff: string) => mine.filter((p) => p.skillId === skillId && p.difficulty === diff);

  return (
    <>
      <section className="mb-6">
        <h2 className="mb-2 text-base font-semibold text-gray-900">Your {practiceAreaLabel(area)} practice sets</h2>
        {mine.length === 0 ? (
          <EmptyState title={`No ${practiceAreaLabel(area)} practice sets yet.`} description="Your teacher assigns practice sets for each skill." />
        ) : (
          <Card padding="md" className="py-1">{mine.map((item) => <PracticeSetRow key={item.assignmentId} item={item} />)}</Card>
        )}
      </section>

      <section>
        <h2 className="text-base font-semibold text-gray-900">Skills map</h2>
        <p className="text-xs text-gray-500">Every SAT skill in {practiceAreaLabel(area)} and the sets assigned for each one.</p>
        <p className="mb-3 mt-1 flex flex-wrap gap-3 text-xs text-gray-500">
          <Legend className="bg-blue-500" label="Not started" />
          <Legend className="bg-amber-500" label="In progress" />
          <Legend className="bg-green-500" label="Completed" />
          <Legend className="bg-red-500" label="Overdue" />
          <span className="flex items-center gap-1"><Lock size={11} /> Not assigned yet</span>
        </p>
        <div className="space-y-4">
          {domains.map(([domainId, domainName]) => {
            const domainSkills = skills.filter((s) => s.domainId === domainId);
            return (
              <Card key={domainId} padding="md">
                <div className="mb-2 flex items-baseline justify-between">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">{domainName}</h3>
                  <span className="text-xs text-gray-400">{domainSkills.length} skills</span>
                </div>
                <div className="divide-y divide-gray-100">
                  {domainSkills.map((skill) => {
                    const assigned = mine.filter((p) => p.skillId === skill.id).length;
                    return (
                      <div key={skill.id} className="grid items-center gap-2 py-2 sm:grid-cols-[1fr_auto]">
                        <div>
                          <p className="text-sm font-semibold text-gray-900">{skill.name}</p>
                          <p className="text-xs text-gray-500">{assigned ? `${assigned} set${assigned === 1 ? "" : "s"} assigned` : "No sets assigned yet"}</p>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {DIFFICULTIES.map((diff) => {
                            const sets = setsFor(skill.id, diff);
                            if (sets.length === 0) {
                              return (
                                <span
                                  key={diff}
                                  title={`Your teacher hasn't assigned a ${difficultyLabel(diff)} set for this skill yet`}
                                  className="flex items-center gap-1 rounded-md border border-dashed border-gray-200 px-2 py-1 text-xs text-gray-400"
                                >
                                  <Lock size={11} /> {difficultyLabel(diff)}
                                </span>
                              );
                            }
                            const one = sets.length === 1 ? sets[0] : null;
                            const state = sets.some((s) => s.overdue) ? "overdue" : sets.every((s) => s.state === "done") ? "done" : sets.some((s) => s.state === "progress") ? "progress" : "todo";
                            const best = sets.reduce<number | null>((m, s) => (s.best !== null && (m === null || s.best > m) ? s.best : m), null);
                            const href = one
                              ? one.state === "done" && one.last
                                ? `/student/results/${one.last.id}`
                                : `/student/practice/assignment/${one.assignmentId}`
                              : `/student/content-map/${skill.id}/${diff.toLowerCase()}?area=${tab}`;
                            return (
                              <Link
                                key={diff}
                                href={href}
                                title={one ? (one.state === "done" ? "View results" : one.state === "progress" ? "Continue" : "Start") : `${sets.length} sets`}
                                className="flex items-center gap-1.5 rounded-md border border-gray-200 px-2 py-1 text-xs font-medium text-gray-700 hover:border-gray-400"
                              >
                                <span className={cn("inline-block h-2 w-2 rounded-full", STATE_DOT[state])} />
                                {difficultyLabel(diff)}
                                {sets.length > 1 ? ` ×${sets.length}` : ""}
                                {state === "done" && best !== null ? <span className="text-gray-500">· {best}%</span> : null}
                              </Link>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Card>
            );
          })}
        </div>
      </section>
    </>
  );
}

const STATE_DOT: Record<string, string> = { todo: "bg-blue-500", progress: "bg-amber-500", done: "bg-green-500", overdue: "bg-red-500" };

function Legend({ className, label }: { className: string; label: string }) {
  return (
    <span className="flex items-center gap-1">
      <span className={cn("inline-block h-2 w-2 rounded-full", className)} /> {label}
    </span>
  );
}
