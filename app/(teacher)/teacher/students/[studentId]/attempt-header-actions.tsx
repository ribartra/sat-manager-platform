import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import prisma from "@/lib/prisma";
import { HEADER_ACTION_CLASS, HeaderActions } from "@/components/sat/header-actions";
import { InvalidateAttemptButton } from "@/components/sat/invalidate-attempt-button";
import { GenerateReportDialog } from "./generate-report-dialog";

/**
 * Top-right actions of a teacher attempt page (practice or Test), same slot and style as the student
 * profile header: Back · Report · Invalidate attempt. The report is preset to the attempt's area, or
 * to this Test attempt. Invalidate is the only action on an attempt (students retry on their own).
 */
export async function AttemptHeaderActions({
  studentId,
  studentName,
  backHref,
  attempt,
  report,
}: {
  studentId: string;
  studentName: string;
  backHref: string;
  attempt: { id: string; kind: "practice" | "test"; status: string };
  report: { area: "math" | "reading" | "writing" } | { area: "tests"; examLabel: string };
}) {
  const links = await prisma.parentStudent.findMany({
    where: { studentId },
    include: { parent: { select: { id: true, name: true, email: true } } },
  });
  const parents = links.filter((link) => link.parent.email).map((link) => ({ id: link.parent.id, name: link.parent.name, email: link.parent.email }));
  const isTest = report.area === "tests";
  const canReport = !isTest || attempt.status === "SUBMITTED";
  return (
    <HeaderActions>
      <Link href={backHref} className={HEADER_ACTION_CLASS}>
        <ChevronLeft size={14} aria-hidden /> Back to {studentName.split(" ")[0]}
      </Link>
      {canReport ? (
        <GenerateReportDialog
          studentId={studentId}
          studentName={studentName}
          currentArea={report.area}
          filters={{}}
          filterSummary=""
          parents={parents}
          {...(report.area === "tests"
            ? { exams: [{ id: attempt.id, label: report.examLabel }], initialExamId: attempt.id, triggerLabel: "Test report" }
            : { triggerLabel: "Report" })}
        />
      ) : null}
      <InvalidateAttemptButton attemptId={attempt.id} kind={attempt.kind} status={attempt.status} />
    </HeaderActions>
  );
}
