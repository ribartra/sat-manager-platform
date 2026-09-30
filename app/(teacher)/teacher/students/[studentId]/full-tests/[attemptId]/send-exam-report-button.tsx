"use client";

import { GenerateReportDialog, type ReportParentOption } from "../../generate-report-dialog";

/** "Send this exam report": the report dialog preset to this Full Practice Test attempt. */
export function SendExamReportButton({
  studentId,
  studentName,
  attemptId,
  attemptLabel,
  parents,
}: {
  studentId: string;
  studentName: string;
  attemptId: string;
  attemptLabel: string;
  parents: ReportParentOption[];
}) {
  return (
    <GenerateReportDialog
      studentId={studentId}
      studentName={studentName}
      currentArea="mocks"
      filters={{}}
      filterSummary=""
      exams={[{ id: attemptId, label: attemptLabel }]}
      initialExamId={attemptId}
      parents={parents}
      triggerLabel="Exam report (PDF / email)"
    />
  );
}
