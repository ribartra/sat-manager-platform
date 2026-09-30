"use client";

import { RouteError } from "@/components/sat/route-error";

export default function AppError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <RouteError
      title="This page could not be loaded"
      reset={reset}
      back={{ href: "/", label: "Go to the home page" }}
      autoRetryKey="sat-app-auto-retry-at"
    />
  );
}
