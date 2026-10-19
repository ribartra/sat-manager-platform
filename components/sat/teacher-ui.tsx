import Link from "next/link";
import { Avatar } from "@/components/avatar";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { cn, formatDate, relativeDay } from "@/lib/utils";

/** Teacher-side building blocks (mockup teacher.js): attention cards, last-active cell, student cell. */

/** "Inactive 5+ days" / "Overdue tests" boxes on the teacher Home. */
export function AttentionCard({
  title,
  icon,
  tone,
  count,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  tone: "warn" | "bad" | "info";
  count: number;
  children: React.ReactNode;
}) {
  return (
    <Card
      padding="md"
      className={cn("border-t-4", tone === "warn" ? "border-t-amber-400" : tone === "bad" ? "border-t-red-500" : "border-t-blue-500")}
    >
      <h3 className="flex items-center justify-between gap-2 text-sm font-semibold text-gray-900">
        <span className="flex items-center gap-1.5">{icon} {title}</span>
        <Badge variant={count ? (tone === "bad" ? "danger" : tone === "warn" ? "warning" : "info") : "default"}>{count}</Badge>
      </h3>
      {count ? <ul className="mt-2 space-y-1.5 text-sm text-gray-800">{children}</ul> : <p className="mt-2 text-sm text-gray-400">Nobody right now</p>}
    </Card>
  );
}

/** One person in an AttentionCard: avatar, name (link) and a short reason. */
export function AttentionItem({ name, avatarUrl, href, detail }: { name: string; avatarUrl?: string | null; href: string; detail: React.ReactNode }) {
  return (
    <li>
      <Link href={href} className="flex items-center gap-2 rounded-md px-1 py-0.5 hover:bg-gray-50">
        <Avatar name={name} avatarUrl={avatarUrl} size="sm" />
        <span className="min-w-0">
          <span className="block truncate font-medium">{name}</span>
          <span className="block truncate text-xs text-gray-500">{detail}</span>
        </span>
      </Link>
    </li>
  );
}

/** Last-active date + relative day, "⚠ inactive" after `warnDays`, red "Never" when null. */
export function DateCell({ date, now = new Date(), inactive }: { date: Date | null; now?: Date; inactive?: boolean }) {
  if (!date) return <span className="text-sm text-red-600">Never</span>;
  return (
    <span className={cn("text-sm", inactive ? "text-amber-700" : "text-gray-700")}>
      <b className="font-medium">{formatDate(date)}</b>
      <span className="block text-xs">{relativeDay(date, now)}{inactive ? " · ⚠ inactive" : ""}</span>
    </span>
  );
}

/** Avatar + name + email. `children` replaces the plain name (e.g. a RowLink with the name). */
export function StudentCell({ name, email, avatarUrl, children }: { name: string; email?: string | null; avatarUrl?: string | null; children?: React.ReactNode }) {
  return (
    <span className="flex items-center gap-2">
      <Avatar name={name} avatarUrl={avatarUrl} size="sm" />
      <span className="min-w-0">
        {children ?? <span className="block truncate font-medium text-gray-900">{name}</span>}
        {email ? <span className="block truncate text-xs text-gray-500">{email}</span> : null}
      </span>
    </span>
  );
}
