import Link from "next/link";
import { notFound } from "next/navigation";
import { PageShell, PracticeAttemptsTable, SectionHeader } from "@/components/sat";
import { Breadcrumbs } from "@/components/sat/breadcrumbs";
import { AreaTag } from "@/components/sat/practice-set-row";
import { DueLine, WorkStatusBadges } from "@/components/sat/work-status";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { difficultyBadgeVariant, difficultyLabel } from "@/lib/domain-meta";
import { practiceAreaLabel, tabFromPracticeArea } from "@/lib/practice-area";
import { loadStudentPractice } from "@/lib/student-practice";

/** Practice set intro: what it is, due date, previous tries, and Start / Continue. */
export async function PracticeIntro({ studentId, assignmentId }: { studentId: string; assignmentId: string }) {
  const item = (await loadStudentPractice(studentId)).find((p) => p.assignmentId === assignmentId);
  if (!item) notFound();
  const tab = tabFromPracticeArea(item.area);
  const start = `/student/practice/assignment/${assignmentId}?start=1`;
  const label =
    item.state === "progress" ? "Continue where you left off" : item.tries.length > 0 ? `Start try ${item.tries.length + 1}` : "Start practice";
  return (
    <PageShell>
      <Breadcrumbs
        items={[
          { label: "Home", href: "/student" },
          { label: "Practice", href: `/student/practice?area=${tab}` },
          { label: item.skill },
        ]}
      />
      <Card padding="lg" className="mx-auto max-w-3xl">
        <div className="flex flex-wrap items-center gap-2">
          <AreaTag area={item.area} />
          <Badge variant={difficultyBadgeVariant(item.difficulty)}>{difficultyLabel(item.difficulty)}</Badge>
          <WorkStatusBadges state={item.state} overdue={item.overdue} />
        </div>
        <h1 className="mt-2 text-[26px] font-bold tracking-[-0.3px] text-gray-900">{item.skill}</h1>
        <p className="mt-1 text-sm text-gray-500">
          {practiceAreaLabel(item.area)} · {item.domain} · {item.questionCount} questions · no time limit
        </p>
        <DueLine assignedAt={item.assignedAt} dueDate={item.dueDate} className="mt-1" />

        {item.tries.length > 0 ? (
          <div className="mt-5">
            <SectionHeader size="sm" title="Your previous attempts" description="Click a try to review it." />
            <PracticeAttemptsTable rows={item.tries} hrefFor={(id) => `/student/results/${id}`} />
          </div>
        ) : null}

        {item.state === "progress" && item.openAnswered !== null ? (
          <p className="mt-4 text-sm text-gray-600">You answered {item.openAnswered} of {item.questionCount} questions so far.</p>
        ) : null}

        <div className="mt-6 flex flex-wrap gap-2">
          {item.locked ? (
            <Button size="lg" disabledReason="Your teacher hasn't opened this set yet.">Locked</Button>
          ) : (
            <Button asChild size="lg"><Link href={start}>{label}</Link></Button>
          )}
          <Button asChild variant="secondary" size="lg"><Link href={`/student/practice?area=${tab}`}>Back</Link></Button>
        </div>
      </Card>
    </PageShell>
  );
}
