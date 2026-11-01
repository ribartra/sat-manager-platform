"use client";

import { RouteError } from "@/components/sat/route-error";

export default function ImpersonateError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <RouteError
      title="Student view could not be loaded"
      description="This may be a temporary service interruption. No student data was changed."
      reset={reset}
      back={{ href: "/teacher/students", label: "Back to Students" }}
      autoRetryKey="sat-student-view-auto-retry-at"
    />
  );
}
