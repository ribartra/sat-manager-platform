"use client";

import { RouteError } from "@/components/sat/route-error";

export default function PracticeAssignmentError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <RouteError
      title="We couldn't load this Practice Set"
      description="The content is not locked. This is usually a brief service interruption."
      reset={reset}
      back={{ href: "/student/practice-sets", label: "Back to Practice Sets" }}
      autoRetryKey="sat-practice-assignment-auto-retry-at"
    />
  );
}
