import Link from "next/link";
import { cn } from "@/lib/utils";

/** Link-based view tabs (mockup `.tabs`): "Pending (2) · Completed (3) · All". State lives in the URL. */
export function LinkTabs({
  tabs,
  active,
  label = "Views",
  className,
}: {
  tabs: { key: string; label: React.ReactNode; href: string; count?: number }[];
  active: string;
  label?: string;
  className?: string;
}) {
  return (
    <nav aria-label={label} className={cn("mb-4 overflow-x-auto border-b border-gray-200", className)}>
      <div className="flex min-w-max gap-1">
        {tabs.map((t) => {
          const on = t.key === active;
          return (
            <Link
              key={t.key}
              href={t.href}
              aria-current={on ? "page" : undefined}
              className={cn(
                "-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium",
                on ? "border-gray-900 text-gray-900" : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-800",
              )}
            >
              {t.label}
              {t.count !== undefined ? <span className="ml-1 text-xs text-gray-400">({t.count})</span> : null}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
