import Link from "next/link";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { assignmentStatusLabel } from "@/lib/domain-meta";
import { PENDING_PREVIEW } from "@/lib/pending";

/**
 * Side list next to the results (teacher's student page, student's Practice): a title with its count,
 * at most PENDING_PREVIEW rows and, beyond, the footer ("See all N pending →").
 */
export function SidePanel({ id, title, count, empty, children, footer }: { id?: string; title: string; count: number; empty: string; children: ReactNode; footer?: ReactNode }) {
  return (
    <section id={id}>
      <h2 className="mb-2 flex items-center justify-between text-sm font-semibold text-gray-900">
        {title}
        <span className="text-xs font-normal text-gray-400">{count}</span>
      </h2>
      <Card className="overflow-hidden">
        {count === 0 ? <p className="px-3 py-4 text-sm text-gray-400">{empty}</p> : <ul className="divide-y divide-gray-100">{children}</ul>}
        {count > PENDING_PREVIEW && footer ? <div className="border-t border-gray-100">{footer}</div> : null}
      </Card>
    </section>
  );
}

/** "See all N pending →" under a side list (only when it holds more than PENDING_PREVIEW). */
export function SeeAllPending({ total, href }: { total: number; href: string }) {
  if (total <= PENDING_PREVIEW) return null;
  return (
    <Link href={href} className="block px-3 py-2 text-xs font-medium text-blue-600 hover:underline">
      See all {total} pending →
    </Link>
  );
}

/** Status of an assignment not finished: Not started / In progress / Overdue, with a short hint. */
export function StatusBadge({ status }: { status: string }) {
  const variant = status === "IN_PROGRESS" ? "warning" : status === "OVERDUE" ? "danger" : "info";
  const help: Record<string, string> = {
    PENDING: "Assigned, not started yet.",
    IN_PROGRESS: "Started but not finished.",
    OVERDUE: "The due date passed before it was finished.",
  };
  return (
    <span title={help[status]}>
      <Badge variant={variant}>{assignmentStatusLabel(status)}</Badge>
    </span>
  );
}
