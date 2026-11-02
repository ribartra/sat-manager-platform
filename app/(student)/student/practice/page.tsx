import Link from "next/link";
import { redirect } from "next/navigation";
import { EmptyState, PageHeader, PageShell, PracticeAreaTabs, PracticeSetAttemptsAccordion, SectionHeader, SkillResults } from "@/components/sat";
import { Breadcrumbs } from "@/components/sat/breadcrumbs";
import { HEADER_SHORTCUT_CLASS, HeaderActions } from "@/components/sat/header-actions";
import { SeeAllPending, SidePanel, StatusBadge } from "@/components/sat/side-panel";
import { Button } from "@/components/ui/button";
import { auth } from "@/lib/auth";
import { refreshAssignmentStates } from "@/lib/assignments";
import { practiceSetGroups, setsFromReportAttempts } from "@/lib/attempt-groups";
import { historyHref } from "@/lib/history-params";
import { PENDING_PREVIEW, pendingHref } from "@/lib/pending";
import { activeAreaTab, practiceAreaFromTab, practiceAreaLabel } from "@/lib/practice-area";
import { loadPracticeReport, shortSetName } from "@/lib/student-report";
import { formatDate, isAhead } from "@/lib/utils";
import { ContextTabs } from "@/components/sat/context-tabs";
import { ContextTag } from "@/components/sat/attempts-table";
import { contextViewFromParam } from "@/lib/assignment-context";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ area?: string; context?: string }>;
}

/**
 * The student's Practice, one area at a time (Math · Reading · Writing) — the same view the teacher
 * has of the student's practice: results by skill (last try of each set, per source), the sets to do
 * at the side (Start / Continue) and the tries of each set. Percentages only (SAT scores are Tests).
 */
export default async function StudentPracticePage({ searchParams }: PageProps) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const studentId = session.user.id;
  await refreshAssignmentStates();
  const query = await searchParams;
  if (query.area === "tests" || query.area === "mocks") redirect("/student/tests");
  const area = activeAreaTab(query.area, "math") as "math" | "reading" | "writing";
  const practiceArea = practiceAreaFromTab(area) ?? "MATH";
  // Results by skill have no skill/level filters (as on the teacher's view): the whole area, every
  // source; All / Classroom / Homework picks the work shown (scores always come from Homework).
  const context = contextViewFromParam(query.context);
  const report = await loadPracticeReport(studentId, practiceArea, { context });
  const areaLabel = practiceAreaLabel(practiceArea);
  // One row per practice set (its last try), opening to its latest tries; every try is in History.
  const practiceSets = practiceSetGroups(setsFromReportAttempts(report.attemptHistory));

  return (
    <PageShell>
      <Breadcrumbs items={[{ label: "Home", href: "/student" }, { label: "Practice", href: "/student/practice" }, { label: areaLabel }]} />
      <PageHeader
        title="Practice"
        description="Practice sets by skill, assigned by your teacher. Results show % correct (SAT scores are in Tests)."
        actions={
          <HeaderActions>
            <Link href={pendingHref("/student/pending", { type: "practice", area })} className={HEADER_SHORTCUT_CLASS}>Pending →</Link>
            <Link href={historyHref({ type: "practice", area }, {}, "/student/history")} className={HEADER_SHORTCUT_CLASS}>History →</Link>
          </HeaderActions>
        }
      />
      <PracticeAreaTabs basePath="/student/practice" active={area} includeTests={false} preserve={{ context: context === "all" ? undefined : context }} />
      <ContextTabs basePath="/student/practice" active={context} params={{ area }} />

      <div className="mt-4 grid gap-6 lg:grid-cols-3">
        <div id="performance" className="min-w-0 space-y-6 lg:col-span-2">
          <SkillResults
            report={report}
            attemptHref={(id) => `/student/results/${id}`}
            description={
              context === "classroom"
                ? "Work done in class: what you answered at each level (Classroom is not scored)"
                : context === "all"
                  ? "Homework results (last try of every set, by questions); levels done only in class show what you answered"
                  : undefined
            }
          />
        </div>

        <aside className="min-w-0 space-y-6">
          <SidePanel
            id="active-sets"
            title="Your practice sets"
            count={report.assignments.length}
            empty={`No ${areaLabel} practice sets to do.`}
            footer={<SeeAllPending total={report.assignments.length} href={pendingHref("/student/pending", { type: "practice", area })} />}
          >
            {report.assignments.slice(0, PENDING_PREVIEW).map((a) => (
              <li key={a.id} className="flex items-start justify-between gap-3 px-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-gray-800" title={a.name}>{shortSetName(a.name)}</p>
                  <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                    <ContextTag context={a.context} />
                    <StatusBadge status={a.status} />
                    <span className={isAhead(a.opensAt) ? "text-[11px] text-amber-700" : "text-[11px] text-gray-400"}>Opens {formatDate(a.opensAt)}</span>
                    {a.dueDate && <span className="text-[11px] text-gray-400">Due {formatDate(a.dueDate)}</span>}
                  </div>
                </div>
                {/* Start or continue it (an open date ahead or a closed set can't start yet). */}
                {a.locked ? (
                  <Button size="sm" variant="secondary" disabledReason={isAhead(a.opensAt) ? `You can start it on ${formatDate(a.opensAt)}.` : "Your teacher will open it."}>
                    {isAhead(a.opensAt) ? "Not open yet" : "Closed"}
                  </Button>
                ) : (
                  <Button asChild size="sm">
                    <Link href={`/student/practice/assignment/${a.id}`}>{a.status === "IN_PROGRESS" ? "Continue" : "Start"}</Link>
                  </Button>
                )}
              </li>
            ))}
          </SidePanel>

          {report.comments.length > 0 && (
            <SidePanel title="Teacher comments" count={report.comments.length} empty="">
              {report.comments.map((entry) => (
                <li key={entry.id}>
                  {/* Each comment opens the try it was written on. */}
                  <Link href={`/student/results/${entry.id}`} className="block px-3 py-2 hover:bg-[var(--sat-primary-soft)]">
                    <p className="text-[11px] text-gray-400" title={entry.name}>{shortSetName(entry.name)} · {entry.submittedAt ? formatDate(entry.submittedAt) : "-"}</p>
                    <p className="text-sm text-gray-800">{entry.teacherComment}</p>
                  </Link>
                </li>
              ))}
            </SidePanel>
          )}
        </aside>
      </div>

      <section id="recent-attempts" className="mt-6 scroll-mt-6">
        <SectionHeader
          title={`${areaLabel} practice attempts`}
          description={`${practiceSets.length} practice set${practiceSets.length === 1 ? "" : "s"} · Last Attempt is your most recent try · open a set to see its last 3 tries`}
        />
        {practiceSets.length === 0 ? (
          <EmptyState title={`No finished ${areaLabel} work yet.`} />
        ) : (
          <PracticeSetAttemptsAccordion
            sets={practiceSets}
            hrefFor={(id) => `/student/results/${id}`}
            // "See all N tries": your History filtered to that set.
            historyHref={(set) => historyHref({ area, skill: set.skillId ?? undefined, difficulty: set.difficulty ?? undefined, set: set.practiceSetId ?? undefined }, {}, "/student/history")}
          />
        )}
      </section>
    </PageShell>
  );
}
