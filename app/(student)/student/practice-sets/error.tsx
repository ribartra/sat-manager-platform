"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const AUTO_RETRY_KEY = "sat-practice-sets-auto-retry-at";
const AUTO_RETRY_WINDOW_MS = 30_000;

export default function PracticeSetsError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const [retrying, setRetrying] = useState(false);

  useEffect(() => {
    const lastAttempt = Number(sessionStorage.getItem(AUTO_RETRY_KEY) ?? 0);
    if (Date.now() - lastAttempt <= AUTO_RETRY_WINDOW_MS) return;

    sessionStorage.setItem(AUTO_RETRY_KEY, String(Date.now()));
    const timer = window.setTimeout(() => {
      setRetrying(true);
      reset();
    }, 700);
    return () => window.clearTimeout(timer);
  }, [reset]);

  return (
    <main className="mx-auto flex min-h-[50vh] max-w-xl flex-col items-center justify-center px-4 py-12 text-center">
      <h1 className="text-lg font-semibold text-gray-900">Practice Sets could not be loaded</h1>
      <p className="mt-2 text-sm text-gray-500">
        {retrying ? "Retrying once..." : "Please try again. Your saved progress was not changed."}
      </p>
      <div className="mt-5 flex items-center gap-3">
        <button
          type="button"
          onClick={() => {
            sessionStorage.setItem(AUTO_RETRY_KEY, String(Date.now()));
            setRetrying(true);
            reset();
          }}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Try again
        </button>
        <Link href="/login" className="text-sm font-medium text-blue-600 hover:underline">
          Sign in again
        </Link>
      </div>
    </main>
  );
}
