import Link from "next/link";
import { PageShell } from "./page-shell";
import { Alert } from "./alert";

/** Shared body of every `not-found.tsx`. */
export function NotFoundView({ homeHref = "/", homeLabel = "Go to the home page" }: { homeHref?: string; homeLabel?: string }) {
  return (
    <PageShell>
      <Alert tone="note" title="Page not found">
        We couldn&apos;t find this page.
      </Alert>
      <Link href={homeHref} className="mt-4 inline-block text-sm font-medium text-blue-600 hover:underline">
        {homeLabel}
      </Link>
    </PageShell>
  );
}
