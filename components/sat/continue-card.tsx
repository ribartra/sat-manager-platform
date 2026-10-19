import Link from "next/link";
import { Play } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { ContinueWork } from "@/lib/continue-work";

/** Green "Continue where you left off" / "Up next" card (mockup `continueCard`). */
/** `readOnly` (teacher "Student view"): same card without the Continue button. */
export function ContinueCard({ work, readOnly = false }: { work: ContinueWork | null; readOnly?: boolean }) {
  if (!work) return null;
  return (
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3.5 rounded-[10px] border border-green-200 border-l-[5px] border-l-[var(--sat-ok)] bg-[linear-gradient(90deg,#f0fdf4,#fff_70%)] p-4">
      <div className="min-w-0 flex-1">
        <p className="text-xs font-bold tracking-wide text-[var(--sat-ok)]">{work.next ? "UP NEXT" : "CONTINUE WHERE YOU LEFT OFF"}</p>
        <div className="mt-1.5 flex flex-wrap items-center gap-2">
          <Badge variant={work.kind === "Test" ? "test" : "default"}>{work.kind}</Badge>
          <b className="text-base text-gray-900">{work.title}</b>
        </div>
        <p className="text-sm text-gray-500">{work.sub}</p>
        {work.preview ? <p className="mt-1.5 truncate font-serif text-sm text-slate-700">&ldquo;{work.preview}&rdquo;</p> : null}
      </div>
      {readOnly ? null : (
      <Link
        href={work.href}
        className="inline-flex items-center gap-2 rounded-lg bg-[var(--sat-ok)] px-5 py-2.5 text-sm font-semibold text-white hover:brightness-95"
      >
        <Play size={14} /> {work.button}
      </Link>
      )}
    </div>
  );
}
