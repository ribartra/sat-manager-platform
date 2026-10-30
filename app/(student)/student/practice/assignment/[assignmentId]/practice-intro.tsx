import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader, PageShell, PracticeAttemptsTable, SectionHeader } from "@/components/sat";
import { HeaderActions } from "@/components/sat/header-actions";
import { SourceTag } from "@/components/sat/source-tag";
import { Breadcrumbs } from "@/components/sat/breadcrumbs";
import { AreaTag, notOpenLabel, notOpenReason } from "@/components/sat/practice-set-row";
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
      {/* Same header as every view: what it is, its dates, and Start / Continue at the right. */}
      <PageHeader
        eyebrow={
          <span className="flex flex-wrap items-center gap-2">
            <AreaTag area={item.area} />
            <Badge variant={difficultyBadgeVariant(item.difficulty)}>{difficultyLabel(item.difficulty)}</Badge>
            <SourceTag name={item.sourceName} />
            <WorkStatusBadges state={item.state} overdue={item.overdue} />
          </span>
        }
        title={item.skill}
        description={
          <>
            {practiceAreaLabel(item.area)} · {item.domain} · {item.questionCount} questions · no time limit
            <DueLine assignedAt={item.assignedAt} opensAt={item.opensAt} dueDate={item.dueDate} className="mt-1" />
          </>
        }
        actions={
          <HeaderActions>
            <Button asChild variant="secondary"><Link href={`/student/practice?area=${tab}`}>Back</Link></Button>
            {item.locked ? (
              <Button disabledReason={notOpenReason(item.opensAt)}>{notOpenLabel(item.opensAt)}</Button>
            ) : (
              <Button asChild><Link href={start}>{label}</Link></Button>
            )}
          </HeaderActions>
        }
      />
      <Card padding="lg">
        {item.state === "progress" && item.openAnswered !== null ? (
          <p className="mb-4 text-sm text-gray-600">You answered {item.openAnswered} of {item.questionCount} questions so far.</p>
        ) : null}
        {item.tries.length > 0 ? (
          <div>
            <SectionHeader size="sm" title="Your previous attempts" description="Click a try to review it." />
            <PracticeAttemptsTable rows={item.tries} hrefFor={(id) => `/student/results/${id}`} />
          </div>
        ) : (
          <p className="text-sm text-gray-500">No tries yet: your results will show here.</p>
        )}
      </Card>
    </PageShell>
  );
}
