import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Tables whose whole row opens a detail page (mockup `tr.rowlink`). The row's main link stretches
 * over the row with an `::after` overlay, so the row is one click target and stays a real link for
 * keyboard and screen readers. Other links/buttons in the row must use `RowAction` to stay on top.
 */

export function LinkTr({ className, children }: { className?: string; children: React.ReactNode }) {
  return <tr className={cn("relative hover:bg-[var(--sat-primary-soft)]", className)}>{children}</tr>;
}

/** The row's main link (stretched). Put it in the first meaningful cell. */
export function RowLink({ href, className, children, ...rest }: { href: string; className?: string; children: React.ReactNode } & Omit<React.ComponentProps<typeof Link>, "href" | "className" | "children">) {
  return (
    <Link href={href} className={cn("font-semibold text-[var(--sat-text)] after:absolute after:inset-0 after:content-[''] hover:underline", className)} {...rest}>
      {children}
    </Link>
  );
}

/** Wrapper for secondary links/buttons inside a linked row (kept above the stretched link). */
export function RowAction({ className, children }: { className?: string; children: React.ReactNode }) {
  return <span className={cn("relative z-10", className)}>{children}</span>;
}

/** Trailing chevron cell. */
export function ChevronCell({ className }: { className?: string }) {
  return (
    <td className={cn("w-8 px-2 py-2 text-right text-[var(--sat-blank)]", className)} aria-hidden>
      <ChevronRight size={16} className="inline" />
    </td>
  );
}

/** Shared table frame: header row style + body dividers. */
export function SimpleTable({ head, children, className }: { head: React.ReactNode[]; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("overflow-x-auto rounded-[var(--sat-radius)] border border-[var(--sat-border)] bg-white", className)}>
      <table className="w-full border-collapse text-sm">
        <thead className="bg-[var(--sat-surface-2)] text-left text-xs text-[var(--sat-muted)]">
          <tr>
            {head.map((h, i) => (
              <th key={i} className="whitespace-nowrap border-b border-[var(--sat-border)] px-3 py-2.5 font-semibold">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--sat-border)]">{children}</tbody>
      </table>
    </div>
  );
}

export const TD = "px-3 py-[11px] align-middle";
