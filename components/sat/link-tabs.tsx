import Link from "next/link";
import { TAB_BAR, TAB_LINK_ACTIVE, TAB_LINK_IDLE } from "@/lib/practice-area";
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
    <nav aria-label={label} className={cn("mb-4", TAB_BAR, className)}>
      <div className="flex min-w-max gap-0.5">
        {tabs.map((t) => {
          const on = t.key === active;
          return (
            <Link
              key={t.key}
              href={t.href}
              aria-current={on ? "page" : undefined}
              className={on ? TAB_LINK_ACTIVE : TAB_LINK_IDLE}
            >
              {t.label}
              {t.count !== undefined ? <span className="ml-1 text-xs font-normal opacity-70">({t.count})</span> : null}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
