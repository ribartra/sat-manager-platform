"use client";

import { RouteError } from "@/components/sat/route-error";

export default function PracticeAssignmentError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <RouteError
      title="We couldn't load this practice set"
      description="Something went wrong loading this set. Please try again."
      reset={reset}
      back={{ href: "/student", label: "Back to home" }}
      autoRetryKey="sat-practice-assignment-auto-retry-at"
    />
  );
}
