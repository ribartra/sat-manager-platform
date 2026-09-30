"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Alert } from "./alert";

/**
 * Shared body of every route `error.tsx`. Optional one-shot auto-retry (for transient failures
 * right after a deploy/restart): it retries once per `autoRetryKey` every 30 s, then waits for
 * the user.
 */
export function RouteError({
  title,
  description = "This may be a temporary service interruption. Your saved progress was not changed.",
  reset,
  back,
  autoRetryKey,
}: {
  title: string;
  description?: string;
  reset: () => void;
  back?: { href: string; label: string };
  autoRetryKey?: string;
}) {
  const [retrying, setRetrying] = useState(false);

  useEffect(() => {
    if (!autoRetryKey) return;
    try {
      const last = Number(sessionStorage.getItem(autoRetryKey) ?? 0);
      if (Date.now() - last <= 30_000) return;
      sessionStorage.setItem(autoRetryKey, String(Date.now()));
    } catch {
      return;
    }
    const timer = window.setTimeout(() => {
      setRetrying(true);
      reset();
    }, 700);
    return () => window.clearTimeout(timer);
  }, [autoRetryKey, reset]);

  return (
    <main className="mx-auto flex min-h-[50vh] w-full max-w-xl flex-col justify-center px-4 py-12">
      <Alert
        tone="error"
        title={title}
        action={
          <div className="flex flex-col items-end gap-2 sm:flex-row sm:items-center">
            <Button
              type="button"
              size="sm"
              onClick={() => {
                try {
                  if (autoRetryKey) sessionStorage.setItem(autoRetryKey, String(Date.now()));
                } catch {}
                setRetrying(true);
                reset();
              }}
            >
              Try again
            </Button>
          </div>
        }
      >
        {retrying ? "Retrying the connection…" : description}
      </Alert>
      {back ? (
        <Link href={back.href} className="mt-4 text-sm font-medium text-blue-600 hover:underline">
          {back.label}
        </Link>
      ) : null}
    </main>
  );
}
