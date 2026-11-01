"use client";

import { RouteError } from "@/components/sat/route-error";

export default function PracticeSetsError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <RouteError
      title="We couldn't load your practice sets"
      description="Something went wrong loading this page. Please try again."
      reset={reset}
      back={{ href: "/student", label: "Back to home" }}
      autoRetryKey="sat-practice-sets-auto-retry-at"
    />
  );
}
