import Link from "next/link";
import { ChevronRight } from "lucide-react";

export type Crumb = { label: string; href?: string };

/** "Home › Tests › TEST 4" — the last item is the current page (no link). */
export function Breadcrumbs({ items, className = "" }: { items: Crumb[]; className?: string }) {
  return (
    <nav aria-label="Breadcrumb" className={`mb-3 flex flex-wrap items-center gap-1 text-xs text-gray-500 ${className}`}>
      {items.map((item, i) => (
        <span key={`${item.label}-${i}`} className="flex items-center gap-1">
          {i > 0 && <ChevronRight size={12} className="text-gray-300" aria-hidden />}
          {item.href && i < items.length - 1 ? (
            <Link href={item.href} className="hover:text-gray-800 hover:underline">{item.label}</Link>
          ) : (
            <span aria-current={i === items.length - 1 ? "page" : undefined} className="text-gray-700">{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}
