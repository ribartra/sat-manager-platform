import Link from "next/link";
import { Alert } from "@/components/sat/alert";

/** Shared frame for the public legal pages (privacy, terms). */
export function LegalPage({ title, updated, children }: { title: string; updated: string; children: React.ReactNode }) {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6">
      <Alert tone="warning" title="Draft — pending legal review" className="mb-6">
        This text describes how the platform works today; the academy will publish the reviewed version.
      </Alert>
      <h1 className="text-2xl font-semibold text-gray-900">{title}</h1>
      <p className="mt-1 text-sm text-gray-500">Last updated {updated}</p>
      <div className="mt-8 space-y-8 text-sm leading-6 text-gray-700 [&_h2]:mb-2 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-gray-900 [&_li]:ml-5 [&_li]:list-disc [&_ul]:space-y-1">
        {children}
      </div>
      <p className="mt-10 flex gap-4 border-t border-gray-200 pt-4 text-sm">
        <Link href="/privacy" className="text-blue-600 hover:underline">Privacy Policy</Link>
        <Link href="/terms" className="text-blue-600 hover:underline">Terms of Use</Link>
        <Link href="/login" className="text-blue-600 hover:underline">Sign in</Link>
      </p>
    </main>
  );
}

export function LegalLinks({ className = "" }: { className?: string }) {
  return (
    <p className={`text-center text-xs text-gray-500 ${className}`}>
      <Link href="/privacy" className="hover:underline">Privacy Policy</Link>
      <span aria-hidden> · </span>
      <Link href="/terms" className="hover:underline">Terms of Use</Link>
    </p>
  );
}
