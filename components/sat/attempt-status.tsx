import { Alert } from "./alert";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { humanizeCode } from "@/lib/domain-meta";

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
  if (status === INVALIDATED) return <Badge variant="default">Not counted</Badge>;
  if (status === "IN_PROGRESS") return <Badge variant="warning">In progress</Badge>;
  return <Badge variant="default">{humanizeCode(status)}</Badge>;
}

export function InvalidatedNotice({ audience }: { audience: "student" | "teacher" }) {
  return (
    <Alert tone="note" role="note" title="This result doesn't count" className="mb-6">
      {audience === "student"
        ? "Your teacher set this result aside. You can still review it, but it doesn't count toward your scores."
        : "It stays in the history for reference, but it doesn't count toward scores or reports."}
    </Alert>
  );
}
