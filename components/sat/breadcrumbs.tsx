import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { ViewStepper } from "@/components/sat/view-stepper";

export type Crumb = { label: string; href?: string };

/**
 * "Home › Tests › TEST 4" — the last item is the current page (no link). On a main view the row also
 * has the previous / next view links at the right (ViewStepper).
 */
export function Breadcrumbs({ items, className = "" }: { items: Crumb[]; className?: string }) {
  return (
    <nav aria-label="Breadcrumb" className={`mb-2.5 flex flex-wrap items-center gap-1.5 text-[13px] text-[var(--sat-muted)] ${className}`}>
      {items.map((item, i) => (
        <span key={`${item.label}-${i}`} className="flex items-center gap-1.5">
          {i > 0 && <ChevronRight size={13} className="text-[var(--sat-blank)]" aria-hidden />}
          {item.href && i < items.length - 1 ? (
            <Link href={item.href} className="font-medium text-[var(--sat-primary)] hover:underline">{item.label}</Link>
          ) : (
            <span aria-current={i === items.length - 1 ? "page" : undefined} className="text-[var(--sat-muted)]">{item.label}</span>
          )}
        </span>
      ))}
      <ViewStepper />
    </nav>
  );
}
