import Link from "next/link";
import {
  AREA_TABS_WITH_TESTS,
  PRACTICE_AREA_TABS,
  areaTabLinkClass,
  TAB_BAR,
  buildAreaHref,
  type HomeTabKey,
} from "@/lib/practice-area";

interface PracticeAreaTabsProps {
  basePath: string;
  active: HomeTabKey;
  /** Preserve selected student (or other query params) across tab switches. */
  preserve?: Record<string, string | undefined | null>;
  /** Show the Tests tab (right-most). Practice-only surfaces pass false. */
  includeTests?: boolean;
  /** Show a Summary tab in front of the areas (Home pages). */
  includeSummary?: boolean;
  /** Extra tabs after the area tabs (e.g. the teacher's per-student "Activity"). */
  extraTabs?: { key: string; label: string }[];
  className?: string;
}

export function PracticeAreaTabs({
  basePath,
  active,
  preserve,
  includeTests = true,
  includeSummary = false,
  extraTabs = [],
  className,
}: PracticeAreaTabsProps) {
  const tabs: { key: string; label: string }[] = [
    ...(includeSummary ? [{ key: "summary", label: "Summary" }] : []),
    ...(includeTests ? AREA_TABS_WITH_TESTS : PRACTICE_AREA_TABS),
    ...extraTabs,
  ];

  return (
    <nav aria-label="Sections" className={`${TAB_BAR} ${className?.match(/(^|\s)mb-/) ? "" : "mb-4"} ${className ?? ""}`}>
      <div className="flex min-w-max gap-0.5">
        {tabs.map((tab) => {
          const known = tab.key === "summary" || AREA_TABS_WITH_TESTS.some((t) => t.key === tab.key);
          const href = known
            ? buildAreaHref(basePath, tab.key as HomeTabKey, preserve)
            : buildExtraHref(basePath, tab.key, preserve);
          return (
            <Link
              key={tab.key}
              href={href}
              aria-current={active === tab.key ? "page" : undefined}
              className={`${areaTabLinkClass(known ? (tab.key as HomeTabKey) : "summary", active === tab.key)} whitespace-nowrap`}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

function buildExtraHref(basePath: string, key: string, extra?: Record<string, string | undefined | null>) {
  const params = new URLSearchParams({ area: key });
  for (const [k, v] of Object.entries(extra ?? {})) if (v) params.set(k, v);
  return `${basePath}?${params.toString()}`;
}
