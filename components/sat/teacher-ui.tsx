import Link from "next/link";
import { Avatar } from "@/components/avatar";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { cn, formatDate, relativeDay } from "@/lib/utils";

/** Teacher-side building blocks (mockup teacher.js): attention cards, last-active cell, student cell. */

/** "Students inactive for 5+ days" / "Overdue tests" boxes on the teacher Home. */
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

/** Last-active date + relative day, "⚠ inactive 5+ days" when inactive, red "Never active" when null. */
export function DateCell({ date, now = new Date(), inactive }: { date: Date | null; now?: Date; inactive?: boolean }) {
  if (!date) return <span className="text-sm text-red-600">Never active</span>;
  return (
    <span className={cn("text-sm", inactive ? "text-amber-700" : "text-gray-700")}>
      <b className="font-medium">{formatDate(date)}</b>
      <span className="block text-xs">{relativeDay(date, now)}{inactive ? " · ⚠ inactive 5+ days" : ""}</span>
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

/** "Ana P." for the compact attention chips. */
export function shortName(name: string) {
  const [first, ...rest] = name.trim().split(/\s+/);
  const last = rest[rest.length - 1];
  return last ? `${first} ${last[0]}.` : first;
}

/**
 * One line of the compact "Needs attention" card (mockup `mejorada/teacher/index.html`): coloured
 * label with icon and count, then a chip per student (details in the chip tooltip) and a "See them all →"
 * shortcut to the full list when there is one.
 */
export function AttentionRow({
  icon,
  label,
  tone,
  people,
  viewAllHref,
}: {
  icon: React.ReactNode;
  label: string;
  tone: "warn" | "bad" | "info";
  people: { id: string; name: string; href: string; detail: string }[];
  /** Full list behind this row (e.g. the students list filtered the same way). */
  viewAllHref?: string;
}) {
  const color = tone === "warn" ? "text-amber-700" : tone === "bad" ? "text-red-600" : "text-blue-600";
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className={cn("flex min-w-[17rem] items-center gap-1.5 text-sm font-semibold", color)}>
        {icon} {label}
        <Badge variant={people.length ? (tone === "bad" ? "danger" : tone === "warn" ? "warning" : "info") : "default"}>{people.length}</Badge>
      </span>
      {people.length === 0 ? (
        <span className="text-sm text-gray-400">No one right now</span>
      ) : (
        // At most 10 here; the rest behind "See all N →".
        people.slice(0, 10).map((p) => (
          <Link key={p.id} href={p.href} title={p.detail} className="rounded-full border border-gray-200 bg-white px-2.5 py-0.5 text-sm text-gray-800 hover:border-gray-400">
            {shortName(p.name)}
          </Link>
        ))
      )}
      {people.length > 10 && !viewAllHref ? <span className="text-xs text-gray-500">+{people.length - 10} more</span> : null}
      {viewAllHref && people.length ? (
        <Link href={viewAllHref} className="ml-auto whitespace-nowrap text-xs font-medium text-[var(--sat-primary)] hover:underline">
          {people.length > 10 ? `See all ${people.length} →` : "See them all →"}
        </Link>
      ) : null}
    </div>
  );
}
