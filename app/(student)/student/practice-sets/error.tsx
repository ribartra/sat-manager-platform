"use client";

import { RouteError } from "@/components/sat/route-error";

export default function PracticeSetsError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <RouteError
      title="Practice Sets could not be loaded"
      description="Please try again. Your saved progress was not changed."
      reset={reset}
      back={{ href: "/login", label: "Sign in again" }}
      autoRetryKey="sat-practice-sets-auto-retry-at"
    />
  );
}
