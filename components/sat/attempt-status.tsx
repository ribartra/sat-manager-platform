import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/**
 * Attempts are atomic: an invalidated attempt stays in the history exactly as it was, but it
 * never counts toward any score. History lists show it greyed out and crossed out.
 */
export const INVALIDATED = "INVALIDATED";

export function isInvalidated(status: string | null | undefined) {
  return status === INVALIDATED;
}

/** Row styling for an invalidated attempt in a history list. */
export function invalidatedRowClass(status: string | null | undefined) {
  return isInvalidated(status) ? "text-gray-400 [&_*]:text-gray-400" : undefined;
}

/** Wrap a score (or any value that no longer counts) so it reads as void when invalidated. */
export function VoidableValue({ status, children, className }: { status: string | null | undefined; children: React.ReactNode; className?: string }) {
  if (!isInvalidated(status)) return <span className={className}>{children}</span>;
  return <span className={cn("text-gray-400 line-through", className)}>{children}</span>;
}

export function AttemptStatusBadge({ status }: { status: string }) {
  if (status === "SUBMITTED") return <Badge variant="success">Submitted</Badge>;
  if (status === INVALIDATED) return <Badge variant="default">Invalidated</Badge>;
  if (status === "IN_PROGRESS") return <Badge variant="warning">In progress</Badge>;
  return <Badge variant="default">{status}</Badge>;
}

export function InvalidatedNotice({ audience }: { audience: "student" | "teacher" }) {
  return (
    <div role="note" className="mb-6 rounded-lg border border-gray-300 bg-gray-50 px-4 py-3 text-sm text-gray-700">
      <p className="font-semibold text-gray-900">This attempt was invalidated</p>
      <p className="mt-0.5">
        {audience === "student"
          ? "Your teacher invalidated this attempt. It stays in your history for reference but does not count toward any score or average."
          : "It stays in the history for reference but does not count toward any score, average, report or analytics."}
      </p>
    </div>
  );
}
